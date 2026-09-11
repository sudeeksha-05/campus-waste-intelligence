# Phase 7: Conversational Interface

This project adds a simple conversational interface to the existing Streamlit dashboard.

## Goal

Let a user ask natural-language questions and receive grounded, evidence-based answers using the existing ML prediction, priority scoring, and RAG knowledge components.

## Supported Examples

The conversation module can answer questions of the following types:

- Which bins need immediate collection?
- Why is Bin B27 high priority?
- What should I do with batteries or e-waste?
- Which area is generating the most waste?
- Which bins are likely to overflow within the next few hours?

## Workflow

1. User asks a natural-language question.
2. The conversation layer classifies the question.
3. If the question involves waste rules or handling, the RAG knowledge base is used.
4. If the question asks about collection order or urgency, the ML model and priority engine are used.
5. The answer is generated in simple evidence-based language.

## Important Limitation

This interface is a prototype. It is not a full autonomous conversational agent and it cannot replace the ML model, the collection-priority engine, or human verification.
