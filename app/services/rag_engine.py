"""
RAG Runbook Search Engine — retrieves relevant SRE runbooks and mitigation steps using vector/semantic matching.
"""

from __future__ import annotations

import json
import logging
import os
import re
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger("sentinel.rag_engine")

RUNBOOKS_FILE = Path(__file__).resolve().parent.parent / "data" / "runbooks.json"


class RAGEngine:
    """Semantic & Keyword retrieval engine for SRE runbooks."""

    def __init__(self):
        self.runbooks: List[Dict[str, Any]] = []
        self._load_runbooks()

    def _load_runbooks(self):
        try:
            if RUNBOOKS_FILE.exists():
                with open(RUNBOOKS_FILE, "r", encoding="utf-8") as f:
                    self.runbooks = json.load(f)
                logger.info(f"[RAGEngine] Loaded {len(self.runbooks)} SRE runbooks.")
            else:
                logger.warning(f"[RAGEngine] Runbooks file not found at {RUNBOOKS_FILE}")
        except Exception as e:
            logger.error(f"[RAGEngine] Failed to load runbooks: {e}")

    def search_runbook(self, text: str) -> Optional[Dict[str, Any]]:
        """
        Search for the best matching runbook given incident text/stack trace.
        Uses multi-word token overlap and keyword density scoring.
        """
        if not self.runbooks or not text:
            return None

        normalized_text = text.lower()
        tokens = set(re.findall(r'[a-zA-Z0-9_\-]+', normalized_text))

        best_match = None
        highest_score = 0.0

        for rb in self.runbooks:
            score = 0.0
            # Check keywords match
            keywords = rb.get("keywords", [])
            for kw in keywords:
                kw_lower = kw.lower()
                if kw_lower in normalized_text:
                    score += 2.5
                elif kw_lower in tokens:
                    score += 1.5

            # Check title words match
            title_words = set(re.findall(r'[a-zA-Z0-9_\-]+', rb.get("title", "").lower()))
            overlap = len(tokens.intersection(title_words))
            score += overlap * 1.0

            if score > highest_score:
                highest_score = score
                best_match = rb

        # Minimum relevance threshold
        if highest_score >= 2.0:
            logger.info(f"[RAGEngine] Found matching runbook: '{best_match['title']}' (score: {highest_score})")
            return {
                "id": best_match["id"],
                "title": best_match["title"],
                "summary": best_match["summary"],
                "mitigation_steps": best_match["mitigation_steps"],
                "recommended_action": best_match.get("recommended_action"),
                "action_params": best_match.get("action_params", {}),
                "relevance_score": highest_score,
            }

        return None


# Global singleton
rag_engine = RAGEngine()
