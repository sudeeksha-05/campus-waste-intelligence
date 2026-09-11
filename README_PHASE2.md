# Phase 2: AI Prediction Component

This project continues from the simulated Phase 1 waste-bin dataset and adds a machine-learning prediction component.

## Goal

Predict the overflow risk class for a campus waste bin using a machine-learning model.

## Target Classes

- Low Risk
- Medium Risk
- High Risk

## Dataset

The dataset is the same simulated prototype dataset generated in Phase 1:

`data/smart_waste_simulated_dataset.csv`

## Models

Two models are trained and evaluated:

1. Decision Tree
2. Random Forest

The project compares the actual metrics from the test set and selects the better model according to F1-score.

## Files

- `src/train_smart_waste_model.py`: Model training, evaluation, comparison, example prediction, and model saving.
- `models/decision_tree_model.pkl`: Saved Decision Tree classifier.
- `models/random_forest_model.pkl`: Saved Random Forest classifier.
- `models/model_metrics.txt`: Saved evaluation metrics and confusion matrices.

## How to Run

```bash
python src/train_smart_waste_model.py
```

## Why Machine Learning is Suitable

Machine learning is suitable because the problem depends on multiple factors such as current fill, previous fill, fill rate, location, time, waste type, historical average, and collection schedule. These signals are difficult to interpret manually at scale, but a classifier can learn patterns from past examples.

## Current Limitation

The dataset is simulated and not field-collected. The model therefore predicts simulated risk patterns for a prototype. It cannot guarantee real-world overflow prevention or safety decisions.
