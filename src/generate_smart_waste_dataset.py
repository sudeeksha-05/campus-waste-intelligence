import csv
import random
from datetime import datetime, timedelta
from pathlib import Path

random.seed(42)

OUTPUT_DIR = Path("data")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_FILE = OUTPUT_DIR / "smart_waste_simulated_dataset.csv"

# -----------------------------
# Simulated campus locations
# -----------------------------
locations = {
    "Academic Block A": {
        "waste_type": "Paper",
        "bin_count": 8,
        "avg_fill": 42,
        "avg_fill_rate": 2,
        "weekday_factor": 1.0,
        "weekend_factor": 0.45,
        "hour_peak": [9, 10, 11, 12, 14, 15, 16],
    },
    "Academic Block B": {
        "waste_type": "Paper",
        "bin_count": 8,
        "avg_fill": 45,
        "avg_fill_rate": 2.5,
        "weekday_factor": 1.0,
        "weekend_factor": 0.45,
        "hour_peak": [9, 10, 11, 12, 14, 15, 16],
    },
    "Hostel Block 1": {
        "waste_type": "Organic",
        "bin_count": 10,
        "avg_fill": 55,
        "avg_fill_rate": 4.0,
        "weekday_factor": 1.1,
        "weekend_factor": 1.0,
        "hour_peak": [7, 8, 12, 18, 19, 20, 21],
    },
    "Hostel Block 2": {
        "waste_type": "Organic",
        "bin_count": 10,
        "avg_fill": 58,
        "avg_fill_rate": 3.8,
        "weekday_factor": 1.1,
        "weekend_factor": 1.0,
        "hour_peak": [7, 8, 12, 18, 19, 20, 21],
    },
    "Library": {
        "waste_type": "Paper",
        "bin_count": 8,
        "avg_fill": 36,
        "avg_fill_rate": 1.8,
        "weekday_factor": 1.2,
        "weekend_factor": 0.5,
        "hour_peak": [10, 11, 12, 14, 15, 16],
    },
    "Canteen": {
        "waste_type": "Mixed",
        "bin_count": 10,
        "avg_fill": 65,
        "avg_fill_rate": 7.0,
        "weekday_factor": 1.2,
        "weekend_factor": 1.3,
        "hour_peak": [11, 12, 13, 14, 18, 19, 20],
    },
    "Common Area": {
        "waste_type": "Plastic",
        "bin_count": 8,
        "avg_fill": 50,
        "avg_fill_rate": 3.3,
        "weekday_factor": 1.0,
        "weekend_factor": 0.8,
        "hour_peak": [9, 10, 11, 12, 13, 14, 16, 17],
    },
}

# Some bins fill faster consistently
fast_bins = {
    "Canteen-05",
    "Canteen-08",
    "Hostel Block 1-03",
    "Hostel Block 2-07",
    "Common Area-02",
}

# -----------------------------
# Generate bin list
# -----------------------------
all_bins = []
for loc, config in locations.items():
    for i in range(1, config["bin_count"] + 1):
        # Example: AB-A-01 -> Academic Block A-01 style
        zone_code = loc.split()[0] + "-" + str(i).zfill(2)
        # More readable bin IDs like AB-A-01, HB1-01, C-01 etc.
        if loc == "Academic Block A":
            bin_id = f"AB-A-{i:02d}"
        elif loc == "Academic Block B":
            bin_id = f"AB-B-{i:02d}"
        elif loc == "Hostel Block 1":
            bin_id = f"HB1-{i:02d}"
        elif loc == "Hostel Block 2":
            bin_id = f"HB2-{i:02d}"
        elif loc == "Library":
            bin_id = f"LIB-{i:02d}"
        elif loc == "Canteen":
            bin_id = f"CAN-{i:02d}"
        elif loc == "Common Area":
            bin_id = f"CA-{i:02d}"
        else:
            bin_id = f"BIN-{loc[:2].upper()}-{i:02d}"

        all_bins.append({
            "Bin_ID": bin_id,
            "Location": loc,
            "Waste_Type": config["waste_type"],
            "Base_Fill": config["avg_fill"],
            "Base_Rate": config["avg_fill_rate"],
            "weekday_factor": config["weekday_factor"],
            "weekend_factor": config["weekend_factor"],
            "hour_peak": config["hour_peak"],
            "Fast_Bin": bin_id in fast_bins,
        })

