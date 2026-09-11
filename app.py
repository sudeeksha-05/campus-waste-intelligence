import pickle
from pathlib import Path

import pandas as pd
import numpy as np
import streamlit as st
import plotly.express as px

from src.collection_priority_engine import assign_priority_to_dataframe, describe_bin_priority

DATA_FILE = Path("data/smart_waste_simulated_dataset.csv")
MODEL_FILE = Path("models/decision_tree_model.pkl")

st.set_page_config(page_title="Campus Waste Intelligence Dashboard", page_icon="♻️", layout="wide")

# -----------------------------
# Helper functions
# -----------------------------
def map_status_to_risk(status):
    if status == "No Overflow":
        return "Low Risk"
    elif status == "Likely Overflow":
        return "Medium Risk"
    else:
        return "High Risk"


def risk_to_priority(risk_label):
    if risk_label == "High Risk":
        return "Immediate"
    elif risk_label == "Medium Risk":
        return "Monitor"
    else:
        return "Normal"


def explain_prediction(row, prediction):
    # Provide human-readable explanation using the actual input values.
    current_fill = row["Current_Fill_Level"]
    fill_rate = row["Fill_Rate"]
    hist_avg = row["Historical_Average_Fill"]
    location = row["Location"]
    waste_type = row["Waste_Type"]
    collection_due = row["Collection_Due"]

    reason_parts = []
    if current_fill >= 70:
        reason_parts.append(f"its current fill level is {current_fill:.1f}%")
    if fill_rate >= 8:
        reason_parts.append("its recent fill rate is high")
    elif fill_rate >= 4:
        reason_parts.append("its recent fill rate is moderate")
    else:
        reason_parts.append("its recent fill rate is low")

    if hist_avg >= 50:
        reason_parts.append("and its historical usage is above average")
    elif hist_avg >= 30:
        reason_parts.append("and its historical usage is moderate")
    else:
        reason_parts.append("and its historical usage is below average")

    reason = ", ".join(reason_parts)

    return (
        f"Bin {row['Bin_ID']} is classified as {prediction} because "
        f"current fill level is {current_fill:.1f}%, "
        f"fill rate is {fill_rate:.2f}, "
        f"historical average is {hist_avg:.1f}%, "
        f"location is {location}, waste type is {waste_type}, "
        f"and collection due is {collection_due}. "
        f"This explanation is based on: {reason}."
    )


# -----------------------------
# Load data and model
# -----------------------------
@st.cache_resource

def load_model():
    with MODEL_FILE.open("rb") as file:
        return pickle.load(file)


@st.cache_data

def load_data():
    df = pd.read_csv(DATA_FILE)
    df["Timestamp"] = pd.to_datetime(df["Timestamp"])
    df["Risk_Level"] = df["Overflow_Status"].apply(map_status_to_risk)
    df["Priority"] = df["Risk_Level"].apply(risk_to_priority)
    return df


df = load_data()
model = load_model()

# -----------------------------
# Dashboard title and filters
# -----------------------------
st.title("Campus Waste Intelligence Dashboard")
st.markdown("Prototype collection priority engine using transparent scoring rules.")

st.sidebar.header("Filters")

locations = ["All"] + sorted(df["Location"].unique().tolist())
location_filter = st.sidebar.selectbox("Location", locations)

risk_options = ["All", "Low Risk", "Medium Risk", "High Risk"]
risk_filter = st.sidebar.selectbox("Risk Level", risk_options)

waste_types = ["All"] + sorted(df["Waste_Type"].unique().tolist())
waste_filter = st.sidebar.selectbox("Waste Type", waste_types)

start_date = st.sidebar.date_input("Start Date", min_value=df["Timestamp"].min().date(), max_value=df["Timestamp"].max().date(), value=df["Timestamp"].min().date())
end_date = st.sidebar.date_input("End Date", min_value=df["Timestamp"].min().date(), max_value=df["Timestamp"].max().date(), value=df["Timestamp"].max().date())

if start_date > end_date:
    st.sidebar.warning("Start Date must be before End Date. Please correct the filter.")

# Filter dataset by UI selections
filtered_df = df.copy()
if location_filter != "All":
    filtered_df = filtered_df[filtered_df["Location"] == location_filter]
