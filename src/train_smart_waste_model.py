import pickle
from pathlib import Path

import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder
from sklearn.tree import DecisionTreeClassifier

DATA_FILE = Path("data/smart_waste_simulated_dataset.csv")
MODEL_DIR = Path("models")
MODEL_DIR.mkdir(parents=True, exist_ok=True)

# Output files
DECISION_TREE_MODEL = MODEL_DIR / "decision_tree_model.pkl"
RANDOM_FOREST_MODEL = MODEL_DIR / "random_forest_model.pkl"
METRICS_FILE = MODEL_DIR / "model_metrics.txt"

# -----------------------------
# Load dataset
# -----------------------------
df = pd.read_csv(DATA_FILE)

print(f"Loaded dataset rows: {len(df)}")
print(f"Columns: {list(df.columns)}")
print(df.head())

# -----------------------------
# Inspect data
# -----------------------------
print("\nMissing values:")
print(df.isna().sum())

# -----------------------------
# Handle missing values if any
# -----------------------------
for column in df.columns:
    if df[column].isna().sum() > 0:
        if df[column].dtype == "object":
            df[column] = df[column].fillna("Unknown")
        else:
            df[column] = df[column].fillna(df[column].median())

# -----------------------------
# Select meaningful prediction features
# -----------------------------
# Keep all numeric and category columns that are useful for local collection decisions.
def create_target(value):
    if value == "No Overflow":
        return "Low Risk"
    elif value == "Likely Overflow":
        return "Medium Risk"
    else:
        return "High Risk"

# Convert the original overflow simulation label into three classes
# as requested by Phase 2.
df["Risk_Level"] = df["Overflow_Status"].map({
    "No Overflow": "Low Risk",
    "Likely Overflow": "Medium Risk",
    "Overflowed": "High Risk",
})

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

# Ensure categories are valid
X = df[feature_columns]
y = df["Risk_Level"]

# -----------------------------
# Encode categorical variables appropriately
# -----------------------------
# One-hot encode object columns. Day_of_Week and collection status become categorical features.
numeric_features = [
    "Current_Fill_Level",
    "Previous_Fill_Level",
    "Fill_Rate",
    "Hour",
    "Historical_Average_Fill",
]

categorical_features = [
    "Day_of_Week",
    "Waste_Type",
    "Collection_Due",
    "Location",
]

preprocess = ColumnTransformer(
    transformers=[
        ("num", "passthrough", numeric_features),
        ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), categorical_features),
    ]
)

# -----------------------------
# Split into train and test
# -----------------------------
X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42,
    stratify=y,
)

# -----------------------------
# Build models
# -----------------------------
models = {
    "Decision Tree": DecisionTreeClassifier(random_state=42, max_depth=6, min_samples_leaf=5),
    "Random Forest": RandomForestClassifier(n_estimators=60, random_state=42, max_depth=8, min_samples_leaf=3),
}

results = {}

for name, model in models.items():
    pipe = Pipeline(
        steps=[
            ("preprocess", preprocess),
            ("classifier", model),
        ]
    )

    pipe.fit(X_train, y_train)
    y_pred = pipe.predict(X_test)

    # Metrics
    acc = accuracy_score(y_test, y_pred)
    prec = precision_score(y_test, y_pred, average="weighted", zero_division=0)
    rec = recall_score(y_test, y_pred, average="weighted", zero_division=0)
    f1 = f1_score(y_test, y_pred, average="weighted", zero_division=0)
    cm = confusion_matrix(y_test, y_pred, labels=["Low Risk", "Medium Risk", "High Risk"])

    results[name] = {
        "model": pipe,
        "accuracy": acc,
        "precision": prec,
        "recall": rec,
        "f1": f1,
        "confusion_matrix": cm,
    }

    print(f"\n{name} results:")
    print(f"Accuracy: {acc:.4f}")
    print(f"Precision: {prec:.4f}")
    print(f"Recall: {rec:.4f}")
    print(f"F1-score: {f1:.4f}")
    print("Confusion Matrix:")
    print(cm)
    print(classification_report(y_test, y_pred))

# -----------------------------
# Select better model
# -----------------------------
best_name = max(results, key=lambda name: results[name]["f1"])
best_model = results[best_name]["model"]

print(f"\nBest model selected by F1-score: {best_name}")

# -----------------------------
# Save trained model and metrics
# -----------------------------
if best_name == "Decision Tree":
    pickle.dump(best_model, open(DECISION_TREE_MODEL, "wb"))
else:
    pickle.dump(best_model, open(RANDOM_FOREST_MODEL, "wb"))

# save all model artifacts
pickle.dump(results["Decision Tree"]["model"], open(DECISION_TREE_MODEL, "wb"))
pickle.dump(results["Random Forest"]["model"], open(RANDOM_FOREST_MODEL, "wb"))

metrics_text = []
for name in results:
    metrics_text.append(f"{name}:")
    metrics_text.append(f"Accuracy={results[name]['accuracy']:.4f}")
    metrics_text.append(f"Precision={results[name]['precision']:.4f}")
    metrics_text.append(f"Recall={results[name]['recall']:.4f}")
    metrics_text.append(f"F1-score={results[name]['f1']:.4f}")
    metrics_text.append(f"ConfusionMatrix={results[name]['confusion_matrix'].tolist()}")
    metrics_text.append("")

metrics_text.append(f"BestModel={best_name}")
METRICS_FILE.write_text("\n".join(metrics_text), encoding="utf-8")

# -----------------------------
# Example predictions for new bins
# -----------------------------
example = pd.DataFrame([
    {
        "Current_Fill_Level": 72,
        "Previous_Fill_Level": 64,
        "Fill_Rate": 8.5,
        "Day_of_Week": "Monday",
        "Hour": 12,
        "Waste_Type": "Mixed",
        "Historical_Average_Fill": 68,
        "Collection_Due": "Yes",
        "Location": "Canteen",
    },
    {
        "Current_Fill_Level": 50,
        "Previous_Fill_Level": 44,
        "Fill_Rate": 2.9,
        "Day_of_Week": "Friday",
        "Hour": 15,
        "Waste_Type": "Paper",
        "Historical_Average_Fill": 41,
        "Collection_Due": "No",
        "Location": "Academic Block A",
    },
], columns=feature_columns)

example_predictions = best_model.predict(example)
print("\nExample predictions:")
for idx, pred in enumerate(example_predictions):
    print(f"Example bin {idx + 1}: risk = {pred}")

    row = example.iloc[idx]
    print("  Explanation:")
    print(f"    Current fill = {row['Current_Fill_Level']}%")
    print(f"    Fill rate = {row['Fill_Rate']}")
    print(f"    Historical average fill = {row['Historical_Average_Fill']}%")
    print(f"    Location = {row['Location']}")
    print(f"    Waste type = {row['Waste_Type']}")
    print(f"    Collection_due = {row['Collection_Due']}")
    print(f"    Predicted risk = {pred}")

print("\nModel training and evaluation complete.")
