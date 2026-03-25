"""
Centralized configuration for the Cortex AI backend.
All tunable parameters are loaded from environment variables with sensible defaults.
This ensures zero hardcoded magic numbers across the codebase.
"""

import os
from dotenv import load_dotenv

load_dotenv()

# ── LLM Configuration ─────────────────────────────────────────────────
OPENAI_MODEL: str = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

# ── RAG Configuration ─────────────────────────────────────────────────
RAG_TOP_K: int = int(os.getenv("RAG_TOP_K", "5"))
RAG_CONFIDENCE_THRESHOLD: float = float(os.getenv("RAG_CONFIDENCE_THRESHOLD", "0.50"))
RAG_LOGIT_BIAS: float = float(os.getenv("RAG_LOGIT_BIAS", "8.0"))

# ── Conversation Configuration ─────────────────────────────────────────
MAX_HISTORY_MESSAGES: int = int(os.getenv("MAX_HISTORY_MESSAGES", "10"))

# ── Tool Configuration ─────────────────────────────────────────────────
GITHUB_FILE_MAX_CHARS: int = int(os.getenv("GITHUB_FILE_MAX_CHARS", "5000"))