if risk_filter != "All":
    filtered_df = filtered_df[filtered_df["Risk_Level"] == risk_filter]
if waste_filter != "All":
    filtered_df = filtered_df[filtered_df["Waste_Type"] == waste_filter]

filtered_df = filtered_df[(filtered_df["Timestamp"].dt.date >= pd.Timestamp(start_date).date()) & (filtered_df["Timestamp"].dt.date <= pd.Timestamp(end_date).date())]

# -----------------------------
# Summary cards
# -----------------------------
st.subheader("Summary")

metrics = {
    "Total bins": str(filtered_df["Bin_ID"].nunique()),
    "High-risk bins": str(filtered_df[filtered_df["Risk_Level"] == "High Risk"].shape[0]),
    "Medium-risk bins": str(filtered_df[filtered_df["Risk_Level"] == "Medium Risk"].shape[0]),
    "Low-risk bins": str(filtered_df[filtered_df["Risk_Level"] == "Low Risk"].shape[0]),
}

col1, col2, col3, col4 = st.columns(4)
with col1:
    st.metric("Total bins", metrics["Total bins"])
with col2:
    st.metric("High-risk bins", metrics["High-risk bins"])
with col3:
    st.metric("Medium-risk bins", metrics["Medium-risk bins"])
with col4:
    st.metric("Low-risk bins", metrics["Low-risk bins"])

# -----------------------------
# Monitoring table
# -----------------------------
st.subheader("Bin Monitoring Table")

