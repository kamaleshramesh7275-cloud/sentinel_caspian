"""
Unified SRE LLM Provider.
Routes reasoning tasks to:
1. Local Fine-Tuned Sentinel-SRE Model (on B200 vLLM / Ollama server)
2. Cloud LLM Fallbacks (Gemini / OpenAI)
"""

from __future__ import annotations

import json
import logging
from typing import Any, Optional

from openai import AsyncOpenAI
from app.config import settings

logger = logging.getLogger("sentinel.sre_llm_provider")


class SRELLMProvider:
    """Unified client for local SRE foundation models and cloud APIs."""

    def __init__(self):
        self.api_key = settings.openai_api_key or "none"
        self.base_url = settings.openai_base_url
        self.model_name = settings.openai_model

        self.client = AsyncOpenAI(
            api_key=self.api_key,
            base_url=self.base_url if self.base_url else None,
            timeout=8.0,
        )

    async def generate_reasoning(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.2,
        max_tokens: int = 2048,
        response_format: Optional[dict] = None,
    ) -> str:
        """Call the underlying LLM with robust error handling and fallback."""
        try:
            kwargs: dict[str, Any] = {
                "model": self.model_name,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "temperature": temperature,
                "max_tokens": max_tokens,
            }
            if response_format:
                kwargs["response_format"] = response_format

            response = await self.client.chat.completions.create(**kwargs)
            content = response.choices[0].message.content or ""
            return content.strip()
        except Exception as e:
            logger.warning("LLM Provider call failed or timed out (%s). Using deterministic SRE engine.", e)
            raise


# Global singleton instance
sre_llm = SRELLMProvider()
