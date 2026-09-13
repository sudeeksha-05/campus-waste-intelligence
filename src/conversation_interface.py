"""AI Waste Assistant Coordinator for Campus Waste Intelligence
Configured for Spoorthy Engineering College prototype.

Orchestrates:
1. Current Bin Data & ML Risk Predictions & Priority Scoring Engine
2. Local RAG Knowledge Base
3. Combined Queries (ML/Data + RAG)
4. Multi-turn conversation context tracking (Bin IDs, waste types, pronouns)
"""

import re
import sys
import pickle
from pathlib import Path
from typing import Optional, List, Dict, Any, Tuple
import pandas as pd
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
if not (ROOT / "data").exists():
    ROOT = Path(r"C:\Users\alapa\Desktop\aicte")
sys.path.insert(0, str(ROOT / "src"))

from agent_workflow import predict_bin_risk
from collection_priority_engine import assign_priority_to_dataframe, compute_estimated_time_to_overflow
import rag_knowledge

DATA_FILE = ROOT / "data" / "smart_waste_simulated_dataset.csv"
MODEL_FILE = ROOT / "models" / "decision_tree_model.pkl"

BIN_ID_REGEX = re.compile(r"\b([A-Za-z0-9]+-[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*)\b")

WASTE_KEYWORDS = {
    "plastic": "Plastic",
    "pet": "Plastic",
    "bottle": "Plastic",
    "e-waste": "E-Waste",
    "ewaste": "E-Waste",
    "electronic": "E-Waste",
    "battery": "Battery",
    "batteries": "Battery",
    "organic": "Organic",
    "food": "Organic",
    "compost": "Organic",
    "paper": "Paper",
    "cardboard": "Paper",
    "hazardous": "Hazardous",
    "chemical": "Hazardous",
    "mixed": "Mixed",
}

DISPOSAL_KEYWORDS = [
    "how should", "how to", "how do we", "how can", "disposed", "disposal",
    "handled", "handling", "manage", "management", "guidelines", "protocol",
    "rule", "rules", "policy", "segregate", "segregation"
]


def get_latest_scored_data() -> pd.DataFrame:
    """Retrieve the latest sensor record per unique Bin_ID with ML predictions and priority scoring."""
    try:
        df = pd.read_csv(DATA_FILE)
        df["Timestamp"] = pd.to_datetime(df["Timestamp"], errors="coerce")
        df["Day_of_Week"] = df["Timestamp"].dt.strftime("%A")

        with open(MODEL_FILE, "rb") as f:
            model = pickle.load(f)

        latest_df = (
            df.sort_values(["Bin_ID", "Timestamp"])
            .drop_duplicates(subset=["Bin_ID"], keep="last")
            .reset_index(drop=True)
        )
        predicted_df = predict_bin_risk(latest_df, model)
        scored_df = assign_priority_to_dataframe(predicted_df)
        scored_df["Est_Overflow_Hours"] = scored_df.apply(compute_estimated_time_to_overflow, axis=1)
        return scored_df
    except Exception as e:
        print(f"Error loading scored data: {e}")
        return pd.DataFrame()


BIN_ID_REGEX = re.compile(r"\b([A-Za-z0-9]+-[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*)\b")
BIN_PREFIX_REGEX = re.compile(r"\b(?:bin|bins)\s+([A-Za-z0-9-]+)\b", re.IGNORECASE)
RESERVED_WORDS = {"ML", "RAG", "AI", "GPS", "IOT", "RISK", "DATA", "MODEL", "COLLECTION", "WASTE", "PAGE", "CAMPUS"}

def _clean_bin_candidate(candidate: str) -> Optional[str]:
    cand = candidate.strip().upper()
    if cand not in RESERVED_WORDS and len(cand) >= 2:
        return cand
    return None


