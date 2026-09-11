# Phase 8: Optional Collection Route Recommendation

This project extends the existing waste-management assistant with an optional prototype route-recommendation component.

## Goal

Given high-priority bins, their locations, a starting point such as a depot, and a priority classification, generate an example collection order.

Example route:

Depot → B27 → B14 → B08 → B19

## Important Limitation

The route is a prototype decision-support route order. It is not a professionally validated municipal route optimizer. It should not replace a professional vehicle-routing system.

## Comparison

1. Fixed collection order: Standard location schedule without priority sorting.
2. Priority-based collection order: Sort by ML predicted risk and priority score.
3. Optional optimized route: Use location proximity and the highest bins to propose a simple route sequence.

## Route Scoring Idea

The route module uses the priority engine output and simple campus location coordinates to propose an ordered route. It is a transparent prototype extension and should be understood as educational.

## Files

- `src/route_recommendation.py`: route ordering, comparison explanations, and route explanations.
- `src/route_demo.py`: a demo that uses the existing dataset, prediction, and priority engine output.

## How to Use

```bash
python src/route_demo.py
```
