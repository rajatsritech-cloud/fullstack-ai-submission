from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import admin, conversations, health, messages
from app.services import rag

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Pre-load AI models to avoid Cold Start latency during first request
    rag.preload_models()
    yield

app = FastAPI(title="API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(conversations.router)
app.include_router(messages.router)
app.include_router(admin.router)
