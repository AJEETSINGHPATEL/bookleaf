import json
import logging
import re
from typing import Dict, Any, Tuple
import httpx
from app.core.config import settings

logger = logging.getLogger("bookleaf.ai")

# 6 Allowed Categories per assignment document
ALLOWED_CATEGORIES = [
    "Royalty & Payments",
    "ISBN & Metadata Issues",
    "Printing & Quality",
    "Distribution & Availability",
    "Book Status & Production Updates",
    "General Inquiry"
]

ALLOWED_PRIORITIES = ["Critical", "High", "Medium", "Low"]

# Concise, token-efficient extraction of BookLeaf Knowledge Base policies
BOOKLEAF_KB_PROMPT = """
You are an expert AI support specialist for BookLeaf Publishing (a leading self-publishing house in India & the US).
Your tone MUST be:
1. Empathetic and professional: Authors are our partners, never treat them as mere customers.
2. Acknowledge the author's specific concern before jumping into policy or solutions.
3. Be specific: Cite relevant numbers, timelines, and statuses rather than vague reassurances.
4. Accountability: If something is BookLeaf's fault (e.g. delayed royalties or ISBN glitch), own it directly with zero corporate deflection.
5. Escalation: If an issue requires investigation, give an exact timeline (e.g., 'within 48 hours').
6. Always conclude with a clear, actionable next step for the author or the BookLeaf team.

BOOKLEAF POLICIES:
- Royalty Policy: 80/20 split (80% net profit to author, 20% to BookLeaf). Net profit = MRP minus printing cost, platform commissions (Amazon/Flipkart), and shipping. Calculated quarterly, paid within 45 days of quarter end. Minimum payout threshold is ₹1,000 (amounts below roll over). Payouts via linked bank transfer. Detailed platform breakdown available in author dashboard.
- ISBN Policy: Each book receives unique BookLeaf imprint ISBN. If author reports an ISBN error (duplicate or wrong book linked), treat as Critical/High priority and escalate to production within 48 hours.
- Printing & Quality: In-house printing in Delhi (plus Repro India/Epitome Books). Turnaround 5-7 business days. If misprints, binding defects, or color issues are reported, BookLeaf arranges a 100% free reprint upon verification of photos.
- Distribution: Listed on Amazon India, Flipkart, Amazon US/UK, BookLeaf Store. New listings live in 7-10 business days. 'Currently Unavailable' usually means stock sync issue; re-sync triggers within 24-48 hours.
- Production Stages: Manuscript Received -> Editing (if opted) -> Cover Design -> Typesetting -> Proofreading -> ISBN Assignment -> Printing -> Distribution Setup -> Published & Live. Typical delays happen at Cover Design (author approval) or Proofreading (revision rounds).
"""

