"""
Unified SRE LLM Provider.
Routes reasoning tasks to:
1. Fine-Tuned Sentinel-SRE 14B Model (`kamaleshkumarR/sentinell` on Hugging Face / vLLM / Ollama)
2. Cloud LLM Endpoints (Gemini / OpenAI compatible routers)
3. Self-healing fallback engine
"""

from __future__ import annotations

import json
import logging
import re
import time
from typing import Any, Optional

from openai import AsyncOpenAI
from app.config import settings

logger = logging.getLogger("sentinel.sre_llm_provider")


class SRELLMProvider:
    """Unified client for SRE foundation models and API endpoints."""

    def __init__(self):
        self._init_client()

    def _init_client(self):
        """Determine endpoint configuration and initialize AsyncOpenAI client."""
        # Check if Hugging Face token is explicitly provided
        if settings.hf_token:
            self.api_key = settings.hf_token
            self.base_url = settings.hf_inference_url
            self.model_name = settings.hf_model_id
            self.provider = "Hugging Face Hub (kamaleshkumarR/sentinell)"
        elif settings.openai_base_url:
            self.api_key = settings.openai_api_key or "none"
            self.base_url = settings.openai_base_url
            self.model_name = settings.openai_model
            if "generativelanguage.googleapis.com" in settings.openai_base_url:
                self.provider = "Google Gemini"
            elif "huggingface.co" in settings.openai_base_url:
                self.provider = "Hugging Face Inference Endpoint"
            else:
                self.provider = f"SRE Model Endpoint ({self.model_name})"
        else:
            self.api_key = settings.openai_api_key or "none"
            self.base_url = None
            self.model_name = settings.openai_model
            self.provider = "OpenAI / SRE Engine"

        self.client = AsyncOpenAI(
            api_key=self.api_key,
            base_url=self.base_url if self.base_url else None,
            timeout=10.0,
        )

    def reload_config(self):
        """Re-read configuration and reinitialize client."""
        self._init_client()

    async def generate_reasoning(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.2,
        max_tokens: int = 2048,
        response_format: Optional[dict] = None,
    ) -> str:
        """Call the underlying LLM with robust error handling and return text."""
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
            logger.warning(
                "LLM Provider call failed or timed out (%s) with model %s.",
                e,
                self.model_name,
            )
            raise

    async def generate_with_telemetry(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.2,
        max_tokens: int = 2048,
        response_format: Optional[dict] = None,
        agent_name: str = "Sentinel SRE Agent",
    ) -> tuple[str, dict[str, Any]]:
        """Call LLM and return both the raw string response and a full telemetry packet."""
        t0 = time.perf_counter()
        raw_output = ""
        error_msg = None
        try:
            raw_output = await self.generate_reasoning(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=temperature,
                max_tokens=max_tokens,
                response_format=response_format,
            )
        except Exception as e:
            error_msg = str(e)
            raise
        finally:
            latency_ms = round((time.perf_counter() - t0) * 1000, 1)
            prompt_tokens = len(system_prompt.split()) + len(user_prompt.split())
            completion_tokens = len(raw_output.split()) if raw_output else 0
            
            telemetry = {
                "agent_name": agent_name,
                "model": self.model_name,
                "provider": self.provider,
                "system_prompt": system_prompt,
                "user_prompt": user_prompt,
                "raw_response": raw_output,
                "latency_ms": latency_ms,
                "temperature": temperature,
                "tokens": {
                    "prompt": prompt_tokens,
                    "completion": completion_tokens,
                    "total": prompt_tokens + completion_tokens,
                },
                "error": error_msg,
            }

        return raw_output, telemetry

    async def generate_json(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.2,
        max_tokens: int = 2048,
    ) -> dict[str, Any]:
        """
        Generate reasoning and extract clean, validated JSON from the response.
        Handles markdown blocks (```json ... ```), raw braces, and trailing commas.
        """
        raw = await self.generate_reasoning(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            temperature=temperature,
            max_tokens=max_tokens,
            response_format={"type": "json_object"},
        )
        return self._extract_json(raw)

    def _extract_json(self, raw_text: str) -> dict[str, Any]:
        """Robustly extract and parse JSON from an LLM response string."""
        raw = raw_text.strip()

        # 1. Try markdown code block extraction
        json_match = re.search(r"```(?:json)?\s*([\s\S]*?)```", raw)
        if json_match:
            raw = json_match.group(1).strip()
        else:
            # 2. Try outermost curly braces block
            brace_match = re.search(r"(\{[\s\S]*\})", raw)
            if brace_match:
                raw = brace_match.group(1).strip()

        # 3. Strip trailing commas before closing braces/brackets
        raw = re.sub(r",\s*([}\]])", r"\1", raw)

        # 4. Parse
        return json.loads(raw)

    async def probe_health(self) -> dict[str, Any]:
        """Probes the configured model endpoint and returns latency & status."""
        t0 = time.perf_counter()
        status = "online"
        err_msg = None

        try:
            resp = await self.client.chat.completions.create(
                model=self.model_name,
                messages=[{"role": "user", "content": "ping"}],
                max_tokens=5,
                temperature=0.0,
            )
            _ = resp.choices[0].message.content
        except Exception as e:
            status = "error"
            err_msg = str(e)
            logger.warning("[SRE LLM Provider] Health probe failed: %s", e)

        latency_ms = round((time.perf_counter() - t0) * 1000, 1)

        return {
            "status": status,
            "model": self.model_name,
            "provider": self.provider,
            "base_url": self.base_url,
            "latency_ms": latency_ms,
            "error": err_msg,
        }


# Global singleton instance
sre_llm = SRELLMProvider()
