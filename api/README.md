# Cortex AI: Backend API

This is the backend for the Cortex AI chatbot. It uses FastAPI and can search through your documents using a vector database (ChromaDB).

## 🛠️ Setup

1.  **Python**: You need Python 3.12 or newer.
2.  **Poetry**: You must have Poetry installed for managing packages.
3.  **API Keys**: Make a copy of `.env.example` and name it `.env`. Add your OpenAI and GitHub keys there.

```bash
# How to install dependencies
cd api
poetry install
```

## 🚀 How to Run

To start the server, just run this command in the `api` folder:

```powershell
python -m poetry run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

-   The server will start at `http://127.0.0.1:8000`.
-   **API Documentation**: You can see all endpoints at `http://127.0.0.1:8000/docs`.

## 📂 Document Ingestion

Before you can ask questions about your documents, you need to store them in the AI search engine. Run this command once (using a tool like Postman):

`POST http://localhost:8000/admin/ingest`

This will scan all markdown files in the `knowledge/` folder and index them into ChromaDB.

## ✨ Key Features
-   **Smart Search**: Uses a Cross-Encoder to give very accurate answers.
-   **GitHub Search**: The bot can look into GitHub repos to answer your questions.
-   **Fast Startup**: Models load when the server starts, so there is no lag for the user.