# -----------------------------
# Generate rows
# -----------------------------
rows = []
start_date = datetime(2026, 9, 1, 6, 0, 0)
num_records = 800

for i in range(num_records):
    # Randomly choose a bin
    bin_info = random.choice(all_bins)
    loc = bin_info["Location"]
    loc_config = locations[loc]

    # Time of observation distributed across a month
    day_offset = random.randint(0, 29)
    # Hour spread across campus day; include meal and hostel activity patterns
    hour = random.choice([7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21])

    # Day of week depends on generated date
    timestamp = start_date + timedelta(days=day_offset, hours=hour)
    day_of_week = timestamp.strftime("%A")

    # Small weekend effect
    if day_of_week in ["Saturday", "Sunday"]:
        weekday_mult = loc_config["weekend_factor"]
    else:
        weekday_mult = loc_config["weekday_factor"]

    # Meal-time pressure for canteen
    if loc == "Canteen" and hour in [11, 12, 13, 14, 18, 19, 20]:
        meal_factor = 1.4
    else:
        meal_factor = 1.0

    # Hostel specific activity
    if loc.startswith("Hostel") and hour in [7, 8, 18, 19, 20, 21]:
        hostel_factor = 1.35
    else:
        hostel_factor = 1.0

    # Canteen and hostel bins should have faster fill rates but realistic
    if bin_info["Fast_Bin"]:
        fast_factor = 1.35
    else:
        fast_factor = 1.0

    # Simulate effective per-hour fill rate
    fill_rate = bin_info["Base_Rate"] * weekday_mult * meal_factor * hostel_factor * fast_factor

    # Historical average fill is slightly different from current but realistic
    hist_avg = bin_info["Base_Fill"] + random.uniform(-8, 10)

    # Keep fill rate in a reasonable, non-random unrealistic range
    fill_rate = max(0.2, min(14.0, fill_rate))

    # To model a sequence of observations, generate previous fill and current fill
    # from a combination of last known fill and new fill rate.
    if i == 0:
        previous_fill = random.uniform(10, 90)
    else:
        # Use a previous record from same bin when possible
        previous_row = [r for r in rows if r["Bin_ID"] == bin_info["Bin_ID"]]
        if previous_row:
            # Last known current fill for same bin
            previous_fill = previous_row[-1]["Current_Fill_Level"]
        else:
            previous_fill = random.uniform(10, 90)

    # Current fill should be constrained to 0-100
    current_fill = previous_fill + fill_rate + random.uniform(-7, 7)

    # Keep within bounds
    current_fill = max(0, min(100, current_fill))

    # Historical average should be more stable
    hist_avg = max(0, min(100, hist_avg))

    # Determine Collection_Due based on fill level and rate
    collection_due = "No"
    if current_fill >= 75 or fill_rate >= 8.0:
        collection_due = "Yes"

    # Overflow status categories target variable proxy
    if current_fill >= 85:
        overflow_status = "Overflowed"
    elif current_fill >= 70 or collection_due == "Yes":
        overflow_status = "Likely Overflow"
    else:
        overflow_status = "No Overflow"

    # Generate row
    row = {
        "Bin_ID": bin_info["Bin_ID"],
        "Location": loc,
        "Timestamp": timestamp.isoformat(),
        "Current_Fill_Level": round(current_fill, 2),
        "Previous_Fill_Level": round(previous_fill, 2),
        "Fill_Rate": round(fill_rate, 2),
        "Day_of_Week": day_of_week,
        "Hour": hour,
        "Waste_Type": bin_info["Waste_Type"],
        "Historical_Average_Fill": round(hist_avg, 2),
        "Collection_Due": collection_due,
        "Overflow_Status": overflow_status,
    }

    rows.append(row)

# -----------------------------
# Write CSV
# -----------------------------
fields = [
    "Bin_ID",
    "Location",
    "Timestamp",
    "Current_Fill_Level",
    "Previous_Fill_Level",
    "Fill_Rate",
    "Day_of_Week",
    "Hour",
    "Waste_Type",
    "Historical_Average_Fill",
    "Collection_Due",
    "Overflow_Status",
]

with OUTPUT_FILE.open("w", newline="") as csvfile:
    writer = csv.DictWriter(csvfile, fieldnames=fields)
    writer.writeheader()
    writer.writerows(rows)

print(f"Generated {len(rows)} simulated records at {OUTPUT_FILE}")
