import re
from pathlib import Path
from typing import List, Tuple, Optional

ROOT = Path(__file__).resolve().parents[1]
KB_DIR = ROOT / "knowledge_base"
KB_DIR.mkdir(parents=True, exist_ok=True)

# Default knowledge base documents
DOCUMENTS = {
    "waste_segregation.md": """# Waste Segregation Guidelines

General campus rule: keep wet waste, dry waste, recyclables, e-waste, batteries, and hazardous waste separated at source. Do not mix food waste with paper, plastic, metal, or electronic waste. Staff and students should use colour-coded, clearly labelled bins, and waste handlers should follow posted campus collection instructions.

Key Segregation Rules:
• Wet & Organic Waste: Place in green organic bins; never mix with dry recyclables.
• Dry Recyclables: Keep clean and dry (clean plastic bottles, paper, cardboard, cans).
• Special Waste: E-waste, batteries, and hazardous materials must go to designated drop-off points.
• No Contamination: Food residue on paper or plastic prevents recycling.
""",
    "organic_waste.md": """# Organic Waste Management

Organic waste includes food scraps, garden waste, fruit peels, cooked leftovers, and plant material generated across campus canteens, hostels, and dining areas.

Handling Instructions:
• Deposit in designated green organic / compost bins.
• Keep organic waste free from plastic containers, wrappers, foil, paper napkins, and cutlery.
• High-moisture food waste from Canteen and Hostels should be collected promptly to prevent odor and pest attraction.
• When campus composting is active, divert clean kitchen scraps to the campus bio-compost unit.
• If composting is unavailable, follow campus sanitation procedure for municipal bio-waste collection.
""",
    "recyclable_waste.md": """# Recyclable Waste Guidelines

Recyclable waste includes clean paper, cardboard, aluminium cans, clean plastic bottles, and other materials accepted by the campus recycling stream.

Handling Instructions:
• Empty, rinse, and dry all containers before disposal. Items must be free from food residue.
• Flatten cardboard boxes and crush clean plastic bottles to conserve bin capacity.
• Do not place broken glass, contaminated food wrappers, batteries, or electronic items in recyclable bins.
• Store collected recyclables in dry holding areas before transfer to authorized recycling vendors.
""",
    "plastic_waste.md": """# Plastic Waste Handling

Plastic waste on campus comprises drinking bottles (PET), food packaging, polythene bags, plastic containers, and wrappers.

Handling Instructions:
• Rinse or clean plastic bottles and containers when possible to remove liquids and food residue.
• Separate rigid plastic bottles from soft films/wrappers according to campus collection instructions.
• Never mix plastic waste with organic food waste or wet canteen refuse.
• Collect plastic in designated blue dry-recyclable bins across academic blocks, libraries, and hostels.
• Clean plastic should be baled or bagged for periodic transfer to registered plastic recyclers.
""",
    "paper_waste.md": """# Paper Waste Handling

Paper waste includes notebooks, printer/office sheets, exam papers, cardboard cartons, newspapers, and packaging.

Handling Instructions:
• Deposit in designated blue or dry paper bins in academic blocks, libraries, and administrative offices.
• Keep paper completely dry and free from coffee, food, or grease contamination.
• Shredded confidential or examination documents must be handled according to campus document-security protocols.
• Flatten cardboard boxes to maximize bin space before collection.
""",
    "ewaste.md": """# Electronic Waste (E-Waste) Disposal

Electronic waste includes obsolete computers, laptops, chargers, power cables, keyboards, mice, printers, mobile phones, printed circuit boards, and damaged laboratory equipment.

Handling Instructions:
• Never dispose of e-waste in general campus waste bins or mixed dry-waste containers.
• Store obsolete devices safely in designated IT department or maintenance storage bins.
• Log equipment serial numbers before disposal in accordance with campus asset-decommissioning policies.
• Coordinate periodic disposal through authorized and certified state-pollution-control-board e-waste recyclers.
• Report damaged electronics or equipment through the campus maintenance or IT service desk.
""",
    "batteries.md": """# Battery Disposal Guidelines

Used batteries—including lithium-ion, alkaline, lead-acid, and rechargeable battery packs—contain heavy metals and corrosive chemicals.

Handling Instructions:
• Keep batteries strictly segregated from general municipal and mixed campus waste.
• Deposit spent cells into dedicated yellow/labelled battery collection boxes located in computer labs, libraries, and security desks.
• Tape the terminals of lithium batteries with non-conductive tape to prevent short circuits and fire hazards.
• Leaking or swollen batteries must be isolated in non-reactive sand/vermiculite containers and reported to campus safety staff immediately.
• Collected batteries must be sent to certified battery recycling partners.
""",
    "hazardous_waste.md": """# Hazardous Waste Management

Hazardous waste encompasses chemistry laboratory reagents, solvents, broken fluorescent lamps, aerosol cans, biological specimens, sharps, and toxic or corrosive substances.

Handling Instructions:
• Strictly separate hazardous chemicals from general campus waste streams.
• Store in sealed, chemically compatible, labelled containers inside secondary containment trays.
• Laboratory technicians must maintain hazardous waste manifests and log collection dates.
• Broken fluorescent tubes and mercury-containing devices must be placed in special protective sleeves.
• Never pour chemicals or toxic solvents into campus sinks, storm drains, or general dumpsters.
• Disposal must be supervised by trained campus environmental safety personnel and executed via certified hazardous waste handlers.
""",
    "campus_waste_policy.md": """# Campus Waste Management Policy

The Spoorthy Engineering College waste management policy mandates responsible waste minimization, source segregation, and sustainable disposal across all academic, hostel, and administrative zones.

Core Policy Principles:
• Source Segregation: Every generator (students, faculty, staff) must segregate waste at the point of origin.
• Zero Open Dumping: No open dumping or unapproved burning of waste anywhere on campus.
• Prioritized Collection: Sanitation crews prioritize collections based on sensor readings and overflow risk to prevent bin overflow.
• Specialized Handover: High-risk streams (e-waste, batteries, chemicals) must be routed to approved specialized recyclers.
• Human Oversight: Collection routes and disposal orders require administrative review and verification before dispatch.
""",
}