def heuristic_classify_and_score(subject: str, description: str) -> Dict[str, Any]:
    """
    Intelligent fallback classifier based on BookLeaf operational taxonomy.
    Used when Gemini API is rate-limited, unreachable, or in offline mode.
    """
    text = f"{subject} {description}".lower()

    category = "General Inquiry"
    priority = "Medium"
    reason = "Standard general support inquiry."

    # Royalty & Payments
    if any(k in text for k in ["royalty", "payment", "bank", "payout", "threshold", "commission", "profit", "net profit", "money", "rupees", "₹"]):
        category = "Royalty & Payments"
        if any(k in text for k in ["never received", "not received", "months", "overdue", "missing", "delay", "6 months", "4 months"]):
            priority = "High"
            reason = "Financial payout concern with elapsed time above threshold."
        elif "too low" in text or "mismatch" in text:
            priority = "Medium"
            reason = "Royalty calculation inquiry requesting line-by-line breakdown."
        else:
            priority = "Medium"
            reason = "General royalty cycle query."

    # ISBN & Metadata
    elif any(k in text for k in ["isbn", "metadata", "imprint", "barcode", "wrong book", "duplicate isbn"]):
        category = "ISBN & Metadata Issues"
        priority = "High"
        reason = "ISBN integrity issue requiring catalog and production verification."
        if "different isbn" in text or "wrong book" in text or "duplicate" in text:
            priority = "Critical"
            reason = "Critical ISBN mismatch between live platform and print copy."

    # Printing & Quality
    elif any(k in text for k in ["print", "paper", "cover quality", "blurry", "binding", "misprint", "damaged", "page missing", "misaligned"]):
        category = "Printing & Quality"
        if any(k in text for k in ["terrible", "damaged", "unreadable", "pages falling", "misaligned"]):
            priority = "High"
            reason = "Defective physical author copies reported, qualify for reprint review."
        else:
            priority = "Medium"
            reason = "Print turnaround or specifications inquiry."

    # Distribution & Availability
    elif any(k in text for k in ["unavailable", "amazon", "flipkart", "out of stock", "distribution", "live", "listing"]):
        category = "Distribution & Availability"
        priority = "Medium"
        reason = "Platform listing or stock synchronization status inquiry."

    # Book Status & Production Updates
    elif any(k in text for k in ["typesetting", "proof", "proofreading", "cover design", "manuscript", "production", "status update", "stage", "when will it be done"]):
        category = "Book Status & Production Updates"
        if any(k in text for k in ["weeks", "delayed", "stuck", "no update"]):
            priority = "Medium"
            reason = "Production turnaround inquiry for stage progress."
        else:
            priority = "Low"
            reason = "Routine production progress query."

    return {
        "category": category,
        "priority": priority,
        "priority_reasoning": reason
    }