def extract_entities(question: str, history: Optional[List[Dict[str, Any]]] = None) -> Tuple[Optional[str], Optional[str]]:
    """Extract target Bin ID and waste type from current question and conversation history."""
    q_bin = None
    m = BIN_ID_REGEX.search(question)
    if m:
        q_bin = _clean_bin_candidate(m.group(1))

    if not q_bin:
        m2 = BIN_PREFIX_REGEX.search(question)
        if m2:
            q_bin = _clean_bin_candidate(m2.group(1))

    q_waste = None
    q_lower = question.lower()
    for kw, wtype in WASTE_KEYWORDS.items():
        if re.search(rf"\b{re.escape(kw)}\b", q_lower):
            q_waste = wtype
            break

    # If no bin found directly, check for reference pronouns in question and resolve from history
    has_pronoun = bool(re.search(r"\b(it|this bin|that bin|the bin|its|that waste|its waste|this waste)\b", q_lower))
    if (not q_bin or not q_waste) and history:
        for msg in reversed(history):
            text = msg.get("text", "")
            if not q_bin and has_pronoun:
                hist_m = BIN_ID_REGEX.search(text)
                if hist_m:
                    q_bin = _clean_bin_candidate(hist_m.group(1))
                if not q_bin:
                    hist_m2 = BIN_PREFIX_REGEX.search(text)
                    if hist_m2:
                        q_bin = _clean_bin_candidate(hist_m2.group(1))
            if not q_waste:
                text_lower = text.lower()
                for kw, wtype in WASTE_KEYWORDS.items():
                    if re.search(rf"\b{re.escape(kw)}\b", text_lower):
                        q_waste = wtype
                        break
            if q_bin and q_waste:
                break

    return q_bin, q_waste


def handle_risk_analysis(question: str, df: pd.DataFrame) -> str:
    """Answer questions regarding bin risk counts and risk distribution."""
    total_bins = len(df)
    if total_bins == 0:
        return "Unable to retrieve current bin information."

    high_risk_df = df[df["Predicted_Risk"] == "High Risk"]
    medium_risk_df = df[df["Predicted_Risk"] == "Medium Risk"]
    low_risk_df = df[df["Predicted_Risk"] == "Low Risk"]

    high_count = len(high_risk_df)
    med_count = len(medium_risk_df)
    low_count = len(low_risk_df)

    q_lower = question.lower()
    is_count_query = any(w in q_lower for w in ["how many", "count", "number of", "total high"])

    if is_count_query:
        top_locations = (
            high_risk_df.groupby("Location")["Bin_ID"]
            .count()
            .sort_values(ascending=False)
            .head(3)
        )
        loc_str = ", ".join(f"{loc} ({cnt} bins)" for loc, cnt in top_locations.items())

        return (
            f"### Campus Risk Count Analysis\n\n"
            f"There are **{high_count} high-risk bins** currently across Spoorthy Engineering College "
            f"(out of **{total_bins}** total monitored physical bins).\n\n"
            f"**Current Risk Breakdown:**\n"
            f"• **High Risk:** {high_count} bins ({high_count / total_bins * 100:.1f}%) — urgent attention recommended\n"
            f"• **Medium Risk:** {med_count} bins ({med_count / total_bins * 100:.1f}%) — fill levels advancing\n"
            f"• **Low Risk:** {low_count} bins ({low_count / total_bins * 100:.1f}%) — standard operational status\n\n"
            f"**Highest Risk Concentrations:** {loc_str}.\n\n"
            f"• **Recommended Action:** Recommended for immediate collection. Human sanitation supervisor must verify final dispatch."
        )

    # Listing high-risk bins
    sorted_high = high_risk_df.sort_values("Priority_Score", ascending=False)
    lines = [
        f"### High-Risk Bins ({high_count} Bins Identified)",
        f"Based on latest sensor telemetry and the ML prediction model, **{high_count} of {total_bins} bins** are classified as **High Risk**:\n",
    ]

    # Show top 8 most urgent high-risk bins
    for _, row in sorted_high.head(8).iterrows():
        est_str = f"{row['Est_Overflow_Hours']:.1f}h" if np.isfinite(row["Est_Overflow_Hours"]) else "N/A"
        lines.append(
            f"• **{row['Bin_ID']}** ({row['Location']})\n"
            f"  - Waste: {row['Waste_Type']} | Fill: {row['Current_Fill_Level']:.1f}% | Rate: {row['Fill_Rate']:.2f}%/hr\n"
            f"  - Priority: {row['Priority']} (Score: {row['Priority_Score']:.1f}) | Est. Overflow: {est_str}"
        )

    remaining = high_count - 8
    if remaining > 0:
        other_bins = ", ".join(sorted_high.iloc[8:]["Bin_ID"].tolist())
        lines.append(f"\n*Additional {remaining} High-Risk Bins:* {other_bins}")

    lines.append("\n• **Operational Note:** Recommended for immediate collection. Human sanitation supervisor must verify final dispatch.")
    return "\n".join(lines)


