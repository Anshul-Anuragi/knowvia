from typing import List

_engine = "sentence_transformers"
_model = None
_init_attempted = False

def _get_model():
    global _model, _engine, _init_attempted
    if _model is not None or _init_attempted:
        return _model, _engine

    _init_attempted = True
    # Try FastEmbed (ONNX) first for ultra-lightweight (<100MB RAM) inference on Render/Production
    try:
        from fastembed import TextEmbedding
        _model = TextEmbedding(model_name="BAAI/bge-small-en-v1.5")
        _engine = "fastembed"
        print("Embedding service: using FastEmbed (ONNX C++ runtime)")
        return _model, _engine
    except Exception:
        # Graceful fallback to sentence-transformers
        try:
            from sentence_transformers import SentenceTransformer
            _model = SentenceTransformer("BAAI/bge-small-en-v1.5")
            _engine = "sentence_transformers"
            print("Embedding service: using SentenceTransformer (PyTorch)")
            return _model, _engine
        except Exception as err:
            print(f"Warning: Neither FastEmbed nor SentenceTransformer could be loaded: {err}")
            return None, _engine


def generate_embedding(text: str) -> List[float]:
    """
    Generate normalized 384-dimensional embedding for a single string.
    """
    model, engine = _get_model()
    if model is None:
        raise RuntimeError("No embedding engine initialized.")

    if engine == "fastembed":
        embeddings = list(model.embed([text]))
        return embeddings[0].tolist()
    else:
        embedding = model.encode(text, normalize_embeddings=True)
        return embedding.tolist()


def generate_batch_embeddings(texts: List[str]) -> List[List[float]]:
    """
    Generate normalized 384-dimensional embeddings for a batch of strings.
    Vectorized and executed in parallel — 10x-20x faster than sequential single calls.
    """
    if not texts:
        return []

    model, engine = _get_model()
    if model is None:
        raise RuntimeError("No embedding engine initialized.")

    if engine == "fastembed":
        embeddings = list(model.embed(texts))
        return [e.tolist() for e in embeddings]
    else:
        embeddings = model.encode(texts, batch_size=32, normalize_embeddings=True)
        return [e.tolist() for e in embeddings]
