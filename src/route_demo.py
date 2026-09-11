import pickle
import pandas as pd
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent))

from route_recommendation import make_route_order, compare_collection_orders, explain_route
from collection_priority_engine import assign_priority_to_dataframe
from agent_workflow import load_datasets_and_model, predict_bin_risk


df, model = load_datasets_and_model()
scored = assign_priority_to_dataframe(predict_bin_risk(df, model))
route = make_route_order(scored, start_point="Depot")
print("Route:", " -> ".join(route[:10]))
print("\nCollection order comparisons:")
for key, val in compare_collection_orders(scored).items():
    print(f"- {key}: {val}")
print("\nRoute explanation:", explain_route(scored))
