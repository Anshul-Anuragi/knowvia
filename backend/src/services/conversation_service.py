def generate_conversation_title(
    question: str,
    max_length: int = 60
) -> str:

    title = question.strip()

    if not title:
        return "New Conversation"

    if len(title) <= max_length:
        return title

    return title[:max_length].rstrip() + "..."