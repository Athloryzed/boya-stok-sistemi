"""
Merkezi AI yapılandırması — tüm AI çağrıları buradan model alır.
Model değişimi için sadece backend/.env içindeki AI_PROVIDER / AI_MODEL güncellenir.
"""
import os
import logging

from emergentintegrations.llm.chat import LlmChat

logger = logging.getLogger(__name__)

DEFAULT_PROVIDER = "anthropic"
DEFAULT_MODEL = "claude-opus-4-8"


def get_ai_model() -> tuple:
    provider = os.environ.get("AI_PROVIDER") or DEFAULT_PROVIDER
    model = os.environ.get("AI_MODEL") or DEFAULT_MODEL
    return provider, model


def get_llm_key() -> str:
    return os.environ.get("EMERGENT_LLM_KEY") or ""


def build_chat(session_id: str, system_message: str) -> LlmChat:
    """Yapılandırılmış LlmChat örneği döndürür (her çağrı için yeni instance)."""
    provider, model = get_ai_model()
    return LlmChat(
        api_key=get_llm_key(),
        session_id=session_id,
        system_message=system_message,
    ).with_model(provider, model)
