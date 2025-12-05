# main.py
# uvicorn main:app --reload --host 0.0.0.0 --port 8000
from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from contextlib import asynccontextmanager
import os
from api import (
    system_routes,
    network_routes,
    services_routes,
    sound_hw_routes,
    streams_routes,
)
from core import stream_manager


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize and start all enabled streams
    stream_manager.initialize_streams(provider="aes67")
    yield
    # Shutdown: Stop all running streams
    stream_manager.shutdown_gstreamer_manager()


# Create the main FastAPI application instance
app = FastAPI(
    title="StagePi WebUI and API",
    description="WebUI and API for controlling and monitoring StagePi",
    version="1.0.0",
    lifespan=lifespan,
)
# cors
origins = [
    "http://localhost",
    "http://localhost:8000",
    "http://localhost:5173",
    "http://2ccf674fe09d.local:8000",
    "http://2ccf674fe09d.local",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include the routers from the different modules
app.include_router(system_routes.router, prefix="/system", tags=["System"])
app.include_router(network_routes.router, prefix="/network", tags=["Network"])
app.include_router(services_routes.router, prefix="/services", tags=["Services"])
app.include_router(sound_hw_routes.router, prefix="/sound", tags=["Sound"])
app.include_router(streams_routes.router, tags=["Streams"])

# This directory should contain the 'dist' folder from your Preact build
UI_BUILD_DIR = os.path.join(os.path.dirname(__file__), "dist")

# This mounts the 'assets' folder from your build as a static directory
app.mount(
    "/assets",
    StaticFiles(directory=os.path.join(UI_BUILD_DIR, "assets")),
    name="assets",
)

# This is the catch-all route for your Single Page Application (SPA)
# It ensures that any request not matching an API route or a static file
# will serve the main index.html file. This is crucial for client-side routing.


@app.get("/{full_path:path}", include_in_schema=False)
async def serve_frontend(full_path: str):
    index_path = os.path.join(UI_BUILD_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return Response(status_code=404, content="Frontend not found")
