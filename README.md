# Cortex AI - Professional RAG & Tool Calling Platform

**Cortex AI** is a high-performance, production-grade AI chatbot designed for technical teams. It combines an elite "Glass Island" user interface with a sophisticated Two-Stage RAG pipeline and live GitHub tool integration.

---

### 🌟 Key Features

#### **1. Advanced AI Search (RAG)**
-   **Two-Stage Reranking**: Unlike basic search, Cortex AI uses a secondary **ms-marco-TinyBERT** model to re-verify the top 20 search results for 100% accuracy.
-   **Heading-Aware Chunking**: Documents are split based on their internal structure (Markdown headings), ensuring the bot always has the full context of a section.

#### **2. Power-User UX**
-   **Glass Island UI**: A floating, translucent "island" header that provides a premium, minimalist corporate look.
-   **Voice-to-Text**: Hands-free interaction using the built-in **Web Speech API**.
-   **Interactive Citations**: Click on any source badge to open a detailed side-sheet showing the exact reference material.
-   **Real-time Tool Feedback**: A spinning status indicator shows exactly when the bot is searching GitHub or reading external files.

#### **3. Enterprise Performance**
-   **Zero Cold-Start**: AI models are pre-loaded during the server startup phase (FastAPI Lifespan), ensuring the very first message is processed instantly.
-   **Parallel Execution**: Multi-step GitHub searches are executed concurrently to minimize wait times.

---

### 🚀 Getting Started

#### **1. Environment Setup**
Create an `.env` file in the `api/` directory with your credentials:
```env
OPENAI_API_KEY="your-key-here"
GITHUB_ACCESS_TOKEN="your-github-pat-here"
```

#### **2. Backend (FastAPI)**
We use **Poetry** for reliable dependency management.
```bash
cd api
poetry install
python -m poetry run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

#### **3. Frontend (React + Vite)**
```bash
cd ui
npm install
npm run dev
```
Open **http://localhost:5173** to start chatting.

---

### 📂 Knowledge Ingestion
Before asking questions about your local documents, you must "teach" them to the AI by running the ingestion command once:

**Command**: `POST http://127.0.0.1:8000/admin/ingest`
*(You can use the provided Postman collection in the `api/` folder for this).*

---

### 🛠️ Tech Stack
-   **Frontend**: React 19, Vite, Tailwind CSS 4, Radix UI.
-   **Backend**: FastAPI, Poetry, OpenAI GPT-4o.
-   **AI Layer**: ChromaDB (Vector Store), Sentence-Transformers (Embeddings), Cross-Encoders (Reranking).

**For a detailed look at my architectural decisions and trade-offs, please see [SOLUTION.md](./SOLUTION.md).**
