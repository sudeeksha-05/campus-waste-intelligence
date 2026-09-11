from agent_workflow import make_agent_recommendation

questions = [
    "Which bins should we collect now?",
    "Why is Bin B27 high priority?",
    "Which area needs attention first?",
    "What should we do with the e-waste collected from Block A?",
    "Which bins are likely to overflow within the next few hours?",
]

for question in questions:
    print("\nQuestion:", question)
    print(make_agent_recommendation(question))
