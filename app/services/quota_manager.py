"""
Quota Manager Service — Tracks and optimizes Resend API consumption.
Features:
- Daily outbound email rate limiting & rolling budget
- Circuit breaker for Resend API rate limits (429/403/daily limit)
- Per-incident notification cooldown to prevent email storms
- Dry-run / mock mode simulation
"""

import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, List
from app.config import settings

logger = logging.getLogger("sentinel.quota_manager")


class EmailQuotaManager:
    def __init__(self):
        # Timestamps of actual Resend API calls within the last 24h
        self._sent_timestamps: List[datetime] = []
        # Count of simulated / saved mock emails
        self._mock_count: int = 0
        # Map of incident_id -> last email dispatch timestamp
        self._incident_last_sent: Dict[str, datetime] = {}
        # Circuit breaker state
        self._circuit_breaker_tripped: bool = False
        self._circuit_breaker_reason: Optional[str] = None
        self._circuit_breaker_tripped_at: Optional[datetime] = None

    def _cleanup_old_timestamps(self):
        cutoff = datetime.utcnow() - timedelta(hours=24)
        self._sent_timestamps = [ts for ts in self._sent_timestamps if ts > cutoff]

        # Reset circuit breaker after 24h if tripped
        if self._circuit_breaker_tripped and self._circuit_breaker_tripped_at:
            if datetime.utcnow() - self._circuit_breaker_tripped_at > timedelta(hours=24):
                self._circuit_breaker_tripped = False
                self._circuit_breaker_reason = None
                self._circuit_breaker_tripped_at = None
                logger.info("[QuotaManager] Circuit breaker auto-reset after 24h cooldown.")

    def trip_circuit_breaker(self, reason: str = "Resend API quota exceeded"):
        """Trip circuit breaker to divert all subsequent email requests to mock/safe mode."""
        self._circuit_breaker_tripped = True
        self._circuit_breaker_reason = reason
        self._circuit_breaker_tripped_at = datetime.utcnow()
        logger.warning(f"[QuotaManager] ⚠️ CIRCUIT BREAKER TRIPPED: {reason}. Switching to mock mode.")

    def reset_circuit_breaker(self):
        """Manually reset the circuit breaker."""
        self._circuit_breaker_tripped = False
        self._circuit_breaker_reason = None
        self._circuit_breaker_tripped_at = None
        logger.info("[QuotaManager] Circuit breaker manually reset.")

    def can_send_email(
        self,
        incident_id: Optional[str] = None,
        severity: str = "critical",
        is_demo: bool = False,
    ) -> tuple[bool, str]:
        """
        Evaluate whether an email should be sent via live Resend API.
        Returns:
            (allow_real_send: bool, reason: str)
        """
        self._cleanup_old_timestamps()

        # 1. Configured Dry-Run Mode
        if settings.email_dry_run:
            return False, "dry_run_mode_enabled"

        # 2. Demo / Chaos Burst Guard
        if is_demo and not settings.demo_send_real_emails:
            return False, "demo_synthetic_guard_active"

        # 3. Circuit Breaker Active
        if self._circuit_breaker_tripped:
            return False, f"circuit_breaker_tripped ({self._circuit_breaker_reason})"

        # 4. Severity Filter (Email reserved for critical alerts)
        if settings.email_min_severity and severity.lower() != settings.email_min_severity.lower():
            if severity.lower() not in ["critical", "p1"]:
                return False, f"severity_below_threshold ({severity} < {settings.email_min_severity})"

        # 5. Incident Cooldown Check
        if incident_id:
            last_sent = self._incident_last_sent.get(str(incident_id))
            if last_sent:
                cooldown_delta = datetime.utcnow() - last_sent
                if cooldown_delta < timedelta(minutes=settings.email_cooldown_minutes):
                    remaining_sec = int((timedelta(minutes=settings.email_cooldown_minutes) - cooldown_delta).total_seconds())
                    return False, f"incident_cooldown_active ({remaining_sec}s remaining)"

        # 6. Daily Quota Check
        used_today = len(self._sent_timestamps)
        if used_today >= settings.email_daily_quota:
            self.trip_circuit_breaker(f"Daily budget reached ({used_today}/{settings.email_daily_quota})")
            return False, "daily_quota_budget_exceeded"

        return True, "allowed"

    def record_email_dispatched(
        self,
        incident_id: Optional[str] = None,
        real_api_call: bool = True,
    ):
        """Record that an email was either sent live or simulated."""
        now = datetime.utcnow()
        if real_api_call:
            self._sent_timestamps.append(now)
        else:
            self._mock_count += 1

        if incident_id:
            self._incident_last_sent[str(incident_id)] = now

    def get_status(self) -> Dict:
        """Return diagnostic metrics on email usage."""
        self._cleanup_old_timestamps()
        sent_today = len(self._sent_timestamps)
        return {
            "resend_configured": bool(settings.resend_api_key and "YOUR_RESEND" not in settings.resend_api_key),
            "email_dry_run": settings.email_dry_run,
            "demo_send_real_emails": settings.demo_send_real_emails,
            "daily_sent_count": sent_today,
            "daily_quota_limit": settings.email_daily_quota,
            "remaining_quota": max(0, settings.email_daily_quota - sent_today),
            "mock_emails_saved": self._mock_count,
            "circuit_breaker": {
                "tripped": self._circuit_breaker_tripped,
                "reason": self._circuit_breaker_reason,
                "tripped_at": self._circuit_breaker_tripped_at.isoformat() if self._circuit_breaker_tripped_at else None,
            },
        }


# Global singleton instance
quota_manager = EmailQuotaManager()
