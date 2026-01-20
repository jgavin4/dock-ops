from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers.inventory_checks import router as inventory_checks_router
from app.routers.inventory_requirements import router as inventory_requirements_router
from app.routers.maintenance import router as maintenance_router
from app.routers.vessels import router as vessels_router

app = FastAPI(title="vessel-ops API")

# CORS middleware for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(vessels_router)
app.include_router(inventory_requirements_router)
app.include_router(inventory_checks_router)
app.include_router(maintenance_router)

@app.get("/health")
def health():
    return {"status": "ok"}
