import re
import pickle
from pathlib import Path

import pandas as pd

from agent_workflow import load_datasets_and_model, predict_bin_risk
from collection_priority_engine import assign_priority_to_dataframe
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


def process_user_question(question):
    """Return a Grounded answer using the same components as the Phase 6 coordinator.

    The question may ask for waste collection ordering, explanation for a bin,
    location analysis, or policy guidance.
    """
    df, model = load_datasets_and_model()
    predicted_df = predict_bin_risk(df, model)
    scored_df = assign_priority_to_dataframe(predicted_df)

    q = question.lower()

    # 1. RAG guidance question: e-waste / battery / policy etc.
    if any(term in q for term in ["battery", "batteries", "e-waste", "electronic waste", "recyclable", "hazardous", "organic", "food waste", "paper", "plastic", "policy"]):
        answer = answer_question(question)
        return answer

    # 2. Collection ranking question
    if "collect" in q or "collection" in q or "priority" in q or "need immediate" in q:
        top = scored_df.sort_values("Priority_Score", ascending=False).head(5)
        output = []
        output.append("Assistant: Based on the model prediction and priority scoring engine:")
        for _, row in top.iterrows():
            output.append(
                f"{row['Bin_ID']} is {row['Priority']} with score {row['Priority_Score']:.1f}, "
                f"predicted risk {row['Predicted_Risk']}, current fill {row['Current_Fill_Level']:.1f}%, "
                f"fill rate {row['Fill_Rate']:.2f}, historical average {row['Historical_Average_Fill']:.1f}%."
            )
        return "\n".join(output)

    # 3. Why bin high priority?
    if "why" in q and "bin" in q:
        # Find target bin by regex
        match = re.search(r"bin\s*([a-z0-9-]+)", q, flags=re.I)
        if match:
            target = match.group(1).upper()
            target_row = scored_df[scored_df["Bin_ID"].str.upper() == target]
            if target_row.empty:
                return f"Information unavailable: Bin {target} was not found in the current dataset."
            row = target_row.iloc[0]
            return (
                f"Assistant: Bin {row['Bin_ID']} is high priority because the ML model predicted {row['Predicted_Risk']} and "
                f"the collection priority engine assigned {row['Priority']} with score {row['Priority_Score']:.1f}. "
                f"Evidence includes current fill {row['Current_Fill_Level']:.1f}%, fill rate {row['Fill_Rate']:.2f}, "
                f"historical average {row['Historical_Average_Fill']:.1f}%, location {row['Location']}, and waste type {row['Waste_Type']}."
            )

    # 4. Location generating most waste
    if "location" in q or "area" in q or "waste" in q and "generate" in q:
        location = scored_df.groupby("Location")["Current_Fill_Level"].mean().idxmax()
        avg_fill = scored_df.groupby("Location")["Current_Fill_Level"].mean().max()
        return f"Assistant: The location with the highest average current fill is {location} with an average fill level of {avg_fill:.1f}%."

    # 5. Overflow likely within next few hours
    if "overflow" in q and "few hours" in q:
        rows = scored_df[scored_df["Predicted_Risk"] != "Low Risk"].sort_values("Fill_Rate", ascending=False)
        if rows.empty:
            return "Assistant: No bins in the current dataset are predicted above Low Risk."
        top = rows.head(3)
        parts = []
        for _, row in top.iterrows():
            parts.append(f"{row['Bin_ID']} ({row['Predicted_Risk']}, fill rate {row['Fill_Rate']:.2f}, current fill {row['Current_Fill_Level']:.1f}%)")
        return "Assistant: Bins likely to overflow soon include " + ", ".join(parts) + "."

    # 6. Default answer
    return "Assistant: I can answer collection, bin priority, waste-guidance, or location analysis questions using the existing model, priority engine, and RAG knowledge base."
