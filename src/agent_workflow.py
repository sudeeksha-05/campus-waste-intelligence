import pickle
import re
import sys
from pathlib import Path

import pandas as pd

# Local project imports
sys.path.append(str(Path(__file__).resolve().parent))

from collection_priority_engine import assign_priority_to_dataframe, describe_bin_priority
from rag_knowledge import answer_question

DATA_FILE = Path("data/smart_waste_simulated_dataset.csv")
MODEL_FILE = Path("models/decision_tree_model.pkl")

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
    df, model = load_datasets_and_model()

    # 1. retrieve latest bin data (from data file)
    latest_data = df.copy()

    # 2. send relevant data to ML model
    predicted_df = predict_bin_risk(latest_data, model)

    # 3. apply priority engine scoring
    scored_df = assign_priority_to_dataframe(predicted_df)

    # 4. route for question type
    question_type = classify_collection_question(question)

    # 5. If user asks for waste-handling guidance, use RAG
    rag_answer = answer_question_with_rag(question)

    # 6. choose bins from the data and rank them by priority score
    # A complete answer should be based on the top urgent bins.
    priority_order = scored_df.sort_values("Priority_Score", ascending=False)

    top_bins = []
    for _, row in priority_order.head(5).iterrows():
        top_bins.append(row)

    # 7. if the user asks for a specific bin, filter
    bin_match = None
    m = re.search(r"bin\s*([A-Za-z0-9-]+)", question.lower(), re.I)
    if m:
        target_bin = m.group(1).upper()
        # preserve bin-id shape case-responsiveness
        bin_match = scored_df[scored_df["Bin_ID"].str.upper() == target_bin]

    # 8. generate explanation for top bins and draw a transparency structure
    recommendations = []
    for row in top_bins:
        explanation = describe_bin_priority(row)
        recommendations.append(
            f"{row['Bin_ID']} should be prioritized because {row['Priority']} with score {row['Priority_Score']:.1f}. "
            f"Prediction: {row['Predicted_Risk']}. Evidence: current fill {row['Current_Fill_Level']:.1f}%, "
            f"fill rate {row['Fill_Rate']:.2f}, historical average {row['Historical_Average_Fill']:.1f}%, "
            f"waste type {row['Waste_Type']}, location {row['Location']}. "
            f"{explanation}"
        )

    # 9. Build response sections: Prediction, Evidence, Recommendation
    # Maintain final human decision control.
    response = []
    response.append("Prediction:")
    response.append("The ML model classifies the highest-risk bins from the current dataset as follows:")
    response.append(", ".join(
        f"{row['Bin_ID']} -> {row['Predicted_Risk']}" for row in top_bins
    ))

    response.append("\nEvidence:")
    response.append(
        "Priority scoring is based on predicted risk, current fill level, fill rate, historical average fill, "
        "location importance, waste handling urgency, collection due status, time of day, and estimated time to overflow."
    )

    response.append("\nRecommendation:")
    for rec in recommendations:
        response.append(rec)

    if bin_match is not None and not bin_match.empty:
        first = bin_match.iloc[0]
        response.append(f"Detailed explanation: {describe_bin_priority(first)}")

    if question_type == "guidance":
        response.append("\nRAG Guidance:")
        response.append(rag_answer)
    else:
        response.append("\nRAG Guidance:")
        response.append("RAG retrieval not needed for this collection request.")

    response.append("\nHuman approval reminder:")
    response.append("The human sanitation supervisor must verify the final dispatch order and collection decision.")

    return "\n".join(response)