# Create risk prediction on the filtered rows using the ML model.
feature_columns = [
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

# Use model directly on original row feature values
predicted = model.predict(filtered_df[feature_columns])
filtered_df["Predicted_Risk"] = predicted
filtered_df["Priority"] = filtered_df["Predicted_Risk"].apply(risk_to_priority)

# Apply collection priority engine to add transparent prototype score and priority labels.
priority_df = assign_priority_to_dataframe(filtered_df)

# Short view table
monitor_columns = [
    "Bin_ID",
    "Location",
    "Current_Fill_Level",
    "Fill_Rate",
    "Predicted_Risk",
    "Priority",
    "Priority_Score",
]

st.dataframe(
    priority_df[monitor_columns].sort_values("Priority_Score", ascending=False),
    use_container_width=True,
)

# -----------------------------
# Risk visualizations
# -----------------------------
st.subheader("Risk Visualization")

risk_counts = priority_df["Predicted_Risk"].value_counts().sort_index()
fig_risk_bar = px.bar(
    x=risk_counts.index,
    y=risk_counts.values,
    color=risk_counts.index,
    labels={"x": "Risk Level", "y": "Number of Bins"},
)

fig_risk_bar.update_layout(showlegend=False)
st.plotly_chart(fig_risk_bar, use_container_width=True)

# -----------------------------
# Campus/location analysis
# -----------------------------
st.subheader("Location Analysis")

location_avg = priority_df.groupby("Location", as_index=False)["Current_Fill_Level"].mean().sort_values("Current_Fill_Level", ascending=False)
fig_location = px.bar(
    location_avg,
    x="Location",
    y="Current_Fill_Level",
    color="Location",
    labels={"Current_Fill_Level": "Average Current Fill Level (%)"},
)
fig_location.update_layout(xaxis_tickangle=-30)
st.plotly_chart(fig_location, use_container_width=True)

# -----------------------------
# Time based analysis
# -----------------------------
st.subheader("Time-Based Fill Level Analysis")

line_df = priority_df.groupby(pd.Grouper(key="Timestamp", freq="D"), as_index=False)["Current_Fill_Level"].mean()
line_fig = px.line(
    line_df,
    x="Timestamp",
    y="Current_Fill_Level",
    labels={"Current_Fill_Level": "Average Fill Level (%)", "Timestamp": "Date"},
)
line_fig.update_layout(xaxis_title="Date", yaxis_title="Average Fill Level (%)")
st.plotly_chart(line_fig, use_container_width=True)

# -----------------------------
# High-risk section
# -----------------------------
st.subheader("High-Risk Bins Requiring Immediate Attention")

high_risk = priority_df[priority_df["Predicted_Risk"] == "High Risk"]
if high_risk.empty:
    st.info("No high-risk bins in the current filter selection.")
else:
    high_risk = high_risk[[
        "Bin_ID",
        "Location",
        "Current_Fill_Level",
        "Fill_Rate",
        "Historical_Average_Fill",
        "Waste_Type",
        "Collection_Due",
        "Predicted_Risk",
        "Priority",
        "Priority_Score",
    ]]
    # Make immediate risk more visible
    st.dataframe(high_risk.sort_values("Priority_Score", ascending=False), use_container_width=True)

# -----------------------------
# Collection priority engine: explain route order
# -----------------------------
st.subheader("Collection Priority Engine")

priority_df = assign_priority_to_dataframe(priority_df)
priority_df = priority_df.sort_values("Priority_Score", ascending=False)

priority_top = priority_df[[
    "Bin_ID",
    "Location",
    "Current_Fill_Level",
    "Fill_Rate",
    "Predicted_Risk",
    "Priority",
    "Priority_Score",
    "Priority_Explanation",
]].head(10)

st.dataframe(priority_top, use_container_width=True)

# Provide an explanation for selected top bins
if not priority_df.empty:
    st.markdown("### Why these bins are prioritized")
    for _, row in priority_df.head(5).iterrows():
        st.markdown(f"- {row['Priority_Explanation']}")

# -----------------------------
# Prediction form
# -----------------------------
st.subheader("Predict Risk for a New Bin")

with st.form("prediction_form"):
    input_location = st.selectbox("Location", sorted(df["Location"].unique().tolist()))
    input_waste_type = st.selectbox("Waste Type", sorted(df["Waste_Type"].unique().tolist()))
    input_day = st.selectbox("Day of Week", sorted(df["Day_of_Week"].unique().tolist()))
    input_hour = st.slider("Hour", 0, 23, 12)
    input_current_fill = st.slider("Current Fill Level (%)", 0, 100, 72)
    input_previous_fill = st.slider("Previous Fill Level (%)", 0, 100, 68)
    input_fill_rate = st.slider("Fill Rate", 0.0, 20.0, 8.5, step=0.1)
    input_hist_avg = st.slider("Historical Average Fill (%)", 0, 100, 60)
    input_collection_due = st.selectbox("Collection Due", ["Yes", "No"])

    submitted = st.form_submit_button("Predict Risk")

if submitted:
    new_bin = pd.DataFrame([
        {
            "Current_Fill_Level": input_current_fill,
            "Previous_Fill_Level": input_previous_fill,
            "Fill_Rate": input_fill_rate,
            "Day_of_Week": input_day,
            "Hour": input_hour,
            "Waste_Type": input_waste_type,
            "Historical_Average_Fill": input_hist_avg,
            "Collection_Due": input_collection_due,
            "Location": input_location,
        }
    ])

    predicted_risk = model.predict(new_bin)[0]

    st.success(f"Predicted Risk: {predicted_risk}")

    # Custom explanation for every prediction
    explanation = explain_prediction(
        pd.Series({
            "Bin_ID": "New Bin",
            "Current_Fill_Level": input_current_fill,
            "Fill_Rate": input_fill_rate,
            "Historical_Average_Fill": input_hist_avg,
            "Location": input_location,
            "Waste_Type": input_waste_type,
            "Collection_Due": input_collection_due,
            "Risk_Level": predicted_risk,
        }),
        predicted_risk,
    )
    st.info(explanation)

# -----------------------------
# Phase 7 Conversational Interface
# -----------------------------
st.subheader("Ask the Waste Assistant")

question = st.text_input("Ask about bins, policy, location, or waste handling:", value="Which bins need immediate collection?")

if st.button("Ask Assistant"):
    from src.conversation_interface import process_user_question
    answer = process_user_question(question)
    st.markdown("### Assistant Answer")
    st.write(answer)

# -----------------------------
# Footer / notes
# -----------------------------
st.markdown("---")
st.markdown("""
This dashboard uses a simulated prototype campus waste dataset.
It is intended for classroom demonstration and campus waste management planning.
""")