def heuristic_draft_response(
    author_name: str,
    subject: str,
    description: str,
    book_title: str = None,
    category: str = "General Inquiry"
) -> str:
    """
    Intelligent BookLeaf Knowledge Base grounded fallback draft generator.
    Ensures zero failure even when LLM endpoints are unavailable.
    """
    text = f"{subject} {description}".lower()
    salutation = f"Dear {author_name},\n\nThank you for reaching out to BookLeaf Publishing support."
    book_ref = f" regarding '{book_title}'" if book_title else ""
    signoff = "\n\nWarm regards,\nBookLeaf Author Support Team\nBookLeaf Publishing (India & US)"

    if "royalty" in text or category == "Royalty & Payments":
        if "not received" in text or "haven't received" in text:
            body = (
                f"{salutation} We completely understand your concern{book_ref} and apologize for the anxiety this has caused.\n\n"
                "As per BookLeaf's Royalty Policy, royalties follow an 80/20 net profit split and are calculated quarterly, "
                "with disbursements processed within 45 days following the quarter's end. Furthermore, payouts are triggered "
                "once your accumulated royalties reach the minimum ₹1,000 threshold (balances below roll over).\n\n"
                "Our accounts desk is currently reviewing your linked bank account and recent ledger. If this payout is overdue, "
                "we will escalate it immediately with our finance team and provide a verified confirmation within 48 hours."
            )
        else:
            body = (
                f"{salutation} We would be happy to clarify the details for you{book_ref}.\n\n"
                "Under BookLeaf's policy, author royalties represent 80% of net profits (MRP minus actual printing cost, "
                "e-commerce platform commission on Amazon/Flipkart, and shipping charges). We believe in complete transparency, "
                "and our team can generate a line-by-line statement showing your exact platform breakdown.\n\n"
                "Our team will pull your latest sales report and attach the statement to this ticket within 24 hours."
            )

    elif "isbn" in text or category == "ISBN & Metadata Issues":
        body = (
            f"{salutation} We recognize the urgency of this matter{book_ref}.\n\n"
            "An ISBN mismatch or metadata discrepancy is treated as a high-priority issue at BookLeaf. Each book published with us "
            "receives a designated ISBN registered under the BookLeaf imprint. We have immediately escalated this ticket to our catalog "
            "and distribution teams to inspect the Amazon/Flipkart feeds against our master records.\n\n"
            "We are investigating this as a priority and will update you with a resolution or re-sync status within 48 hours."
        )

    elif any(k in text for k in ["print", "quality", "blurry", "misaligned"]) or category == "Printing & Quality":
        body = (
            f"{salutation} We are very sorry to hear that your copies did not arrive in pristine condition{book_ref}.\n\n"
            "BookLeaf holds strict printing standards across our Delhi facility and print partners. Whenever an author receives copies "
            "with binding defects, misprints, or alignment issues, we arrange a 100% free replacement reprint upon verification.\n\n"
            "Could you please reply with clear photographs highlighting the defective pages or cover? Once verified by our quality control "
            "team, we will dispatch fresh copies within 5–7 business days."
        )

    elif "unavailable" in text or category == "Distribution & Availability":
        body = (
            f"{salutation} Thank you for notifying us about the platform listing{book_ref}.\n\n"
            "When a book displays as 'Currently Unavailable' on Amazon or Flipkart, it is typically a stock synchronization delay between the "
            "channel and our warehouse inventory. Our distribution team can trigger a manual catalog re-sync, which usually propagates "
            "live within 24–48 hours.\n\n"
            "We have triggered the re-sync with our channel operations and will monitor the listing until it is active."
        )

    elif category == "Book Status & Production Updates":
        body = (
            f"{salutation} Thank you for checking in on the production progress{book_ref}.\n\n"
            "Every BookLeaf title progresses through structured phases: Manuscript Received -> Editing -> Cover Design -> Typesetting -> "
            "Proofreading -> ISBN Assignment -> Printing -> Distribution Setup. We are actively coordinating with our production designers "
            "to ensure all formatting and proofing meet publication standards.\n\n"
            "Our editorial coordinator will check the current stage and provide you with an exact revised timeline within 24 business hours."
        )

    else:
        body = (
            f"{salutation} Thank you for your inquiry{book_ref}.\n\n"
            "We have received your request and our author support team is currently reviewing the details. We are committed to providing you "
            "with a clear and helpful resolution.\n\n"
            "A member of our operations team will follow up directly on this thread within 24 to 48 hours."
        )

    return f"{body}{signoff}"

async def call_gemini_api(prompt: str) -> str:
    """
    Calls Google Gemini API with fallback across multiple models.
    """
    api_key = settings.GEMINI_API_KEY
    if not api_key:
        raise ValueError("GEMINI_API_KEY is not configured")

    models_to_try = [
        settings.GEMINI_MODEL,
        "gemini-3.8-flash",
        "gemini-3.5-flash",
        "gemini-flash-latest",
        "gemini-2.5-flash"
    ]

    async with httpx.AsyncClient(timeout=12.0) as client:
        last_exception = None
        for model in models_to_try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
            payload = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {
                    "temperature": 0.2,
                    "maxOutputTokens": 600
                }
            }
            try:
                response = await client.post(url, json=payload)
                if response.status_code == 200:
                    data = response.json()
                    candidates = data.get("candidates", [])
                    if candidates and "content" in candidates[0]:
                        parts = candidates[0]["content"].get("parts", [])
                        if parts and "text" in parts[0]:
                            return parts[0]["text"].strip()
                elif response.status_code in (404, 503, 429):
                    logger.warning(f"Gemini model {model} returned status {response.status_code}. Trying next model...")
                    continue
                else:
                    response.raise_for_status()
            except Exception as e:
                last_exception = e
                logger.warning(f"Error calling {model}: {e}")
                continue

        if last_exception:
            raise last_exception
        raise RuntimeError("All Gemini models failed or returned unavailable")

