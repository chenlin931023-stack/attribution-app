from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .api import upload, analyze, results, export as export_api

app = FastAPI(
    title="业绩归因分析引擎",
    version="1.0.0",
    docs_url=None,
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router)
app.include_router(analyze.router)
app.include_router(results.router)
app.include_router(export_api.router)

@app.get("/api/health")
def health():
    return {"status": "ok"}
