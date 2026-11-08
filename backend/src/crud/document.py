from src.models.document import Document


def create_document(
    db,
    data
):
    document = Document(**data)

    db.add(document)
    db.commit()
    db.refresh(document)

    return document


def update_document_content(
    db,
    document,
    content
):
    document.content = content

    db.commit()
    db.refresh(document)

    return document


def get_documents_by_user(
    db,
    user_id
):
    return (
        db.query(Document)
        .filter(
            Document.uploaded_by == user_id
        )
        .order_by(
            Document.id.desc()
        )
        .all()
    )


def get_document_by_id(
    db,
    document_id,
    user_id
):
    return (
        db.query(Document)
        .filter(
            Document.id == document_id,
            Document.uploaded_by == user_id
        )
        .first()
    )


def delete_document(
    db,
    document
):
    db.delete(document)

    db.commit()