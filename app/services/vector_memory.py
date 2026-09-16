"""
Long-Term Episodic Vector Memory for Incident Precedents & RAG.

Indexes resolved incidents, postmortems, and runbook solutions into a vector space.
When new incidents arrive, Sentinel retrieves top-k historical precedents so the
LLM can cite exact prior resolutions ("Incident #42 from 2 weeks ago resolved this via...").
"""

from __future__ import annotations

import json
import logging
import math
import os
import re
from collections import Counter
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger("sentinel.vector_memory")

MEMORY_CACHE_FILE = "sentinel_vector_memory.json"


class EpisodicIncidentMemory:
    """In-memory Vector Store for Historical Incidents."""

    def __init__(self, cache_file: Optional[str] = MEMORY_CACHE_FILE):
        self.cache_file = cache_file
        self._records: List[Dict[str, Any]] = []
        if self.cache_file:
            self._load_memory()
        if not self._records:
            self._seed_default_history()

    def _tokenize(self, text: str) -> List[str]:
        """Simple, fast tokenization with n-grams for semantic lexical matching."""
        clean = re.sub(r"[^\w\s]", " ", text.lower())
        tokens = [w for w in clean.split() if len(w) > 2]
        # Add bigrams for context capture
        bigrams = [f"{tokens[i]}_{tokens[i+1]}" for i in range(len(tokens)-1)]
        return tokens + bigrams

    def _compute_vector(self, text: str) -> Dict[str, float]:
        """Calculate normalized TF vector."""
        tokens = self._tokenize(text)
        if not tokens:
            return {}
        counts = Counter(tokens)
        total = sum(counts.values())
        norm = math.sqrt(sum((c / total) ** 2 for c in counts.values())) or 1.0
        return {term: (c / total) / norm for term, c in counts.items()}

    def _cosine_similarity(self, vec1: Dict[str, float], vec2: Dict[str, float]) -> float:
        """Compute cosine similarity between two sparse vectors."""
        if not vec1 or not vec2:
            return 0.0
        # Dot product
        intersection = set(vec1.keys()) & set(vec2.keys())
        dot = sum(vec1[term] * vec2[term] for term in intersection)
        return dot

    def index_incident(
        self,
        *,
        incident_id: str,
        title: str,
        service: str,
        error_signature: str,
        root_cause: str,
        resolution: str,
        severity: str,
        duration_minutes: Optional[int] = None,
    ) -> None:
        """Add or update an incident in vector memory."""
        search_corpus = f"{title} {service} {error_signature} {root_cause} {resolution} {severity}"
        vector = self._compute_vector(search_corpus)

        # Check if exists
        for idx, rec in enumerate(self._records):
            if rec["incident_id"] == incident_id:
                self._records[idx] = {
                    "incident_id": incident_id,
                    "title": title,
                    "service": service,
                    "error_signature": error_signature,
                    "root_cause": root_cause,
                    "resolution": resolution,
                    "severity": severity,
                    "duration_minutes": duration_minutes or 15,
                    "resolved_at": datetime.now(timezone.utc).isoformat(),
                    "vector": vector,
                }
                self._save_memory()
                return

        self._records.append({
            "incident_id": incident_id,
            "title": title,
            "service": service,
            "error_signature": error_signature,
            "root_cause": root_cause,
            "resolution": resolution,
            "severity": severity,
            "duration_minutes": duration_minutes or 15,
            "resolved_at": datetime.now(timezone.utc).isoformat(),
            "vector": vector,
        })
        self._save_memory()
        logger.info(f"[VectorMemory] Indexed incident {incident_id} ({title})")

    def search_historical_incidents(
        self,
        query: str,
        *,
        service: Optional[str] = None,
        error_signature: Optional[str] = None,
        top_k: int = 3,
        threshold: float = 0.15,
    ) -> List[Dict[str, Any]]:
        """Find most similar historical incidents."""
        q_vector = self._compute_vector(f"{query} {service or ''} {error_signature or ''}")
        results = []

        for rec in self._records:
            score = self._cosine_similarity(q_vector, rec.get("vector", {}))
            
            # Exact error signature or service boost
            if error_signature and rec.get("error_signature") == error_signature:
                score += 0.35
            if service and rec.get("service") == service:
                score += 0.15

            if score >= threshold:
                results.append({
                    "incident_id": rec["incident_id"],
                    "title": rec["title"],
                    "service": rec["service"],
                    "error_signature": rec["error_signature"],
                    "root_cause": rec["root_cause"],
                    "resolution": rec["resolution"],
                    "severity": rec["severity"],
                    "duration_minutes": rec.get("duration_minutes", 15),
                    "resolved_at": rec.get("resolved_at"),
                    "similarity_score": round(min(score, 0.99), 2),
                })

        results.sort(key=lambda x: x["similarity_score"], reverse=True)
        return results[:top_k]

    def get_all_records(self) -> List[Dict[str, Any]]:
        """Return all memories excluding vectors for API transport."""
        return [
            {k: v for k, v in r.items() if k != "vector"}
            for r in self._records
        ]

    def _save_memory(self):
        if not self.cache_file:
            return
        try:
            with open(self.cache_file, "w", encoding="utf-8") as f:
                json.dump(self._records, f, indent=2)
        except Exception as e:
            logger.warning(f"[VectorMemory] Could not persist memory: {e}")

    def _load_memory(self):
        if self.cache_file and os.path.exists(self.cache_file):
            try:
                with open(self.cache_file, "r", encoding="utf-8") as f:
                    self._records = json.load(f)
                    logger.info(f"[VectorMemory] Loaded {len(self._records)} historical incidents from disk")
            except Exception as e:
                logger.warning(f"[VectorMemory] Could not load memory cache: {e}")

    def _seed_default_history(self):
        """Seed initial high-quality historical incident precedents."""
        defaults = [
            {
                "incident_id": "hist-inc-101",
                "title": "Stripe Webhook Gateway Timeout Storm",
                "service": "payment-service",
                "error_signature": "PaymentGatewayTimeout",
                "root_cause": "Third-party Stripe webhook receiver lacked exponential backoff on 504 Gateway Timeouts.",
                "resolution": "Applied defensive circuit breaker and increased HTTP timeout from 3s to 10s with fallback queueing.",
                "severity": "critical",
                "duration_minutes": 18,
            },
            {
                "incident_id": "hist-inc-102",
                "title": "PostgreSQL Connection Pool Starvation",
                "service": "checkout-api",
                "error_signature": "DBPoolExhaustion",
                "root_cause": "Async workers were acquiring DB sessions without async context manager exit, causing zombie connection leaks.",
                "resolution": "Drained idle connections, patched session cleanup wrapper, and boosted pool ceiling from 50 to 120.",
                "severity": "high",
                "duration_minutes": 12,
            },
            {
                "incident_id": "hist-inc-103",
                "title": "Redis Cache OOM Eviction Spike",
                "service": "inventory-service",
                "error_signature": "RedisMemoryPressure",
                "root_cause": "Unbounded session cache TTL caused Redis instance memory to breach 95% maxmemory threshold.",
                "resolution": "Flushed stale sessions, enforced strict 2-hour TTL policy, and upgraded Redis maxmemory-policy to volatile-lru.",
                "severity": "medium",
                "duration_minutes": 8,
            },
            {
                "incident_id": "hist-inc-104",
                "title": "Auth JWT Key Rotation Desync",
                "service": "auth-service",
                "error_signature": "JWTVerificationFailed",
                "root_cause": "JWKS caching proxy failed to invalidate public keys after scheduled 30-day rotation.",
                "resolution": "Purged JWKS edge cache and restarted auth-service pods to force immediate key reload.",
                "severity": "high",
                "duration_minutes": 6,
            }
        ]
        for d in defaults:
            self.index_incident(
                incident_id=d["incident_id"],
                title=d["title"],
                service=d["service"],
                error_signature=d["error_signature"],
                root_cause=d["root_cause"],
                resolution=d["resolution"],
                severity=d["severity"],
                duration_minutes=d["duration_minutes"],
            )


# Global singleton instance
vector_memory = EpisodicIncidentMemory()
