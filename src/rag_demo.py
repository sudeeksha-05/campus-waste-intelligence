from rag_knowledge import answer_question, create_knowledge_base

create_knowledge_base()

questions = [
    "How should batteries be handled?",
    "What should go into the recyclable waste bin?",
    "How should food waste be managed?",
    "What should I do with electronic waste?",
    "What does the campus waste policy say?",
]

for q in questions:
    print("\nQuestion:", q)
    print(answer_question(q))
