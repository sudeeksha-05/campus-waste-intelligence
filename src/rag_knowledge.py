import re
from pathlib import Path

KB_DIR = Path("knowledge_base")
KB_DIR.mkdir(parents=True, exist_ok=True)


def load_known_sources():
    """Return a list of knowledge-base source documents for retrieval."""
    files = [
        KB_DIR / "waste_segregation.md",
        KB_DIR / "organic_waste.md",
        KB_DIR / "recyclable_waste.md",
        KB_DIR / "plastic_waste.md",
        KB_DIR / "paper_waste.md",
        KB_DIR / "ewaste.md",
        KB_DIR / "batteries.md",
        KB_DIR / "hazardous_waste.md",
        KB_DIR / "campus_waste_policy.md",
    ]
    return files


def create_knowledge_base():
    """Create a small local knowledge base for the RAG component."""
    documents = {
        "waste_segregation.md": """# Waste Segregation\n\nGeneral campus rule: keep wet waste, dry waste, recyclables, e-waste, batteries, and hazardous waste separated at source. Do not mix food waste with paper, plastic, metal, or electronic waste. Staff should use labelled bins and waste handlers should follow posted campus collection instructions.\n\nSource note: educational prototype knowledge base using general institutional waste-segregation guidance.\n""",
        "organic_waste.md": """# Organic Waste\n\nOrganic waste includes food scraps, garden waste, fruit peels, cooked leftovers, and plant material. Organic waste should be placed in clearly labelled organic or compost streams when the campus operates a compost or bio-waste collection route. Food waste should not be mixed with paper, plastic, or e-waste. If composting is not available, collection should follow the campus sanitation procedure.\n""",
        "recyclable_waste.md": """# Recyclable Waste\n\nRecyclable waste includes clean paper, cardboard, aluminium cans, clean plastic bottles, and other material accepted by the campus recycling system. Items should be clean, dry, and free from food residue. Do not place broken glass, mixed contaminated waste, batteries, or e-waste in recyclable containers.\n""",
        "plastic_waste.md": """# Plastic Waste\n\nPlastic waste includes plastic bottles, packaging, containers, and wrappers that are accepted by the campus recycling or waste segregation system. Rinse or clean bottles when possible. Separate soft plastic and hard plastic depending on the local campus collection process. Do not place plastic waste with organic food waste.\n""",
        "paper_waste.md": """# Paper Waste\n\nPaper waste includes notebooks, paper sheets, cardboard, and clean office paper. Do not place wet paper, food-contaminated paper, or mixed material into the paper recycling stream. Shredded paper should be handled according to campus document-security procedures.\n""",
        "ewaste.md": """# Electronic Waste (E-waste)\n\nElectronic waste includes old laptops, chargers, cables, batteries, keyboards, printers, phones, and damaged electronic devices. E-waste should be stored separately and sent to an approved e-waste collection point. Do not place e-waste with general bins or organic waste. Campus users should report damaged electronics through the maintenance or administration channel.\n""",
        "batteries.md": """# Batteries\n\nBatteries must be kept separate from normal waste. Used batteries, including lithium, alkaline, and rechargeable batteries, should be placed in a designated battery collection container. Never place batteries in general mixed-waste bins. Damaged or leaking batteries should be handled carefully and reported to the campus safety or maintenance team.\n""",
        "hazardous_waste.md": """# Hazardous Waste\n\nHazardous waste includes chemicals, broken fluorescent lamps, laboratory solvents, solvents, aerosol cans, sharp objects, and waste that may be infectious, toxic, or corrosive. These materials must be managed according to the campus safety and laboratory instructions, with supervision by a trained staff member. Do not place hazardous waste into regular bins.\n""",
        "campus_waste_policy.md": """# Campus Waste Management Policy\n\nThe campus waste management policy requires safe segregation at the point of waste generation. Users should use colour-coded bins, keep waste dry and clean when possible, and avoid mixing different streams. High-risk or special waste such as e-waste, batteries, and hazardous waste must be handed to a designated collection or maintenance point. Staff should inspect collection routes and report bins that may overflow or create public health risks.\n""",
    }

    for filename, content in documents.items():
        path = KB_DIR / filename
        path.write_text(content, encoding="utf-8")


def keyword_search(query, docs):
    """A simple keyword retrieval method using text overlap and term weights."""
    query_terms = re.findall(r"[a-zA-Z]+", query.lower())
    query_terms = [term for term in query_terms if len(term) > 2]

    scores = []
    for doc in docs:
        text = doc.read_text(encoding="utf-8").lower()
        score = 0
        for term in query_terms:
            # Count frequency of a term in the whole document
            score += text.count(term)
        scores.append((score, doc))

    scores.sort(reverse=True)
    top = [doc for score, doc in scores if score > 0]
    return top[:3]


def answer_question(question):
    """Return an answer grounded in the local trusted knowledge base."""
    KB_DIR.mkdir(parents=True, exist_ok=True)
    files = list(KB_DIR.glob("*.md"))
    if not files:
        create_knowledge_base()
        files = list(KB_DIR.glob("*.md"))

    docs = keyword_search(question, files)
    if not docs:
        return (
            "I could not find enough supported information in the local campus waste knowledge base. "
            "Please ask about segregation, organic waste, recyclable waste, plastic waste, paper waste, e-waste, batteries, hazardous waste, or campus waste policy."
        )

    answer_parts = []
    for doc in docs:
        text = doc.read_text(encoding="utf-8")
        # Keep concise, retrieve only the document's relevant body lines
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        # Select relevant lines. Use the first lines that contain a useful factual statement.
        relevant_lines = []
        for line in lines:
            if any(term in line.lower() for term in re.findall(r"[a-zA-Z]+", question.lower()) if len(term) > 2):
                relevant_lines.append(line)

        if relevant_lines:
            answer_parts.append("\n".join(relevant_lines[:3]))
        else:
            # Use the first body sentence if there was no direct line match
            body_lines = [line for line in lines if not line.startswith("#")]
            if body_lines:
                answer_parts.append(body_lines[0])

    answer = "\n\n".join(answer_parts)
    answer = (
        "According to the trusted local knowledge base:\n"
        + answer
        + "\n\nIf the campus has a more specific policy or disposal procedure, the user should follow the posted local instructions or contact the campus administration or maintenance team."
    )

    return answer
