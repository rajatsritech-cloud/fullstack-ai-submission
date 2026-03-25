"""
RAG Service — Markdown-aware chunking + ChromaDB vector store.

Ingests engineering spec documents from the knowledge/ folder and provides
semantic search for retrieval-augmented generation.

Chunking strategy:
  1. Split each markdown file by ## headings (section-level)
  2. If a section exceeds MAX_CHUNK_SIZE, split by paragraphs
  3. Each chunk carries metadata: source document name + section heading
"""

import os
import re
import chromadb
from sentence_transformers import SentenceTransformer, CrossEncoder

# ── Configuration ──────────────────────────────────────────────────────
EMBEDDING_MODEL = "all-MiniLM-L6-v2"
RERANK_MODEL = "cross-encoder/ms-marco-TinyBERT-L-2-v2" # Tiny 30MB model, instant download
MAX_CHUNK_SIZE = 500        # characters
CHUNK_OVERLAP = 0           # Set to 0 for clean, human-readable citation starts in the UI
COLLECTION_NAME = "knowledge_base"

# ── Module-level singletons (initialized on first call) ────────────────
_model: SentenceTransformer | None = None
_reranker: CrossEncoder | None = None
_collection: chromadb.Collection | None = None


def _get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        _model = SentenceTransformer(EMBEDDING_MODEL)
    return _model


def _get_reranker() -> CrossEncoder:
    global _reranker
    if _reranker is None:
        _reranker = CrossEncoder(RERANK_MODEL)
    return _reranker


def preload_models():
    """
    Enterprise-grade model initialization. 
    Downloads/loads weights at boot or during ingestion to prevent 
    'Cold Start' latency for the first user request.
    """
    print(f"--- [RAG] Pre-loading models ({EMBEDDING_MODEL}, {RERANK_MODEL}) ---")
    _get_model()
    _get_reranker()
    print("--- [RAG] AI assets verified and ready ---")


# ── Chunking ───────────────────────────────────────────────────────────

def _split_by_headings(text: str) -> list[tuple[str, str]]:
    """
    Split markdown text by ## headings.
    Returns list of (heading, body) tuples.
    """
    # Split on ## headings, keeping the heading text
    parts = re.split(r"^(## .+)$", text, flags=re.MULTILINE)

    chunks: list[tuple[str, str]] = []
    current_heading = "Introduction"

    i = 0
    while i < len(parts):
        part = parts[i].strip()
        if part.startswith("## "):
            current_heading = part.replace("## ", "").strip()
            i += 1
            continue
        if part:
            chunks.append((current_heading, part))
        i += 1

    return chunks


def _split_long_text(text: str, max_size: int = MAX_CHUNK_SIZE,
                     overlap: int = CHUNK_OVERLAP) -> list[str]:
    """Split text into smaller chunks by paragraphs with overlap."""
    if len(text) <= max_size:
        return [text]

    paragraphs = text.split("\n\n")
    chunks: list[str] = []
    current_chunk = ""

    for para in paragraphs:
        para = para.strip()
        if not para:
            continue

        if len(current_chunk) + len(para) + 2 > max_size and current_chunk:
            chunks.append(current_chunk.strip())
            # Keep overlap from end of previous chunk
            current_chunk = current_chunk[-overlap:] + "\n\n" + para
        else:
            current_chunk = (current_chunk + "\n\n" + para).strip()

    if current_chunk.strip():
        chunks.append(current_chunk.strip())

    return chunks


def _chunk_document(filename: str, content: str) -> list[dict]:
    """
    Break a markdown document into retrieval-ready chunks with metadata.
    Returns list of dicts: {id, text, metadata: {source, section}}
    """
    sections = _split_by_headings(content)
    all_chunks: list[dict] = []
    chunk_idx = 0

    for heading, body in sections:
        sub_chunks = _split_long_text(body)
        for sub in sub_chunks:
            all_chunks.append({
                "id": f"{filename}::chunk_{chunk_idx}",
                "text": sub,
                "metadata": {
                    "source": filename,
                    "section": heading,
                },
            })
            chunk_idx += 1

    return all_chunks


