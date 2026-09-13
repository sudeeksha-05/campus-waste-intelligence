import sys
import pickle
from pathlib import Path
from typing import Dict, Any, List, Optional

import pandas as pd
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "src"))

from agent_workflow import load_datasets_and_model, predict_bin_risk
from collection_priority_engine import PRIORITY_ORDER, assign_priority_to_dataframe, describe_bin_priority, compute_estimated_time_to_overflow
from route_recommendation import make_route_order, compare_collection_orders, explain_route
from rag_knowledge import answer_question
from conversation_interface import process_user_question

DATA_FILE = ROOT / "data" / "smart_waste_simulated_dataset.csv"
MODEL_FILE = ROOT / "models" / "decision_tree_model.pkl"
ACTIVE_CAMPUS = "Spoorthy Engineering College"

LOCATION_ALIASES = {
    "Hostel Block A": "Hostel Block 1",
    "Hostel Block B": "Hostel Block 2",
}

WASTE_TYPE_ALIASES = {
    "Food / Organic": "Organic",
    "Mixed Waste": "Mixed",
}



def load_historical_data() -> pd.DataFrame:
    """Load all historical sensor readings for analytics and trend calculations."""
    df, _ = load_datasets_and_model()
    return df


def get_latest_bin_readings(df: pd.DataFrame | None = None) -> pd.DataFrame:
    """Return exactly one, chronologically latest sensor reading per physical bin."""
    source = load_historical_data() if df is None else df.copy()
    source["Timestamp"] = pd.to_datetime(source["Timestamp"], errors="coerce")
    source = source.dropna(subset=["Bin_ID", "Timestamp"])
    return (
        source.sort_values(["Bin_ID", "Timestamp"])
        .drop_duplicates(subset=["Bin_ID"], keep="last")
        .reset_index(drop=True)
    )


def load_scored_data() -> pd.DataFrame:
    """Load current readings, then run model prediction and priority scoring."""
    df, model = load_datasets_and_model()
    latest_df = get_latest_bin_readings(df)
    predicted_df = predict_bin_risk(latest_df, model)
    scored_df = assign_priority_to_dataframe(predicted_df)
    return scored_df


def as_bin_dict(row: pd.Series) -> Dict[str, Any]:
    """Normalize DataFrame row to compact API response dictionary."""
    overflow_hours = compute_estimated_time_to_overflow(row)
    return {
        "bin_id": str(row.get("Bin_ID", "")),
        "location": str(row.get("Location", "")),
        "timestamp": str(row.get("Timestamp", "")),
        "current_fill_level": float(row.get("Current_Fill_Level", 0.0)),
        "previous_fill_level": float(row.get("Previous_Fill_Level", 0.0)),
        "fill_rate": float(row.get("Fill_Rate", 0.0)),
        "day_of_week": str(row.get("Day_of_Week", "")),
        "hour": int(row.get("Hour", 0)),
        "waste_type": str(row.get("Waste_Type", "")),
        "historical_average_fill": float(row.get("Historical_Average_Fill", 0.0)),
        "collection_due": str(row.get("Collection_Due", "Yes")),
        "overflow_status": str(row.get("Overflow_Status", "")),
        "predicted_risk": str(row.get("Predicted_Risk", "Low Risk")),
        "priority": str(row.get("Priority", "P4")),
        "priority_score": float(row.get("Priority_Score", 0.0)),
        "priority_explanation": str(row.get("Priority_Explanation", "")),
        "estimated_overflow_hours": round(float(overflow_hours), 2) if np.isfinite(overflow_hours) else None,
    }


def get_dashboard(location: str | None = None) -> Dict[str, Any]:
    df = load_scored_data()
    location = LOCATION_ALIASES.get(location, location)
    if location and location != "All":
        df = df[df["Location"] == location]

    total_bins = int(df["Bin_ID"].nunique())
    avg_fill = float(df["Current_Fill_Level"].mean()) if not df.empty else 0.0
    high_count = int((df["Predicted_Risk"] == "High Risk").sum())
    medium_count = int((df["Predicted_Risk"] == "Medium Risk").sum())
    low_count = int((df["Predicted_Risk"] == "Low Risk").sum())
    collection_required = int(df[df["Priority"].isin(["P1", "P2", "P3"])].shape[0])

    bins = df.sort_values("Priority_Score", ascending=False).head(8)

    latest_timestamp = df["Timestamp"].max() if not df.empty else None
    return {
        "title": "Campus Waste Intelligence",
        "subtitle": "AI-powered monitoring and collection decision support",
        "campus": ACTIVE_CAMPUS,
        "monitoring": {
            "bin_count": total_bins,
            "latest_timestamp": latest_timestamp.isoformat() if latest_timestamp is not None else None,
            "location": location if location and location != "All" else "All Campus",
        },
        "kpis": {
            "total_bins": total_bins,
            "high_risk": high_count,
            "medium_risk": medium_count,
            "low_risk": low_count,
            "average_fill_level": round(avg_fill, 1),
            "collection_required": collection_required,
        },
        "bins_requiring_immediate_attention": [as_bin_dict(row) for _, row in bins.iterrows()],
        "risk_distribution": {
            "High Risk": int((df["Predicted_Risk"] == "High Risk").sum()),
            "Medium Risk": int((df["Predicted_Risk"] == "Medium Risk").sum()),
            "Low Risk": int((df["Predicted_Risk"] == "Low Risk").sum()),
        },
    }


