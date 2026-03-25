import logging
from pathlib import Path

from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/admin", tags=["admin"])
logger = logging.getLogger(__name__)

@router.post("/ingest")
async def ingest_knowledge_base():
    """
    Trigger RAG ingestion of the knowledge/ folder.
    Call this once after deploy or whenever docs change.
    Idempotent — safe to call multiple times (rebuilds the index).
    """
    try:
        from app.services.rag import ingest_knowledge_base as _ingest

        # Resolve the root directory (4 levels up from this file)
        # api/app/routers/admin.py -> api/app/routers -> api/app -> api -> /
        root_dir = Path(__file__).resolve().parent.parent.parent.parent
        knowledge_dir = root_dir / "knowledge"

        if not knowledge_dir.exists() or not knowledge_dir.is_dir():
            logger.error(f"Knowledge directory not found at {knowledge_dir}")
            raise HTTPException(
                status_code=404,
                detail="Knowledge directory not found. Ensure the 'knowledge' folder exists at the project root."
            )

        count = _ingest(str(knowledge_dir))
        return {"status": "ok", "chunks_indexed": count}
    
    except Exception as e:
        logger.exception("Failed to ingest knowledge base")
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {str(e)}")
