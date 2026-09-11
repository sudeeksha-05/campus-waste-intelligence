from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Any, Dict, Optional

from backend.services.waste_service import (
    get_dashboard,
    get_bins,
    get_bin,
    get_risk_distribution,
    get_analytics_location,
    get_analytics_trend,
    get_priority,
    predict,
    assistant_answer,
    get_routes,
)

app = FastAPI(title="Campus Waste Intelligence API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class PredictionInput(BaseModel):
    Current_Fill_Level: float
    Previous_Fill_Level: float
    Fill_Rate: float
    Day_of_Week: str
    Hour: int
    Waste_Type: str
    Historical_Average_Fill: float
    Collection_Due: str
    Location: str


class AssistantInput(BaseModel):
    question: str


@app.get("/api/dashboard")
def dashboard(location: Optional[str] = None):
    return get_dashboard(location=location)


@app.get("/api/bins")
def bins(location: Optional[str] = None, risk: Optional[str] = None, waste_type: Optional[str] = None):
    return get_bins(location=location, risk=risk, waste_type=waste_type)


@app.get("/api/bins/{bin_id}")
def bin_detail(bin_id: str):
    row = get_bin(bin_id)
    if row is None:
        return {"error": "Bin not found"}
    return row


@app.get("/api/analytics/risk")
def analytics_risk(location: Optional[str] = None):
    return get_risk_distribution(location=location)


@app.get("/api/analytics/location")
def analytics_location():
    return get_analytics_location()


@app.get("/api/analytics/trend")
def analytics_trend(days: int = 7):
    return get_analytics_trend(days)


@app.get("/api/priority")
def priority():
    return get_priority()


@app.post("/api/predict")
def prediction(payload: PredictionInput):
    return predict(payload.model_dump())


@app.post("/api/assistant")
def assistant(payload: AssistantInput):
    return {"answer": assistant_answer(payload.question)}


@app.get("/api/routes")
def routes():
    return get_routes()


@app.get("/health")
def health():
    return {"status": "ok", "service": "Campus Waste Intelligence", "campus": "Spoorthy Engineering College"}
