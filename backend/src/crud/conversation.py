from src.models.conversation import Conversation


def create_conversation(
    db,
    user_id
):
    conversation = Conversation(
        user_id=user_id
    )

    db.add(conversation)

    db.commit()

    db.refresh(
        conversation
    )

    return conversation


def get_conversation(
    db,
    conversation_id
):
    return (
        db.query(Conversation)
        .filter(
            Conversation.id == conversation_id
        )
        .first()
    )


def get_user_conversation(
    db,
    conversation_id,
    user_id
):
    return (
        db.query(Conversation)
        .filter(
            Conversation.id == conversation_id,
            Conversation.user_id == user_id
        )
        .first()
    )
def get_conversations_by_user(
    db,
    user_id
):
    return (
        db.query(Conversation)
        .filter(
            Conversation.user_id == user_id
        )
        .order_by(
            Conversation.id.desc()
        )
        .all()
    )


def delete_conversation(
    db,
    conversation
):
    db.delete(conversation)
    db.commit()