def handle_collection_priority(question: str, df: pd.DataFrame) -> str:
    """Answer questions regarding collection priorities and immediate collection needs."""
    if df.empty:
        return "Unable to retrieve current bin information."

    p1_bins = df[df["Priority"] == "P1"]
    p2_bins = df[df["Priority"] == "P2"]

    sorted_df = df.sort_values("Priority_Score", ascending=False)
    top_bins = sorted_df.head(6)

    lines = [
        "### Immediate Collection Recommended",
        f"The Collection Priority Engine has identified **{len(p1_bins)} bins** requiring immediate collection (**P1**) "
        f"and **{len(p2_bins)} bins** requiring high priority collection (**P2**).\n",
        "**Top Priority Bins for Immediate Collection:**"
    ]

    for _, row in top_bins.iterrows():
        est_str = f"{row['Est_Overflow_Hours']:.1f}h" if np.isfinite(row["Est_Overflow_Hours"]) else "N/A"
        lines.append(
            f"• **{row['Bin_ID']}** — {row['Location']}\n"
            f"  - Priority: **{row['Priority']}** (Score: {row['Priority_Score']:.1f}) | Risk: {row['Predicted_Risk']}\n"
            f"  - Current Fill: {row['Current_Fill_Level']:.1f}% | Rate: {row['Fill_Rate']:.2f}%/hr\n"
            f"  - Waste Type: {row['Waste_Type']} | Est. Time to Overflow: {est_str}"
        )

    lines.append("\n• **Operational Protocol:** Recommended for immediate collection. Final dispatch order requires human supervisor authorization.")
    return "\n".join(lines)