async def analyze_ticket_with_ai(
    author_name: str,
    subject: str,
    description: str,
    book_title: str = None,
    book_status: str = None
) -> Dict[str, Any]:
    """
    Classifies ticket category, priority, and generates empathetic draft response.
    Includes cost-conscious prompt and robust fallback to heuristics.
    """
    book_info = f"Book: '{book_title}' (Status: {book_status})" if book_title else "General / Account Level query"
    
    prompt = f"""{BOOKLEAF_KB_PROMPT}

TASK:
Analyze this incoming author ticket and respond ONLY in valid JSON matching this exact structure:
{{
  "category": "<one of: Royalty & Payments | ISBN & Metadata Issues | Printing & Quality | Distribution & Availability | Book Status & Production Updates | General Inquiry>",
  "priority": "<one of: Critical | High | Medium | Low>",
  "priority_reasoning": "<1 sentence explanation of why this priority was assigned>",
  "draft_response": "<polite, empathetic, specific response following BookLeaf Tone Guidelines, signed by BookLeaf Author Support Team>"
}}

AUTHOR DETAILS:
Author Name: {author_name}
Context: {book_info}
Ticket Subject: {subject}
Ticket Description: {description}
"""

    # Attempt Gemini API call
    try:
        raw_text = await call_gemini_api(prompt)
        # Clean json backticks if any
        cleaned = re.sub(r"^```(?:json)?\s*", "", raw_text.strip(), flags=re.MULTILINE)
        cleaned = re.sub(r"\s*```$", "", cleaned, flags=re.MULTILINE).strip()
        data = json.loads(cleaned)

        from app.schemas.schemas import AITicketAnalysis
        analysis = AITicketAnalysis.model_validate(data)

        cat = analysis.category
        if cat not in ALLOWED_CATEGORIES:
            cat = heuristic_classify_and_score(subject, description)["category"]

        prio = analysis.priority
        if prio not in ALLOWED_PRIORITIES:
            prio = heuristic_classify_and_score(subject, description)["priority"]

        reason = analysis.priority_reasoning or "Evaluated by BookLeaf AI classifier."
        draft = analysis.draft_response or heuristic_draft_response(author_name, subject, description, book_title, cat)

        return {
            "category": cat,
            "priority": prio,
            "priority_reasoning": reason,
            "draft_response": draft,
            "source": "gemini"
        }
    except Exception as e:
        logger.warning(f"AI API call failed or unavailable ({e}). Using BookLeaf KB fallback heuristics.")
        # Graceful degradation - Rule based Knowledge Base classifier
        heuristics = heuristic_classify_and_score(subject, description)
        draft = heuristic_draft_response(
            author_name=author_name,
            subject=subject,
            description=description,
            book_title=book_title,
            category=heuristics["category"]
        )
        return {
            "category": heuristics["category"],
            "priority": heuristics["priority"],
            "priority_reasoning": heuristics["priority_reasoning"] + " (Computed via BookLeaf KB Rule Engine)",
            "draft_response": draft,
            "source": "fallback"
        }

async def generate_refined_draft(
    author_name: str,
    subject: str,
    description: str,
    book_title: str = None,
    category: str = "General Inquiry",
    custom_instructions: str = None
) -> str:
    """
    Regenerates an AI draft response on demand with optional admin instruction tweaks.
    """
    prompt = f"""{BOOKLEAF_KB_PROMPT}

TASK:
Draft an empathetic, official BookLeaf support response to this author.
Author Name: {author_name}
Book: {book_title or 'General / Account Query'}
Category: {category}
Ticket Subject: {subject}
Ticket Description: {description}
Admin Special Instructions: {custom_instructions or 'None'}

Produce ONLY the drafted response message, ready to be reviewed and sent by the ops admin.
"""
    try:
        draft = await call_gemini_api(prompt)
        return draft.strip()
    except Exception as e:
        logger.warning(f"Regenerate draft fallback used: {e}")
        return heuristic_draft_response(author_name, subject, description, book_title, category)