def ensure_knowledge_base():
    """Ensure all knowledge base files exist on disk."""
    KB_DIR.mkdir(parents=True, exist_ok=True)
    for filename, content in DOCUMENTS.items():
        doc_path = KB_DIR / filename
        if not doc_path.exists():
            doc_path.write_text(content, encoding="utf-8")


TOPIC_DOCUMENT_MAPPING = {
    "plastic": ["plastic_waste.md", "recyclable_waste.md", "waste_segregation.md"],
    "pet": ["plastic_waste.md", "recyclable_waste.md"],
    "bottle": ["plastic_waste.md", "recyclable_waste.md"],
    "e-waste": ["ewaste.md", "batteries.md", "waste_segregation.md"],
    "ewaste": ["ewaste.md", "batteries.md", "waste_segregation.md"],
    "electronic": ["ewaste.md", "batteries.md"],
    "computer": ["ewaste.md"],
    "laptop": ["ewaste.md"],
    "battery": ["batteries.md", "ewaste.md"],
    "batteries": ["batteries.md", "ewaste.md"],
    "organic": ["organic_waste.md", "waste_segregation.md"],
    "food": ["organic_waste.md", "waste_segregation.md"],
    "compost": ["organic_waste.md"],
    "paper": ["paper_waste.md", "recyclable_waste.md", "waste_segregation.md"],
    "cardboard": ["paper_waste.md", "recyclable_waste.md"],
    "recyclable": ["recyclable_waste.md", "waste_segregation.md"],
    "recycle": ["recyclable_waste.md", "waste_segregation.md"],
    "hazardous": ["hazardous_waste.md", "campus_waste_policy.md"],
    "chemical": ["hazardous_waste.md"],
    "toxic": ["hazardous_waste.md"],
    "lamp": ["hazardous_waste.md"],
    "segregation": ["waste_segregation.md", "campus_waste_policy.md"],
    "segregate": ["waste_segregation.md", "campus_waste_policy.md"],
    "policy": ["campus_waste_policy.md", "waste_segregation.md"],
    "rules": ["campus_waste_policy.md", "waste_segregation.md"],
    "guidelines": ["waste_segregation.md", "campus_waste_policy.md"],
}

