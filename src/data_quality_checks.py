import csv
from pathlib import Path

DATA_FILE = Path("data/smart_waste_simulated_dataset.csv")

required_columns = [
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

if not DATA_FILE.exists():
    raise FileNotFoundError(f"Dataset not found: {DATA_FILE}")

with DATA_FILE.open(newline="") as csvfile:
    reader = csv.DictReader(csvfile)
    rows = list(reader)

    print(f"Rows: {len(rows)}")
    print(f"Columns: {reader.fieldnames}")

    # Basic required column presence
    missing_columns = [col for col in required_columns if col not in reader.fieldnames]
    if missing_columns:
        print("Missing columns:", missing_columns)
    else:
        print("Required columns are present.")

    # Data type and range checks
    invalid_fill = [r for r in rows if not (0 <= float(r["Current_Fill_Level"]) <= 100)]
    invalid_previous = [r for r in rows if not (0 <= float(r["Previous_Fill_Level"]) <= 100)]
    invalid_rate = [r for r in rows if not (0 <= float(r["Fill_Rate"]) <= 30)]
    missing_required_values = [r for r in rows if any(r[col] in ("", None) for col in required_columns)]

    print(f"Current fill values outside 0-100: {len(invalid_fill)}")
    print(f"Previous fill values outside 0-100: {len(invalid_previous)}")
    print(f"Fill rate values outside 0-30: {len(invalid_rate)}")
    print(f"Rows with missing required values: {len(missing_required_values)}")

    # Check categories
    allowed_due = {"Yes", "No"}
    allowed_status = {"No Overflow", "Likely Overflow", "Overflowed"}
    bad_due = [r for r in rows if r["Collection_Due"] not in allowed_due]
    bad_status = [r for r in rows if r["Overflow_Status"] not in allowed_status]

    print(f"Rows with invalid Collection_Due values: {len(bad_due)}")
    print(f"Rows with invalid Overflow_Status values: {len(bad_status)}")

    # Count unique bins and locations
    unique_bins = len({r["Bin_ID"] for r in rows})
    unique_locations = len({r["Location"] for r in rows})
    print(f"Unique bins: {unique_bins}")
    print(f"Unique locations: {unique_locations}")
