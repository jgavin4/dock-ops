from fastapi import FastAPI

app = FastAPI(title="vessel-ops API")

@app.get("/health")
def health():
    return {"status": "ok"}