STOP_WORDS = {
    "how", "should", "what", "where", "which", "when", "why", "who", "can", "could",
    "the", "and", "for", "with", "are", "was", "were", "any", "from", "into", "over",
    "type", "types", "waste", "bin", "bins", "campus", "managed", "handled", "disposed",
    "dispose", "disposal", "management", "handling", "about", "tell", "give", "please",
    "does", "that", "this", "these", "those", "have", "been", "college", "spoorthy"
}


def keyword_search(query: str, top_k: int = 2) -> List[Tuple[Path, float]]:
    """Search knowledge base documents using topic-aware keyword matching."""
    ensure_knowledge_base()
    q_lower = query.lower()
    terms = re.findall(r"[a-z0-9-]+", q_lower)
    meaningful_terms = [t for t in terms if t not in STOP_WORDS and len(t) > 1]

    doc_scores = {}
    files = list(KB_DIR.glob("*.md"))
    file_map = {f.name: f for f in files}

    # 1. Direct topic map boost
    for term, doc_names in TOPIC_DOCUMENT_MAPPING.items():
        if term in q_lower or term in terms:
            for dname in doc_names:
                doc_scores[dname] = doc_scores.get(dname, 0) + 15.0

    # 2. Document content and title overlap
    for f in files:
        try:
            content = f.read_text(encoding="utf-8").lower()
        except Exception:
            continue

        score = doc_scores.get(f.name, 0)
        stem = f.stem.replace("_", " ")

        for term in meaningful_terms:
            if term in stem:
                score += 10.0
            term_count = content.count(term)
            if term_count > 0:
                score += min(term_count * 1.5, 8.0)

        if score > 0:
            doc_scores[f.name] = score

    sorted_docs = sorted(doc_scores.items(), key=lambda x: x[1], reverse=True)
    results = []
    for dname, score in sorted_docs[:top_k]:
        if score >= 3.0 and dname in file_map:
            results.append((file_map[dname], score))

    return results


def answer_question(question: str) -> str:
    """Return an answer grounded in the local trusted knowledge base."""
    ensure_knowledge_base()
    matched = keyword_search(question, top_k=2)

    if not matched:
        return "I couldn't find supporting guidance in the knowledge base."

    primary_doc, _ = matched[0]
    try:
        content = primary_doc.read_text(encoding="utf-8").strip()
    except Exception:
        return "I couldn't find supporting guidance in the knowledge base."

    # Format output with clear title, guidance body, and source document citation
    lines = content.splitlines()
    title = lines[0].replace("#", "").strip() if lines else primary_doc.stem.replace("_", " ").title()
    body_lines = lines[1:] if len(lines) > 1 else lines
    body_text = "\n".join(line for line in body_lines if line.strip())

    output = [
        f"### Waste Handling Guidance: {title}",
        f"*(Source: knowledge_base/{primary_doc.name})*",
        "",
        body_text,
        "",
        "• **Administrative Note:** Follow posted campus collection instructions. Special or hazardous streams must be coordinated through campus facilities/administration."
    ]

    return "\n".join(output)


def get_guidance_for_topic(topic: str) -> Optional[str]:
    """Retrieve concise guidance for a specific waste type (used in combined queries)."""
    ensure_knowledge_base()
    matched = keyword_search(topic, top_k=1)
    if not matched:
        return None

    doc, _ = matched[0]
    try:
        content = doc.read_text(encoding="utf-8").strip()
        lines = content.splitlines()
        title = lines[0].replace("#", "").strip() if lines else doc.stem.replace("_", " ").title()
        # Find handling instructions or summary bullet points
        bullets = [line.strip() for line in lines if line.strip().startswith("•")]
        if not bullets:
            bullets = [line.strip() for line in lines if len(line.strip()) > 30 and not line.startswith("#")][:3]

        formatted = [
            f"**{title} Handling Protocol** *(Source: knowledge_base/{doc.name})*:",
        ]
        for b in bullets[:4]:
            formatted.append(f"{b if b.startswith('•') else '• ' + b}")
        return "\n".join(formatted)
    except Exception:
        return None