def get_bins(limit: int = 100, location: str | None = None, risk: str | None = None, waste_type: str | None = None):
    df = load_scored_data()
    location = LOCATION_ALIASES.get(location, location)
    waste_type = WASTE_TYPE_ALIASES.get(waste_type, waste_type)
    if location and location != "All":
        df = df[df["Location"] == location]
    if risk and risk != "All":
        df = df[df["Predicted_Risk"] == risk]
    if waste_type and waste_type != "All":
        df = df[df["Waste_Type"] == waste_type]

    rows = [as_bin_dict(row) for _, row in df.head(limit).iterrows()]
    return rows


def get_bin(bin_id: str):
    df = load_scored_data()
    row = df[df["Bin_ID"].str.upper() == bin_id.upper()]
    if row.empty:
        return None
    row = row.iloc[0]
    detail = as_bin_dict(row)
    detail["priority_reason"] = describe_bin_priority(row)
    history_df = load_historical_data()
    history_df = history_df[history_df["Bin_ID"].str.upper() == bin_id.upper()].sort_values("Timestamp")
    detail["history"] = [
        {
            "timestamp": str(history_row.get("Timestamp", "")),
            "current_fill_level": float(history_row.get("Current_Fill_Level", 0.0)),
            "historical_average_fill": float(history_row.get("Historical_Average_Fill", 0.0)),
            "fill_rate": float(history_row.get("Fill_Rate", 0.0)),
        }
        for _, history_row in history_df.iterrows()
    ]
    return detail


def get_risk_distribution(location: str | None = None) -> Dict[str, Any]:
    df = load_scored_data()
    location = LOCATION_ALIASES.get(location, location)
    if location and location != "All":
        df = df[df["Location"] == location]
    counts = df["Predicted_Risk"].value_counts().to_dict()
    return {
        "High Risk": int(counts.get("High Risk", 0)),
        "Medium Risk": int(counts.get("Medium Risk", 0)),
        "Low Risk": int(counts.get("Low Risk", 0)),
    }


def get_analytics_location():
    df = load_historical_data()
    grouped = df.groupby("Location")["Current_Fill_Level"].mean().reset_index()
    grouped = grouped.sort_values("Current_Fill_Level", ascending=False)
    return [{"location": str(r["Location"]), "average_fill": round(float(r["Current_Fill_Level"]), 1)} for _, r in grouped.iterrows()]


def get_analytics_trend(days: int = 7):
    df = load_historical_data()
    df["Timestamp"] = pd.to_datetime(df["Timestamp"])
    latest_date = df["Timestamp"].max()
    start_date = latest_date - pd.Timedelta(days=days-1)
    window = df[df["Timestamp"] >= start_date]
    trend = window.groupby(window["Timestamp"].dt.date)["Current_Fill_Level"].mean().reset_index()
    trend.columns = ["date", "average_fill_level"]
    return [{"date": str(r["date"]), "average_fill_level": round(float(r["average_fill_level"]), 1)} for _, r in trend.iterrows()]


def get_priority():
    df = load_scored_data()
    df["Priority_Order"] = df["Priority"].map(PRIORITY_ORDER)
    df["Overflow_Sort"] = df.apply(compute_estimated_time_to_overflow, axis=1).replace(np.inf, 1e12)
    rows = df.sort_values(["Priority_Order", "Overflow_Sort", "Current_Fill_Level"], ascending=[True, True, False])
    return [as_bin_dict(row) for _, row in rows.iterrows()]


def predict(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Use the existing model pipeline with an incoming feature payload."""
    df = load_scored_data()
    model = load_model()
    row = pd.DataFrame([payload])
    for col in ["Day_of_Week", "Waste_Type", "Collection_Due", "Location"]:
        if col not in row.columns:
            row[col] = "Unknown"
    if "Hour" in payload:
        row["Hour"] = int(payload.get("Hour", 0))
    prediction = model.predict(row[[
        "Current_Fill_Level",
        "Previous_Fill_Level",
        "Fill_Rate",
        "Day_of_Week",
        "Hour",
        "Waste_Type",
        "Historical_Average_Fill",
        "Collection_Due",
        "Location",
    ]])[0]
    output = {
        "predicted_risk": prediction,
        "priority": "P1" if prediction == "High Risk" else "P2" if prediction == "Medium Risk" else "P4",
        "explanation": f"Predicted risk {prediction} from the existing model pipeline using the supplied bin features.",
    }
    return output


def load_model():
    with open(ROOT / "models" / "decision_tree_model.pkl", "rb") as f:
        return pickle.load(f)


def assistant_answer(question: str, history: Optional[List[Dict[str, Any]]] = None) -> str:
    return process_user_question(question, history=history)


def get_routes():
    df = load_scored_data()
    route = make_route_order(df.sort_values("Priority_Score", ascending=False).head(50))
    explanation = explain_route(df)
    compare = compare_collection_orders(df)
    return {
        "route": route,
        "explanation": explanation,
        "comparison": compare,
    }
