import pickle
import re
import sys
from pathlib import Path

import pandas as pd

# Local project imports
sys.path.append(str(Path(__file__).resolve().parent))

from collection_priority_engine import assign_priority_to_dataframe, describe_bin_priority
from rag_knowledge import answer_question

ROOT = Path(__file__).resolve().parents[1]
if not (ROOT / "data").exists():
    ROOT = Path(r"C:\Users\alapa\Desktop\aicte")
DATA_FILE = ROOT / "data" / "smart_waste_simulated_dataset.csv"
MODEL_FILE = ROOT / "models" / "decision_tree_model.pkl"

FEATURE_COLUMNS = [
    "Current_Fill_Level",
    "Previous_Fill_Level",
    "Fill_Rate",
    "Day_of_Week",
    "Hour",
    "Waste_Type",
    "Historical_Average_Fill",
    "Collection_Due",
    "Location",
]


def load_datasets_and_model():
    """Load the latest available bin data and the saved ML model."""
    df = pd.read_csv(DATA_FILE)
    df["Timestamp"] = pd.to_datetime(df["Timestamp"])
    df["Day_of_Week"] = df["Timestamp"].dt.strftime("%A")

    with open(MODEL_FILE, "rb") as f:
        model = pickle.load(f)

    return df, model


def predict_bin_risk(df, model):
    """Use ML model to predict risk and add predicted risk to the dataframe."""
    output = df.copy()
    predicted = model.predict(output[FEATURE_COLUMNS])
    output["Predicted_Risk"] = predicted
    output["Priority"] = output["Predicted_Risk"].apply(lambda x: x)
    return output


def answer_question_with_rag(question):
    """Retrieve relevant waste-management guidance from the local RAG knowledge base if needed."""
    question_lower = question.lower()
    rule_topics = [
        "e-waste",
        "electronic waste",
        "battery",
        "batteries",
        "plastic",
        "paper",
        "food waste",
        "organic",
        "recyclable",
        "waste policy",
        "campus waste",
        "hazardous",
    ]

    if any(topic in question_lower for topic in rule_topics):
        return answer_question(question)
    return "No RAG retrieval requested because the question is about bin collection and urgency only."


def classify_collection_question(question):
    """Return a simple type label for question routing."""
    q = question.lower()
    if "bin" in q and ("collect" in q or "collection" in q or "priority" in q):
        return "collection"
    if any(t in q for t in ["e-waste", "battery", "recyclable", "hazardous", "waste policy", "food waste", "organic"]):
        return "guidance"
    if "area" in q or "location" in q:
        return "area"
    return "general"


def make_agent_recommendation(question):
    """Main coordinator function. Combines data, ML prediction, priority scoring, and optional RAG guidance."""
    from conversation_interface import process_user_question
    return process_user_question(question)
