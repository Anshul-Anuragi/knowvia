from src.models.message import Message


def get_messages_by_conversation(
    db,
    conversation_id
):
    return (
        db.query(Message)
        .filter(
            Message.conversation_id
            == conversation_id
        )
        .order_by(Message.created_at.asc())
        .all()
    )

def create_message(
    db,
    data
):
    message = Message(
        **data
    )

    db.add(message)

    db.commit()

    db.refresh(
        message
    )

    return 

def delete_messages_by_conversation(
    db,
    conversation_id
):
    db.query(Message).filter(
        Message.conversation_id == conversation_id
    ).delete(
        synchronize_session=False
    )