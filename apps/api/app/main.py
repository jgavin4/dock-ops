from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers.comments import router as comments_router
from app.routers.inventory_checks import router as inventory_checks_router
from app.routers.inventory_requirements import router as inventory_requirements_router
from app.routers.maintenance import router as maintenance_router
from app.routers.orgs import router as orgs_router
from app.routers.vessels import router as vessels_router
from app.routers.imports import router as imports_router

app = FastAPI(title="vessel-ops API")

# CORS middleware
import os
cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(orgs_router)
app.include_router(vessels_router)
app.include_router(inventory_requirements_router)
app.include_router(inventory_checks_router)
app.include_router(maintenance_router)
app.include_router(comments_router)
app.include_router(imports_router)

@app.get("/health")
def health():
    return {"status": "ok"}
