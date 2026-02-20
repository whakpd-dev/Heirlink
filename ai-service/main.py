"""
HeirLink AI Service
FastAPI service for image analysis and processing
"""

import os
import uuid
import asyncio
import logging
from typing import Optional
from io import BytesIO

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ai-service")

app = FastAPI(title="HeirLink AI Service", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

XAI_API_KEY = os.getenv("XAI_API_KEY", "")
XAI_BASE_URL = os.getenv("XAI_BASE_URL", "https://api.x.ai/v1")

tasks: dict[str, dict] = {}


class AnimationRequest(BaseModel):
    media_id: str
    style: Optional[str] = "natural"


class RestorationRequest(BaseModel):
    media_id: str
    enhancement_level: Optional[int] = 5


class AnalysisRequest(BaseModel):
    media_id: str


@app.get("/")
async def root():
    return {"message": "HeirLink AI Service", "status": "running"}


@app.get("/health")
async def health():
    return {"status": "healthy", "xai_configured": bool(XAI_API_KEY)}


async def _analyze_with_grok(image_url: str) -> dict:
    """Call xAI Grok Vision API to analyze the image."""
    if not XAI_API_KEY:
        raise HTTPException(status_code=503, detail="XAI_API_KEY not configured")

    prompt = (
        "Analyze this photo and return a JSON object with:\n"
        '- "event_type": what kind of event or scene (birthday, wedding, vacation, family, '
        "portrait, landscape, food, sport, celebration, everyday, etc.)\n"
        '- "emotions": array of detected emotions (happy, sad, surprised, calm, excited, etc.)\n'
        '- "estimated_date": approximate date/era if determinable from context (YYYY-MM-DD or decade)\n'
        '- "location": likely location or setting description\n'
        '- "weather": weather/lighting conditions if outdoor\n'
        '- "people_count": number of people visible\n'
        '- "description": 1-2 sentence description of the scene\n'
        "Return ONLY valid JSON, no markdown."
    )

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"{XAI_BASE_URL}/chat/completions",
            headers={"Authorization": f"Bearer {XAI_API_KEY}", "Content-Type": "application/json"},
            json={
                "model": "grok-2-vision-latest",
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {"type": "image_url", "image_url": {"url": image_url}},
                            {"type": "text", "text": prompt},
                        ],
                    }
                ],
                "temperature": 0.3,
            },
        )
        if resp.status_code != 200:
            logger.error(f"Grok API error: {resp.status_code} {resp.text[:200]}")
            raise HTTPException(status_code=502, detail="AI service unavailable")

        data = resp.json()
        content = data.get("choices", [{}])[0].get("message", {}).get("content", "")

        import json
        cleaned = content.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[-1].rsplit("```", 1)[0]

        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            logger.warning(f"Failed to parse Grok response as JSON: {cleaned[:200]}")
            return {
                "event_type": "unknown",
                "emotions": [],
                "description": content[:500],
                "people_count": 0,
            }


@app.post("/api/animate")
async def animate_photo(request: AnimationRequest):
    task_id = f"animate_{uuid.uuid4().hex[:12]}"
    tasks[task_id] = {"status": "processing", "type": "animate", "media_id": request.media_id}
    return {"status": "processing", "task_id": task_id, "message": "Animation is not yet implemented"}


@app.post("/api/restore")
async def restore_photo(request: RestorationRequest):
    task_id = f"restore_{uuid.uuid4().hex[:12]}"
    tasks[task_id] = {"status": "processing", "type": "restore", "media_id": request.media_id}
    return {"status": "processing", "task_id": task_id, "message": "Restoration is not yet implemented"}


@app.post("/api/analyze")
async def analyze_photo(request: AnalysisRequest):
    """Analyze a photo using Grok Vision API."""
    try:
        analysis = await _analyze_with_grok(request.media_id)
        task_id = f"analyze_{uuid.uuid4().hex[:12]}"
        tasks[task_id] = {"status": "completed", "analysis": analysis}
        return {"status": "completed", "task_id": task_id, "analysis": analysis}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Analysis failed")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/task/{task_id}")
async def get_task_status(task_id: str):
    task = tasks.get(task_id)
    if not task:
        return {"task_id": task_id, "status": "not_found"}
    return {"task_id": task_id, **task}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
