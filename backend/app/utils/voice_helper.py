def process_voice_command(text: str):
    """
    Mock function to represent NLP processing of voice commands.
    In a real app, this could connect to an LLM or specific intent parser.
    """
    text = text.lower()
    
    if "took" in text or "taken" in text:
        return {"intent": "log_dose", "status": "taken"}
    elif "missed" in text or "forgot" in text:
        return {"intent": "log_dose", "status": "missed"}
    elif "headache" in text or "pain" in text or "nausea" in text:
        return {"intent": "log_symptom", "value": text}
    
    return {"intent": "unknown"}
