# Phase 4: Collection Priority Engine

This project extends the existing Phase 2 ML prediction model and Phase 3 Streamlit dashboard with a transparent collection-priority engine.

## Goal

Determine which bins should be serviced first by a campus sanitation team.

The system does not sort only by current fill percentage. It combines multiple factors:

- Predicted overflow risk
- Current fill level
- Fill rate
- Historical usage
- Location importance
- Waste type
- Estimated time until overflow
- Time of day

## Prototype Scoring Design

The priority score is a classroom prototype decision-support method. It is not a scientifically validated routing or operations model.

The score is designed to be transparent and understandable:

Priority Score = Risk + Fill Urgency + Fill Rate + Historical Usage + Location Importance + Waste Handling Urgency + Collection Due + Time of Day + Estimated Overflow Time

The engine creates four service categories:

- P1 — Immediate
- P2 — High
- P3 — Normal
- P4 — Low

## Files

- `src/collection_priority_engine.py`: contains the transparent scoring rules and explanation generator.
- `app.py`: Streamlit dashboard that loads the saved model and applies the collection-priority engine.

## Example Output

1. Bin B27 — P1 — likely to overflow soon
2. Bin B14 — P1 — high fill rate
3. Bin B08 — P2 — medium risk
4. Bin B19 — P3 — low urgency

The engine also provides a simple explanation for why each bin received that priority.

## How to Run

```bash
streamlit run app.py
```
