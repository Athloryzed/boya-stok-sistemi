from fastapi import APIRouter
import logging
from database import client

router = APIRouter()


@router.get("/")
async def root():
    return {"message": "Buse Kağıt API"}


@router.get("/health")
async def api_health_check():
    """Health check endpoint via API router"""
    try:
        await client.admin.command('ping')
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        logging.error(f"Health check failed: {e}")
        return {"status": "healthy", "database": "disconnected"}