def handle_bin_explanation(question: str, bin_id: str, df: pd.DataFrame) -> str:
    """Explain why a specific bin has its particular risk and priority status."""
    if df.empty:
        return "Unable to retrieve current bin information."

    match = df[df["Bin_ID"].str.upper() == bin_id.upper()]
    if match.empty:
        return f"Information unavailable: Bin **{bin_id}** was not found in the current campus telemetry."

    row = match.iloc[0]
    est_str = f"{row['Est_Overflow_Hours']:.1f} hours" if np.isfinite(row["Est_Overflow_Hours"]) else "Not imminent"
    pred_risk = row["Predicted_Risk"]
    priority = row["Priority"]
    fill = row["Current_Fill_Level"]
    fill_rate = row["Fill_Rate"]
    hist_avg = row["Historical_Average_Fill"]
    score = row["Priority_Score"]
    loc = row["Location"]
    wtype = row["Waste_Type"]

    q_lower = question.lower()
    # Check if user assumed High Risk but bin is actually Medium or Low Risk
    clarification = ""
    if "high risk" in q_lower and pred_risk != "High Risk":
        clarification = f"**Telemetry Clarification:** Bin **{bin_id}** is currently classified as **{pred_risk}** (Priority **{priority}**, Score: **{score:.1f}/100**), not High Risk.\n\n"

    # Explain decision factors
    if pred_risk == "High Risk":
        rationale = (
            f"The Decision Tree ML model and priority engine classify **{bin_id}** as **High Risk ({priority})** because "
            f"its current fill level ({fill:.1f}%) exceeds or nears capacity with an active fill rate of {fill_rate:.2f}%/hr, "
            f"and its estimated time to overflow is {est_str}."
        )
    elif pred_risk == "Medium Risk":
        rationale = (
            f"The Decision Tree ML model classifies **{bin_id}** as **Medium Risk ({priority})** because "
            f"its fill level ({fill:.1f}%) is below the critical 85% overflow threshold, and overflow is not imminent "
            f"(estimated {est_str} remaining). However, active fill rate ({fill_rate:.2f}%/hr) warrants continued monitoring."
        )
    else:
        rationale = (
            f"The Decision Tree ML model classifies **{bin_id}** as **Low Risk ({priority})** because "
            f"its current fill level ({fill:.1f}%) is well within safe capacity and its historical average ({hist_avg:.1f}%) is low."
        )

    return (
        f"### Risk & Priority Assessment: Bin {bin_id}\n\n"
        f"{clarification}"
        f"**Model Evidence & Telemetry Factors:**\n"
        f"• **Current Fill Level:** {fill:.1f}%\n"
        f"• **Fill Rate:** {fill_rate:.2f}% / hr\n"
        f"• **Historical Average Fill:** {hist_avg:.1f}%\n"
        f"• **Estimated Time to Overflow:** {est_str}\n"
        f"• **Location:** {loc}\n"
        f"• **Waste Type:** {wtype}\n"
        f"• **Predicted Risk:** {pred_risk}\n"
        f"• **Priority Level:** {priority} (Score: {score:.1f} / 100)\n\n"
        f"**Decision Rationale:**\n{rationale}\n\n"
        f"• **Recommended Action:** {'Recommended for immediate collection.' if priority in ['P1', 'P2'] else 'Routine monitoring. Collection scheduled per standard cycle.'}"
    )


def handle_bin_priority(question: str, bin_id: str, df: pd.DataFrame) -> str:
    """Return priority level, score, and factors for a specific bin."""
    if df.empty:
        return "Unable to retrieve current bin information."

    match = df[df["Bin_ID"].str.upper() == bin_id.upper()]
    if match.empty:
        return f"Information unavailable: Bin **{bin_id}** was not found in the current campus telemetry."

    row = match.iloc[0]
    est_str = f"{row['Est_Overflow_Hours']:.1f} hours" if np.isfinite(row["Est_Overflow_Hours"]) else "Not imminent"

    return (
        f"### Priority Status: Bin {bin_id}\n\n"
        f"• **Priority Level:** **{row['Priority']}** (Priority Score: **{row['Priority_Score']:.1f} / 100**)\n"
        f"• **Predicted Risk:** {row['Predicted_Risk']}\n"
        f"• **Location:** {row['Location']}\n"
        f"• **Waste Type:** {row['Waste_Type']}\n"
        f"• **Current Fill Level:** {row['Current_Fill_Level']:.1f}%\n"
        f"• **Fill Rate:** {row['Fill_Rate']:.2f}% / hr\n"
        f"• **Estimated Time to Overflow:** {est_str}\n\n"
        f"• **Operational Status:** {'Recommended for immediate collection.' if row['Priority'] in ['P1', 'P2'] else 'Scheduled collection cycle.'}"
    )


def handle_bin_waste_type(bin_id: str, df: pd.DataFrame) -> str:
    """Answer what type of waste is contained in a specific bin."""
    if df.empty:
        return "Unable to retrieve current bin information."

    match = df[df["Bin_ID"].str.upper() == bin_id.upper()]
    if match.empty:
        return f"Information unavailable: Bin **{bin_id}** was not found in the current campus telemetry."

    row = match.iloc[0]
    wtype = row["Waste_Type"]
    return (
        f"### Bin Telemetry: {bin_id}\n\n"
        f"Bin **{bin_id}** (located in **{row['Location']}**) contains **{wtype}** waste.\n\n"
        f"• **Current Fill Level:** {row['Current_Fill_Level']:.1f}%\n"
        f"• **Predicted Risk:** {row['Predicted_Risk']}\n"
        f"• **Priority:** {row['Priority']} (Score: {row['Priority_Score']:.1f})\n\n"
        f"*Tip: You can ask 'How should that waste be handled?' to view handling and segregation protocols.*"
    )


