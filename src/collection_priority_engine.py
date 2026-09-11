import numpy as np
import pandas as pd

# Prototype score weights. The project should describe this as a transparent,
# classroom prototype decision-support score rather than a scientifically validated model.

RISK_WEIGHT = {
    "Low Risk": 0,
    "Medium Risk": 18,
    "High Risk": 35,
}

LOCATION_IMPORTANCE = {
    "Canteen": 20,
    "Hostel Block 1": 16,
    "Hostel Block 2": 16,
    "Common Area": 14,
    "Library": 10,
    "Academic Block A": 8,
    "Academic Block B": 8,
}

WASTE_HANDLING_URGENCY = {
    "Organic": 12,
    "Mixed": 10,
    "Plastic": 8,
    "Paper": 4,
}

MEAL_HOURS = {11, 12, 13, 14, 18, 19, 20}
RISK_THRESHOLDS = {
    "high_fill": 85,
    "medium_fill": 60,
    "high_overflow_hours": 6,
    "medium_overflow_hours": 18,
}

PRIORITY_ORDER = {"P1": 1, "P2": 2, "P3": 3, "P4": 4}


def compute_estimated_time_to_overflow(row):
    """Estimated hours remaining before overflow if fill rate is positive."""
    fill_rate = float(row.get("Fill_Rate", 0.0))
    current_fill = float(row.get("Current_Fill_Level", 0.0))
    if fill_rate <= 0:
        return np.inf
    return max(0, (100 - current_fill) / fill_rate)


def classify_risk(current_fill, estimated_overflow_hours):
    """Classify current urgency using transparent fill and overflow thresholds."""
    if current_fill >= RISK_THRESHOLDS["high_fill"] or estimated_overflow_hours <= RISK_THRESHOLDS["high_overflow_hours"]:
        return "High Risk"
    if current_fill >= RISK_THRESHOLDS["medium_fill"] or estimated_overflow_hours <= RISK_THRESHOLDS["medium_overflow_hours"]:
        return "Medium Risk"
    return "Low Risk"


def classify_collection_priority(risk, current_fill, estimated_overflow_hours):
    """Assign collection priority from the documented prototype rules."""
    if risk == "High Risk" and (estimated_overflow_hours <= 3 or current_fill >= 95):
        return "P1"
    if risk == "High Risk" and (estimated_overflow_hours <= 6 or current_fill >= 85):
        return "P2"
    if risk == "Medium Risk":
        return "P3"
    return "P4"


def classify_priority(score):
    if score >= 78:
        return "P1"
    elif score >= 58:
        return "P2"
    elif score >= 34:
        return "P3"
    else:
        return "P4"


def assign_priority_to_dataframe(df):
    """Return a copy of df with transparent prototype score and P1-P4 class columns."""
    output = df.copy()
    scores = []
    priorities = []
    explanations = []

    for _, row in output.iterrows():
        model_risk = str(row.get("Predicted_Risk", row.get("Risk_Level", "Low Risk")))
        current_fill = float(row["Current_Fill_Level"])
        fill_rate = float(row["Fill_Rate"])
        hist_avg = float(row["Historical_Average_Fill"])
        location = str(row.get("Location", "Unknown"))
        waste_type = str(row.get("Waste_Type", "Unknown"))
        collection_due = str(row.get("Collection_Due", "No"))
        hour = int(row.get("Hour", 0))
        t_to_overflow = compute_estimated_time_to_overflow(row)
        risk = classify_risk(current_fill, t_to_overflow)
        priority = classify_collection_priority(risk, current_fill, t_to_overflow)

        score = 0
        # Keep the existing score as explainability context; priority is rule-based above.
        score += RISK_WEIGHT.get(risk, 0)

        # Current fill urgency
        if current_fill >= 85:
            score += 35
        elif current_fill >= 70:
            score += 25
        elif current_fill >= 50:
            score += 12
        else:
            score += 4

        # Fill rate urgency
        if fill_rate >= 8:
            score += 20
        elif fill_rate >= 4:
            score += 10
        elif fill_rate >= 2:
            score += 5
        else:
            score += 2

        # Historical usage factor
        if hist_avg >= 60:
            score += 10
        elif hist_avg >= 40:
            score += 6
        else:
            score += 2

        # Location importance
        score += LOCATION_IMPORTANCE.get(location, 5)

        # Waste handling urgency
        score += WASTE_HANDLING_URGENCY.get(waste_type, 5)

        # Collection due factor
        if collection_due == "Yes":
            score += 8

        # Time of day factor: meal and rush activity increase urgency.
        if hour in MEAL_HOURS:
            score += 5

        # Estimated time until overflow
        if np.isinf(t_to_overflow):
            score += 0
        elif t_to_overflow <= 2:
            score += 20
        elif t_to_overflow <= 4:
            score += 12
        elif t_to_overflow <= 8:
            score += 6

        # Keep score bounded and understandable
        score = min(score, 100)
        output_risk = risk

        # Detailed explanation text for the dashboard and transparency.
        explanation = (
            f"{row.get('Bin_ID', 'Bin')} received {priority} because "
            f"risk={risk}, current_fill={current_fill:.1f}%, fill_rate={fill_rate:.2f}, "
            f"historical_average={hist_avg:.1f}%, location={location}, "
            f"waste_type={waste_type}, collection_due={collection_due}, "
            f"estimated_time_to_overflow={'not immediate' if np.isinf(t_to_overflow) else f'{t_to_overflow:.1f} hours'}. "
            f"Model context={model_risk}."
        )

        scores.append(score)
        priorities.append(priority)
        explanations.append(explanation)

    output["Model_Risk"] = output.get("Predicted_Risk", "Low Risk")
    output["Predicted_Risk"] = [classify_risk(float(row["Current_Fill_Level"]), compute_estimated_time_to_overflow(row)) for _, row in output.iterrows()]
    output["Priority_Score"] = scores
    output["Priority"] = priorities
    output["Priority_Explanation"] = explanations
    return output


def describe_bin_priority(row):
    """Human-readable explanation of why one bin is more urgent than another."""
    base = [
        f"Bin {row['Bin_ID']} is {row['Priority']} because the prototype score is {row['Priority_Score']:.1f}.",
        f"Risk level is {row.get('Predicted_Risk', row.get('Risk_Level', 'Low Risk'))}.",
        f"Current fill is {row['Current_Fill_Level']:.1f}%.",
        f"Fill rate is {row['Fill_Rate']:.2f}.",
        f"Historical average usage is {row['Historical_Average_Fill']:.1f}%.",
        f"Location importance is {LOCATION_IMPORTANCE.get(row.get('Location', 'Unknown'), 5)}.",
        f"Waste handling urgency is {WASTE_HANDLING_URGENCY.get(row.get('Waste_Type', 'Unknown'), 5)}.",
        f"Estimated time until overflow is {compute_estimated_time_to_overflow(row):.1f} hours.",
    ]
    return " ".join(base)
