# main.py
# uvicorn main:app --reload --host 0.0.0.0 --port 8000
from fastapi import FastAPI
from api import system_routes, network_routes, services_routes

# Create the main FastAPI application instance
app = FastAPI(
    title="StagePi API",
    description="API for controlling and monitoring the Raspberry Pi device.",
    version="1.0.0",
)

# Include the routers from the different modules
app.include_router(system_routes.router, prefix="/system", tags=["System"])
app.include_router(network_routes.router, prefix="/network", tags=["Network"])
app.include_router(services_routes.router, prefix="/services", tags=["Services"])

@app.get("/", tags=["Root"])
async def read_root():
    return {"message": "Welcome to the StagePi API!"}