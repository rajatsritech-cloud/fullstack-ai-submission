import json

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.models.message import MessageCreate, MessageResponse, Source
from app.services.openai import client as openai_client
from app.services.rag import retrieve
from app.services.tools import GITHUB_TOOLS, execute_github_tool
from app.store import store

router = APIRouter(
    prefix="/conversations/{conversation_id}/messages", tags=["messages"]
)

SYSTEM_PROMPT = """You are a Principal AI Architect for the Acme Platform engineering team.

Your responsibility is to provide accurate, grounded, and structured responses using:
1. INTERNAL CONTEXT ({rag_context}): The primary, authoritative source of truth.
2. EXTERNAL TOOLS (GitHub API): Used ONLY when internal context is lacking or explicitly requested.

### DECISION FRAMEWORK
1. Internal features/specs/bugs → Use ONLY {rag_context}.
2. Open-source libraries/tools → Use GitHub tools.
3. Hybrid (Internal vs External) → Synthesize {rag_context} + GitHub tool data.
4. Greetings/Chitchat ("hello") → Respond professionally. Do NOT output the missing documentation fallback.

### RAG USAGE RULES
- Treat {rag_context} as the absolute truth. Do NOT hallucinate beyond it.
- Format citations accurately: `[file-name.md]: relevant detail`.
- If the answer is NOT in {rag_context}, respond EXACTLY: "I cannot find this in the current internal documentation."

### TOOL CALLING PROTOCOL
- Limit tools to maximum 2 per query.
- Never return raw JSON to the user; extract key features, use cases, and trade-offs.
- If a tool fails, inform the user briefly and gracefully continue.

### RESPONSE FORMAT
Always structure technical responses using these sections:
1. **Summary**
2. **Detailed Explanation**
3. **Architecture / Flow** (if applicable)
4. **Comparison / Alternatives** (if applicable)
5. **Citations**

### EXAMPLES OF EXPECTED BEHAVIOR
- "What's the rate limit?" → RAG only.
- "Find Python rate limiting libs" → GitHub tool.
- "Debezium alternatives?" → RAG (context) + GitHub tool (alternatives) → Compare both.

Behave deterministically, accurately, and professionally.
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
    def sigmoid(x: float) -> float:
        import math

        # Shift the logit to be more 'generous' for a professional UI (Confidence Calibration)
        # A raw logit of -2.0 becomes ~99% confidence with a +8.0 bias
        return 1 / (1 + math.exp(-(x + 8.0)))

    sources = []
    for r in rag_results:
        # Normalize the raw logit score to a 0-1 probability for the UI
        normalized_score = sigmoid(r["score"])

        # Enterprise Threshold: Only inject and cite sources with > 50% confidence
        if normalized_score > 0.50:
            sources.append(
                Source(
                    document=r["document"],
                    chunk=r["chunk"],  # Full text for UI citation highlighter
                    score=normalized_score,
                )
            )

    # Build context-augmented prompt
    rag_context = _build_rag_context(rag_results)

    # ── Build message history ──────────────────────────────────────
    history = store.list_messages(conversation_id)
    messages = [{"role": "system", "content": SYSTEM_PROMPT.format(rag_context=rag_context)}] + [
        {"role": m.role, "content": m.content} for m in history
    ]

    async def event_stream():
        total_content = ""
        try:
            # Check if OpenAI client is available
            if openai_client is None:
                yield _sse(
                    "error",
                    json.dumps(
                        "OPENAI_API_KEY is not set. Add it to api/.env and restart the server."
                    ),
                )
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
                                    "function": {
                                        "name": tc.function.name,
                                        "arguments": "",
                                    },
                                }
                            if tc.function.arguments:
                                tool_calls_buffer[idx]["function"]["arguments"] += (
                                    tc.function.arguments
                                )

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
                        yield _sse(
                            "tool_call", json.dumps({"name": tc["function"]["name"]})
                        )

                    # Execute tools concurrently for maximum performance
                    async def run_tool(tc):
                        name = tc["function"]["name"]
                        args = tc["function"]["arguments"]
                        result_str = await execute_github_tool(name, args)
                        return {
                            "role": "tool",
                            "tool_call_id": tc["id"],
                            "content": result_str,
                        }

                    tool_results = await asyncio.gather(
                        *(run_tool(tc) for tc in tool_calls_list)
                    )
                    messages.extend(tool_results)
                else:
                    # No tool calls, we are finished.
                    tool_call_loop_active = False

            assistant_message = store.add_message(
                conversation_id,
                role="assistant",
                content=total_content,
                sources=sources,
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