def handle_location_analysis(df: pd.DataFrame) -> str:
    """Analyze which campus zone needs immediate attention."""
    if df.empty:
        return "Unable to retrieve current bin information."

    loc_summary = df.groupby("Location").agg(
        avg_fill=("Current_Fill_Level", "mean"),
        high_risk_count=("Predicted_Risk", lambda x: (x == "High Risk").sum()),
        total_bins=("Bin_ID", "count"),
    ).sort_values("avg_fill", ascending=False)

    top_loc = loc_summary.index[0]
    top_row = loc_summary.iloc[0]

    lines = [
        "### Campus Location Attention Analysis\n",
        f"The campus location requiring the most immediate attention is **{top_loc}** with an average fill level of "
        f"**{top_row['avg_fill']:.1f}%** and **{int(top_row['high_risk_count'])} of {int(top_row['total_bins'])} bins** at High Risk.\n",
        "**Campus Location Breakdown:**"
    ]

    for loc, row in loc_summary.iterrows():
        pct_high = (row["high_risk_count"] / row["total_bins"]) * 100
        lines.append(
            f"• **{loc}**: Avg Fill **{row['avg_fill']:.1f}%** | High-Risk Bins: **{int(row['high_risk_count'])}/{int(row['total_bins'])}** ({pct_high:.0f}%)"
        )

    lines.append(
        f"\n• **Recommendation:** Dispatch primary collection rounds to **{top_loc}** first to clear accumulated food/organic waste and avoid overflow."
    )
    return "\n".join(lines)


def handle_overflow_status(question: str, df: pd.DataFrame) -> str:
    """Answer questions regarding closest to overflow or highest fill levels."""
    if df.empty:
        return "Unable to retrieve current bin information."

    q_lower = question.lower()
    if "fill" in q_lower or "fullest" in q_lower:
        top_fill = df.sort_values("Current_Fill_Level", ascending=False).head(5)
        lines = [
            "### Bins with Highest Fill Level\n",
            "The bins with the highest current fill levels are:"
        ]
        for _, row in top_fill.iterrows():
            est_str = f"{row['Est_Overflow_Hours']:.1f}h" if np.isfinite(row["Est_Overflow_Hours"]) else "N/A"
            lines.append(
                f"• **{row['Bin_ID']}** ({row['Location']}): Fill **{row['Current_Fill_Level']:.1f}%** | "
                f"Rate: {row['Fill_Rate']:.2f}%/hr | Risk: {row['Predicted_Risk']} | Est. Overflow: {est_str}"
            )
        lines.append("\n• **Recommendation:** Recommended for immediate collection.")
        return "\n".join(lines)

    # Closest to overflow
    overflow_sorted = df.sort_values("Est_Overflow_Hours", ascending=True)
    full_bins = overflow_sorted[overflow_sorted["Est_Overflow_Hours"] == 0]
    critical_bins = overflow_sorted[overflow_sorted["Est_Overflow_Hours"] > 0].head(5)

    lines = ["### Overflow Urgency Telemetry\n"]
    if not full_bins.empty:
        full_ids = ", ".join(full_bins["Bin_ID"].tolist())
        lines.append(f"**Currently Full / At Capacity (0.0h remaining):**\n• {full_ids}\n")

    lines.append("**Bins Closest to Reaching Overflow:**")
    for _, row in critical_bins.iterrows():
        lines.append(
            f"• **{row['Bin_ID']}** ({row['Location']}): Est. Overflow in **{row['Est_Overflow_Hours']:.1f} hours** "
            f"(Fill: {row['Current_Fill_Level']:.1f}%, Rate: {row['Fill_Rate']:.2f}%/hr, Risk: {row['Predicted_Risk']})"
        )

    lines.append("\n• **Operational Note:** Recommended for immediate collection to prevent overflow.")
    return "\n".join(lines)


