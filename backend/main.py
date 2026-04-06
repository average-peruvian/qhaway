from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from dashboard.cache import init, cache_stats
from routers import map, species, temporal, taxon, stats


@asynccontextmanager
async def lifespan(app: FastAPI):
    init()
    yield


app = FastAPI(title="Biodiversity Explorer API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

app.include_router(map.router,      prefix="/api/map")
app.include_router(species.router,  prefix="/api/species")
app.include_router(temporal.router, prefix="/api/temporal")
app.include_router(taxon.router,    prefix="/api/taxon")
app.include_router(stats.router,    prefix="/api/stats")


@app.get("/api/status")
def status():
    return cache_stats()