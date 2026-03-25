import json

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.models.message import MessageCreate, MessageResponse, Source
from app.services.openai import client as openai_client
from app.services.rag import retrieve
from app.services.tools import GITHUB_TOOLS, execute_github_tool
from app.store import store

router = APIRouter(prefix="/conversations/{conversation_id}/messages", tags=["messages"])

SYSTEM_PROMPT = """You are a Principal AI Architect for the Acme Platform engineering team. Your role is to provide elite technical insights, drawing strictly from internal documentation and authoritative open-source sources.

🌍 CAPABILITIES:
1. Internal Knowledge Base (RAG): Detailed engineering specs provided in your context block.
2. GitHub Ecosystem (Tools): Live API access to search repos, read READMEs, and analyze external code.

📜 ENTERPRISE DIRECTIVES:
- ALWAYS base your answers on the provided context. If the context lacks the answer, state "I cannot find this in the current internal documentation."
- EXPLICITLY CITE your sources inline using markdown formatting (e.g., "[data-pipeline.md]: Debezium handles CDC...").
- INTELLIGENT ROUTING: If a user asks for alternatives to an internal tool, verify the internal tool first using the context, then automatically execute ONE OR MORE GitHub tools to find alternatives, and synthesize a deep technical comparison.
- DO NOT hallucinate API definitions, version numbers, or architecture specs. 

🚀 FEW-SHOT WORKFLOW EXAMPLES:
User: "What does the README for pallets/flask say?"
Action: Execute `get_github_file_content(owner="pallets", repo="flask", path="README.md")`. Return a concise technical summary of the README.

User: "Our data pipeline spec mentions we use Debezium for CDC. Are there any newer alternatives? Compare them."
Action: 
1. Read the provided RAG context regarding the data pipeline and Debezium.
2. Formulate GitHub search queries natively via `search_github_repositories(query="CDC Change Data Capture alternatives")`.
3. Output a structured comparison matrix (Pros, Cons, Architecture differences) fusing both internal and external data.
"""


def _build_rag_context(sources: list[dict]) -> str:
    """Format retrieved RAG chunks into a context block for the LLM."""
    if not sources:
        return ""

    context_parts = ["\n--- Retrieved Knowledge Base Context ---"]
    for s in sources:
        context_parts.append(
            f"\n[Source: {s['document']} — {s['section']}]\n{s['chunk']}"
        )
    context_parts.append("\n--- End of Context ---\n")
    return "\n".join(context_parts)


@router.get("", response_model=list[MessageResponse])
async def list_messages(conversation_id: str):
    if not store.get_conversation(conversation_id):
        raise HTTPException(status_code=404, detail="Conversation not found")
    return store.list_messages(conversation_id)


@router.post("")
async def send_message(conversation_id: str, payload: MessageCreate):
    """
    Accepts a user message, stores it, and returns an SSE stream
    with the assistant's response via OpenAI.

    SSE event types:
      - sources: retrieved RAG sources  (data = list[Source])
      - token:   partial text chunk     (data = string)
      - done:    final message          (data = MessageResponse)
      - error:   something went wrong   (data = string)
    """
    if not store.get_conversation(conversation_id):
        raise HTTPException(status_code=404, detail="Conversation not found")

    store.add_message(conversation_id, role="user", content=payload.content)

    # ── RAG Retrieval ──────────────────────────────────────────────
    user_query = payload.content
    rag_results = retrieve(user_query, top_k=5)

    # Pass all chunks untruncated so the frontend can render full citations in a Sheet
    sources = []
    for r in rag_results:
        if r["score"] > 0.25:
            sources.append(
                Source(
                    document=r["document"],
                    chunk=r["chunk"],  # Full text for UI citation highlighter
                    score=r["score"],
                )
            )

    # Build context-augmented prompt
    rag_context = _build_rag_context(rag_results)

    # ── Build message history ──────────────────────────────────────
    history = store.list_messages(conversation_id)
    messages = [{"role": "system", "content": SYSTEM_PROMPT + rag_context}] + [
        {"role": m.role, "content": m.content} for m in history
    ]

    async def event_stream():
        total_content = ""
        try:
            # Check if OpenAI client is available
            if openai_client is None:
                yield _sse("error", json.dumps(
                    "OPENAI_API_KEY is not set. Add it to api/.env and restart the server."
                ))
                return

            # Send sources event first so frontend can show them
            if sources:
                sources_data = [s.model_dump() for s in sources]
                yield _sse("sources", json.dumps(sources_data))

            tool_call_loop_active = True
            
            while tool_call_loop_active:
                stream = openai_client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=messages,
                    tools=GITHUB_TOOLS,
                    stream=True,
                )

                tool_calls_buffer = {}
                step_content = ""
                
                for chunk in stream:
                    delta = chunk.choices[0].delta
                    
                    if delta.tool_calls:
                        for tc in delta.tool_calls:
                            idx = tc.index
                            if idx not in tool_calls_buffer:
                                tool_calls_buffer[idx] = {
                                    "id": tc.id,
                                    "type": "function",
                                    "function": {"name": tc.function.name, "arguments": ""}
                                }
                            if tc.function.arguments:
                                tool_calls_buffer[idx]["function"]["arguments"] += tc.function.arguments

                    if delta.content:
                        step_content += delta.content
                        total_content += delta.content
                        yield _sse("token", json.dumps(delta.content))

                if tool_calls_buffer:
                    import asyncio
                    
                    # Execute tools
                    tool_calls_list = [v for k, v in sorted(tool_calls_buffer.items())]
                    
                    assistant_msg = {"role": "assistant", "tool_calls": tool_calls_list}
                    # Strict OpenAI compliance: explicitly set content to None if empty
                    assistant_msg["content"] = step_content if step_content else None
                        
                    messages.append(assistant_msg)

                    # Notify frontend immediately for all active tool executions
                    for tc in tool_calls_list:
                        yield _sse("tool_call", json.dumps({"name": tc["function"]["name"]}))
                        
                    # Execute tools concurrently for maximum performance
                    async def run_tool(tc):
                        name = tc["function"]["name"]
                        args = tc["function"]["arguments"]
                        result_str = await execute_github_tool(name, args)
                        return {"role": "tool", "tool_call_id": tc["id"], "content": result_str}
                        
                    tool_results = await asyncio.gather(*(run_tool(tc) for tc in tool_calls_list))
                    messages.extend(tool_results)
                else:
                    # No tool calls, we are finished.
                    tool_call_loop_active = False

            assistant_message = store.add_message(
                conversation_id,
                role="assistant",
                content=total_content,
                sources=sources if sources else None,
            )
            yield _sse("done", assistant_message.model_dump_json())

        except Exception as exc:
            yield _sse("error", json.dumps(str(exc)))

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


def _sse(event: str, data: str) -> str:
    return f"event: {event}\ndata: {data}\n\n"