def handle_combined_query(question: str, df: pd.DataFrame, target_waste: Optional[str]) -> str:
    """Handle queries requiring both current bin data and RAG waste handling guidance."""
    if df.empty:
        return "Unable to retrieve current bin information."

    waste_type_filter = target_waste or "Plastic"
    high_risk_waste_bins = df[
        (df["Predicted_Risk"] == "High Risk") &
        (df["Waste_Type"].str.lower() == waste_type_filter.lower())
    ]

    rag_guidance = rag_knowledge.get_guidance_for_topic(waste_type_filter) or rag_knowledge.answer_question(question)

    lines = [
        f"### High-Risk {waste_type_filter} Bins & Disposal Guidance\n",
        f"**Current High-Risk {waste_type_filter} Bins ({len(high_risk_waste_bins)} Bins Identified):**"
    ]

    if high_risk_waste_bins.empty:
        lines.append(f"• No {waste_type_filter} bins are currently predicted as High Risk.")
    else:
        for _, row in high_risk_waste_bins.iterrows():
            est_str = f"{row['Est_Overflow_Hours']:.1f}h" if np.isfinite(row["Est_Overflow_Hours"]) else "N/A"
            lines.append(
                f"• **{row['Bin_ID']}** — {row['Location']} | Fill: **{row['Current_Fill_Level']:.1f}%** | "
                f"Rate: {row['Fill_Rate']:.2f}%/hr | Priority: {row['Priority']} (Score: {row['Priority_Score']:.1f}) | Est. Overflow: {est_str}"
            )

    lines.append("\n" + rag_guidance)
    lines.append("\n• **Operational Protocol:** Recommended for immediate collection. Human sanitation supervisor must verify final dispatch.")
    return "\n".join(lines)


