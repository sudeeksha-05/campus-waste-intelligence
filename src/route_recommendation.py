import math
import pandas as pd

# Prototype location coordinates for campus areas.
# These are only used for route ordering demonstration.
LOCATION_COORDINATES = {
    "Academic Block A": (0, 4),
    "Academic Block B": (2, 4),
    "Hostel Block 1": (3, 8),
    "Hostel Block 2": (4, 8),
    "Library": (1, 3),
    "Canteen": (5, 2),
    "Common Area": (4, 5),
    "Depot": (0, 0),
}


def haversine_distance(a, b):
    """Simple Euclidean route estimate for prototype location ordering."""
    return math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2)


def make_route_order(priority_df, start_point="Depot"):
    """Create an optional prototype route sequence from highest-priority bins.

    Input: priority_df sorted by domain scoring (priority engine output)
    Output: route order list as a demonstration sequence.
    """
    df = priority_df.copy()
    # Highest-priority bins only
    high_priority = df[df["Priority"].isin(["P1", "P2"])].copy()

    if high_priority.empty:
        return [start_point]

    # Sort by priority class and then priority score, keeping high priority first.
    high_priority = high_priority.sort_values(["Priority", "Priority_Score"], ascending=[True, False])

    # Use nearest-neighbor greedy sequence from the start location.
    route = [start_point]
    remaining = high_priority.copy()

    current = LOCATION_COORDINATES.get(start_point, (0, 0))
    while not remaining.empty:
        # Select nearest remaining location (distinct bin)
        nearest_index = None
        nearest_dist = None
        for idx, row in remaining.iterrows():
            loc = str(row["Location"])
            loc_coord = LOCATION_COORDINATES.get(loc, (0, 0))
            dist = haversine_distance(current, loc_coord)
            if nearest_dist is None or dist < nearest_dist:
                nearest_dist = dist
                nearest_index = idx

        if nearest_index is None:
            break

        selected = remaining.loc[nearest_index]
        route.append(selected["Bin_ID"])
        current = LOCATION_COORDINATES.get(selected["Location"], (0, 0))
        remaining = remaining.drop(index=nearest_index)

    # Remove repeated bins if the same bin appears because of many records in dataset.
    seen = set()
    unique_route = []
    for item in route:
        if item in seen:
            continue
        if item == start_point:
            # keep depot only once
            seen.add(item)
            unique_route.append(item)
            continue
        # add any bin only once
        seen.add(item)
        unique_route.append(item)

    # Build a route only from bins. Keep depot as start.
    return unique_route


def compare_collection_orders(priority_df):
    """Return a simple narrative overview of three collection patterns.

    Compares fixed order, priority-based order, and optional optimized order.
    """
    compare = {
        "Fixed collection order": "Follow the same service schedule for every location without ranking by urgency.",
        "Priority-based collection order": "Sort bins from highest-priority class and score first, then visit lower-urgency bins.",
        "Optional optimized route": "Use a prototype nearest-location sequence among high-priority bins to reduce unnecessary travel while keeping the ML and priority evidence transparent.",
    }
    return compare


def explain_route(reason_df):
    """Provide a human-readable explanation for the generated route sequence."""
    explanation = []
    explanation.append("This route is a prototype route recommendation only and not a municipal routing system.")
    explanation.append("The route uses the highest-priority bins and location coordinates to build a simple order.")
    explanation.append("It does not guarantee a minimum-travel route or operational vehicle feasibility.")
    explanation.append("The final collection dispatch must be reviewed by the sanitation supervisor.")
    return " ".join(explanation)
