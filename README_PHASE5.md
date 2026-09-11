# Phase 5: Retrieval-Augmented Generation (RAG) Knowledge Component

This project includes an independent RAG-style knowledge component for campus waste guidance.

## Goal

Receive a question, search a trusted local knowledge base, retrieve relevant passages, and produce a grounded answer without making unsupported claims.

## Knowledge Base

The knowledge base is a small set of local Markdown documents covering:

- Waste segregation
- Organic waste
- Recyclable waste
- Plastic waste
- Paper waste
- E-waste
- Batteries
- Hazardous waste
- Campus waste management policy

## Retrieval Strategy

The current implementation uses a small keyword matching approach over the local documents.

## Important Limitation

This RAG component is a prototype using a local knowledge base. It does not use IBM Granite or any external LLM. It is designed to avoid unsupported claims and to mention the need for local campus policy when information is unavailable.

## Files

- `src/rag_knowledge.py`: contains the local knowledge-base documents and retrieval functions.
- `src/rag_demo.py`: demonstrates sample questions and answers independently of the ML and dashboard components.
- `knowledge_base/`: folder containing the local knowledge-base Markdown documents.

## How to Run

```bash
python src/rag_demo.py
```