def process_user_question(question: str, history: Optional[List[Dict[str, Any]]] = None) -> str:
    """Coordinator Agent: Routes question to appropriate source and builds grounded answer."""
    if not question or not question.strip():
        return "Please ask a question about campus waste, bin telemetry, risk predictions, or waste handling guidelines."

    q = question.strip()
    q_lower = q.lower()

    # 1. Extract context entities (target bin, target waste type)
    target_bin, target_waste = extract_entities(q, history)

    # 2. Check if this is a follow-up asking for waste type of a bin
    if target_bin and any(phrase in q_lower for phrase in ["what type of waste", "what kind of waste", "what waste", "waste in it", "waste type"]):
        df = get_latest_scored_data()
        return handle_bin_waste_type(target_bin, df)

    # 3. Check if this is a follow-up asking how that waste should be handled
    if any(phrase in q_lower for phrase in ["that waste", "its waste", "this waste", "the waste"]) and any(w in q_lower for w in ["handled", "handle", "disposed", "dispose", "managed", "manage"]):
        # If we have target_bin but not target_waste, lookup target_bin's waste type
        df = get_latest_scored_data()
        if target_bin and not target_waste and not df.empty:
            match = df[df["Bin_ID"].str.upper() == target_bin.upper()]
            if not match.empty:
                target_waste = match.iloc[0]["Waste_Type"]
        if target_waste:
            guidance = rag_knowledge.get_guidance_for_topic(target_waste) or rag_knowledge.answer_question(f"How should {target_waste} waste be handled?")
            return f"### {target_waste} Waste Handling Guidance\n\n{guidance}"

    # 4. Check for COMBINED query: asks about bins/collection AND waste handling
    has_bin_context = any(w in q_lower for w in ["bin", "bins", "collection", "high risk", "priority"])
    has_guidance_context = any(w in q_lower for w in DISPOSAL_KEYWORDS) or bool(target_waste)
    if has_bin_context and (("how" in q_lower and ("handled" in q_lower or "disposed" in q_lower or "manage" in q_lower)) or "contain" in q_lower and "how" in q_lower):
        df = get_latest_scored_data()
        return handle_combined_query(q, df, target_waste)

    # 5. Check for BIN_EXPLANATION: "Why is [bin]...", "Explain [bin]..."
    if target_bin and (any(w in q_lower for w in ["why", "explain", "reason", "cause"]) or ("high" in q_lower and "priority" in q_lower)):
        df = get_latest_scored_data()
        return handle_bin_explanation(q, target_bin, df)

    # 6. Check for BIN_PRIORITY: "What is the priority of [bin]..."
    if target_bin and "priority" in q_lower:
        df = get_latest_scored_data()
        return handle_bin_priority(q, target_bin, df)

    # 7. Check for general single-bin inquiry: "Tell me about HB1-02", "Status of CAN-03"
    if target_bin and any(w in q_lower for w in ["status", "details", "tell me about", "info on"]):
        df = get_latest_scored_data()
        return handle_bin_explanation(q, target_bin, df)

    # 8. Check for RISK_ANALYSIS: "How many bins are high risk?", "Which bins are high risk?"
    if "risk" in q_lower and ("high" in q_lower or "medium" in q_lower or "low" in q_lower or "count" in q_lower or "how many" in q_lower or "distribution" in q_lower or "breakdown" in q_lower):
        df = get_latest_scored_data()
        return handle_risk_analysis(q, df)

    # 9. Check for OVERFLOW & FILL LEVEL: "Which bin is closest to overflow?", "highest fill level", "likely to overflow"
    if any(w in q_lower for w in ["overflow", "overflowing"]) or any(phrase in q_lower for phrase in ["highest fill", "fullest bin", "fill level"]):
        df = get_latest_scored_data()
        return handle_overflow_status(q, df)

    # 10. Check for COLLECTION_PRIORITY: "Which bins need immediate collection?", "Which bins should we collect now?"
    is_guidance_query = any(topic in q_lower for topic in ["e-waste", "ewaste", "battery", "batteries", "hazardous", "chemical"]) and any(w in q_lower for w in ["do with", "handle", "dispose", "what should", "guidance"])
    if not is_guidance_query and (any(w in q_lower for w in ["collect", "collection"]) or any(phrase in q_lower for phrase in ["immediate collection", "need immediate", "collect first", "priority bins", "collection priority", "which bins should be collected", "collection order"])):
        df = get_latest_scored_data()
        return handle_collection_priority(q, df)

    # 11. Check for LOCATION_ANALYSIS: "Which location needs attention?", "Which area needs attention first?"
    if ("location" in q_lower or "area" in q_lower or "block" in q_lower or "zone" in q_lower) and any(w in q_lower for w in ["attention", "most waste", "highest waste", "which", "where", "first"]):
        df = get_latest_scored_data()
        return handle_location_analysis(df)

    # 12. Check for RAG WASTE_GUIDANCE: Questions on how to handle/dispose of specific waste types or policies
    guidance_topics = ["plastic", "pet", "e-waste", "ewaste", "battery", "batteries", "organic", "food waste", "paper", "cardboard", "hazardous", "chemical", "segregation", "segregate", "policy", "guidelines", "rules"]
    if any(topic in q_lower for topic in guidance_topics):
        # Retrieve from local RAG knowledge base
        return rag_knowledge.answer_question(q)

    # 13. General fallback
    return (
        "### AI Waste Assistant — Spoorthy Engineering College\n\n"
        "I can assist you with real-time telemetry analysis, ML predictions, and waste guidelines. You can ask:\n\n"
        "• **Bin Urgency:** *'Which bins need immediate collection?'* or *'Which bin is closest to overflow?'*\n"
        "• **Risk Analysis:** *'How many bins are high risk?'* or *'Which bins are high risk?'*\n"
        "• **Model Explanations:** *'Why is HB1-02 high risk?'* or *'What is the priority of HB1-02?'*\n"
        "• **Location Insights:** *'Which location needs attention?'*\n"
        "• **Waste Guidance (RAG):** *'How should plastic waste be handled?'* or *'How should e-waste be disposed of?'*\n"
        "• **Combined Analysis:** *'Which high-risk bins contain plastic waste and how should it be handled?'*"
    )
