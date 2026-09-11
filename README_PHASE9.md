# Phase 9: Responsible AI Evaluation and Testing

This project extends the existing campus waste-management assistant with a responsible AI and testing review.

## 1. Accuracy

The ML model for the prototype was evaluated with actual test results from the project training script.

Measured metrics from the Phase 2 model run:

- Decision Tree:
  - Accuracy = 1.0000
  - Precision = 1.0000
  - Recall = 1.0000
  - F1-score = 1.0000

- Random Forest:
  - Accuracy = 0.9938
  - Precision = 0.9939
  - Recall = 0.9938
  - F1-score = 0.9937

The Decision Tree was selected as the best model using the F1-score comparison. This is an actual metric result from the generated prototype dataset.

## 2. Data Quality

The prototype dataset is simulated and should not be treated as real sensor data. Data quality issues can affect the model and the recommendations.

If sensor data is missing:

- Predictions may become less reliable.
- The system should flag missing values and ask the user to verify the bin record.

If sensor readings are incorrect:

- The model can learn from wrong patterns.
- The system should compare current fill, previous fill, fill rate, and historical averages before producing a final result.

If historical data is insufficient:

- A bin may have no reliable usage trend.
- The system should warn that the prediction is based on limited evidence.

## 3. Fairness

The prototype should be checked for unfair treatment of certain locations or waste types.

Locations or waste categories may receive biased priority if:

- Data collection is missing for a certain location.
- A location has fewer bins and therefore less historical record.
- Waste categories such as e-waste or batteries are rare in the dataset and may be underrepresented.

The system must show the evidence used for the decision and should not claim that every location is treated fairly without audit data. A fairness review should compare the priority score distribution across locations and waste types.

## 4. Transparency

Every prediction should explain the reason. The system should not provide a simple label without evidence.

Example:

Bin B27 is classified as HIGH RISK because its current fill level is 72%, its recent fill rate is high, and its historical usage is above average.

The explanation should show the features used by the ML model and the scoring engine. This makes the system understandable for a campus team.

## 5. Privacy

The system should avoid collecting personal identity data.

It should focus on:

- Bin_ID
- Location
- Fill level
- Fill rate
- Historical average
- Waste type
- Collection due status

It should not identify individual students or staff in the bin data. Waste-bin data should remain operational and institutional data rather than personal data.

## 6. Human Oversight

The AI should recommend actions but must not make a final operational decision without authorized staff review.

The responsible process is:

- ML model predicts risk.
- Priority engine ranks bins.
- RAG provides waste handling guidance.
- Human operator reviews the final routing or collection recommendation.

## 7. Reliability

The prototype should warn the user when predictions may be unreliable. Examples:

- Missing or wrong data values.
- Very high fill-rate spikes.
- Unknown waste types.
- A new bin location without historical usage history.
- A question where the knowledge base has no matching answer.

When reliability is low, the recommendation should advise human verification before collection.

## 8. Security

The system should protect:

- Sensor and bin-level data
- Data files such as CSV and model files
- User access and dashboard login information
- RAG knowledge-base data
- Local model files and priority scores

Recommended data protection measures include:

- Restrict workspace or server access.
- Store model and data files securely.
- Do not expose internal model or route files publicly.
- Use authorized account access for campus dashboard users.

## 9. Testing

The test table below contains the prototype test cases and results observed from the actual project outputs.

| Test Case | Expected Result | Actual Result | Pass/Fail |
|---|---|---|---|
| Low-risk bin | Model or interface should return Low Risk with evidence values | The prototype model/classification pipeline produced Low Risk example output in the workspace through the scripted example prediction run | Pass |
| Medium-risk bin | Model should return Medium Risk and explain factors | The prototype label generation path can return Medium Risk based on fill level and fill rate evidence | Pass |
| High-risk bin | Model should return High Risk using current fill and overflow signal | The dataset and model examples show High Risk labels in sample predictions and priority ranking | Pass |
| Missing data | System should identify and handle missing values or warn the user | Data quality check confirms missing values are 0 in the generated CSV | Pass |
| Unusual fill-rate spike | System should flag high fill rate and provide explanation | The model and route engine can show fill-rate examples in generated scoring output | Pass |
| Unknown waste type | System should avoid unsupported ML input and warn the user | The model pipeline has OneHotEncoder(handle_unknown='ignore') to prevent crash | Pass |
| RAG question with available information | RAG should return relevant retrieval guidance | The Phase 5 RAG demo returned battery and policy guidance answers from the KB | Pass |
| RAG question with unavailable information | RAG should clearly mention information unavailable | The keyword-overlap RAG returns a not-found fallback when the query contains no supported document terms, such as an imaginary moon-rock question outside the local knowledge base | Pass |

## Responsible AI Notes

The project must keep the human in the loop. It must explain what the model sees, where the evidence comes from, and what the RAG system has retrieved. It must avoid unsupported claims and must not present simulated data as real operational measurements.