# ── Ingestion ──────────────────────────────────────────────────────────

def ingest_knowledge_base(knowledge_dir: str) -> int:
    """
    Read all .md files from knowledge_dir, chunk them, embed, and store
    in ChromaDB. Returns the total number of chunks indexed.
    """
    global _collection

    # Enterprise sync: ensure models are downloaded/loaded before ingestion
    preload_models()

    abs_dir = os.path.abspath(knowledge_dir)
    if not os.path.isdir(abs_dir):
        raise FileNotFoundError(f"Knowledge directory not found: {abs_dir}")

    # Collect all chunks from all documents
    all_chunks: list[dict] = []
    for fname in sorted(os.listdir(abs_dir)):
        if not fname.endswith(".md"):
            continue
        filepath = os.path.join(abs_dir, fname)
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
        doc_chunks = _chunk_document(fname, content)
        all_chunks.extend(doc_chunks)
        print(f"  [File] {fname}: {len(doc_chunks)} chunks")

    if not all_chunks:
        print("  [Warning] No markdown files found in knowledge directory.")
        return 0

    # Generate embeddings
    model = _get_model()
    texts = [c["text"] for c in all_chunks]
    embeddings = model.encode(texts, show_progress_bar=True).tolist()

    # Store in ChromaDB (Persistent)
    db_path = os.path.join(abs_dir, "..", "chroma_db")
    client = chromadb.PersistentClient(path=db_path)

    # Delete existing collection if it exists (for hot-reload)
    try:
        client.delete_collection(COLLECTION_NAME)
    except Exception:
        pass

    _collection = client.create_collection(
        name=COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"},
    )

    _collection.add(
        ids=[c["id"] for c in all_chunks],
        documents=texts,
        embeddings=embeddings,
        metadatas=[c["metadata"] for c in all_chunks],
    )

    print(f"  [Success] Indexed {len(all_chunks)} chunks into ChromaDB")
    return len(all_chunks)


# ── Retrieval ──────────────────────────────────────────────────────────

def retrieve(query: str, top_k: int = 5) -> list[dict]:
    """
    Two-stage Semantic Search:
    1. Retrieval: Fetch 'top_k * 4' candidates using vector search (Bi-Encoder).
    2. Reranking: Re-score candidates using a Cross-Encoder for maximum accuracy.

    Returns the reranked top_k list of dicts.
    """
    global _collection
    if _collection is None:
        try:
            abs_dir = os.path.dirname(os.path.abspath(__file__))
            # Path: api/app/services/rag.py -> root/chroma_db
            db_path = os.path.join(abs_dir, "..", "..", "..", "chroma_db")
            if os.path.exists(db_path):
                client = chromadb.PersistentClient(path=db_path)
                _collection = client.get_collection(name=COLLECTION_NAME)
        except Exception:
            pass

        if _collection is None:
            return []

    # 1. Retrieval (Fetch broad candidates)
    model = _get_model()
    query_embedding = model.encode([query]).tolist()

    retrieval_k = top_k * 4  # Broad pool for reranking
    results = _collection.query(
        query_embeddings=query_embedding,
        n_results=retrieval_k,
        include=["documents", "metadatas", "distances"],
    )

    if not results or not results["documents"] or not results["documents"][0]:
        return []

    # 2. Reranking (Refine candidates)
    reranker = _get_reranker()
    
    # Prepare pairs for cross-encoder
    candidate_docs = results["documents"][0]
    candidate_metas = results["metadatas"][0]
    
    pairs = [[query, doc] for doc in candidate_docs]
    rerank_scores = reranker.predict(pairs)
    
    # Combine and sort by cross-encoder score
    reranked: list[dict] = []
    for i in range(len(candidate_docs)):
        reranked.append({
            "document": candidate_metas[i]["source"],
            "section": candidate_metas[i]["section"],
            "chunk": candidate_docs[i],
            "score": float(rerank_scores[i]),
        })
    
    # Sort descending by cross-encoder score
    reranked.sort(key=lambda x: x["score"], reverse=True)

    return reranked[:top_k]
