"""
Postmortem Generator Agent — creates markdown postmortems and commits to GitHub.

Input: full thread_context for a resolved incident
Output: markdown doc with Summary, Timeline, Root Cause, Resolution, Time-to-Resolve
Commits to: postmortems/incident-{id}-{date}.md in the configured GitHub repo
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Optional

import httpx
from openai import AsyncOpenAI

from app.config import settings
from app.models import Incident, ThreadContext

logger = logging.getLogger("sentinel.postmortem_agent")


SYSTEM_PROMPT = """You are Sentinel's Postmortem Generator — you produce clear, professional incident postmortems.

Given an incident's full timeline (thread context across all channels), generate a markdown postmortem.

The postmortem MUST include these sections:
# Incident Postmortem: {title}

## Summary
2-3 sentence executive summary of what happened.

## Incident Details
- **Severity:** ...
- **Status:** Resolved
- **Duration:** ...
- **Incident ID:** ...

## Timeline
Chronological list of all events, channel messages, escalations, and actions taken.
Format: `HH:MM UTC | channel | sender | message`

## Root Cause
What caused the incident (if stated by engineers). If unclear, state "Root cause under investigation."

## Resolution
What was done to resolve it.

## Action Items
- [ ] (any follow-up tasks mentioned during the incident)

## Time to Resolve
Total duration from first event to resolution.

Write in a professional but concise SRE style. Use only the information provided."""


async def generate_postmortem(
    *,
    incident: Incident,
    thread_context: list[ThreadContext],
) -> Optional[str]:
    """
    Generate a postmortem markdown document and commit it to GitHub.

    Returns: GitHub URL of the committed file, or None on failure.
    """
    if not thread_context:
        logger.warning(f"[PostmortemAgent] No thread context for incident {incident.id}")
        return None

    # Safe datetime helper for timezone-aware/naive compatibility
    def _to_utc_naive(dt: Optional[datetime]) -> datetime:
        if not dt:
            return datetime.min
        if dt.tzinfo is not None:
            return dt.astimezone(timezone.utc).replace(tzinfo=None)
        return dt

    # Build timeline text for LLM
    timeline_entries = sorted(thread_context, key=lambda t: _to_utc_naive(t.created_at))
    timeline_text = "\n".join(
        f"{_to_utc_naive(t.created_at).strftime('%H:%M UTC')} | {t.channel} | {t.sender} | {t.message}"
        for t in timeline_entries
    )

    # Calculate duration
    duration_str = "Unknown"
    if incident.resolved_at and incident.created_at:
        delta = _to_utc_naive(incident.resolved_at) - _to_utc_naive(incident.created_at)
        minutes = int(delta.total_seconds() / 60)
        hours = minutes // 60
        mins = minutes % 60
        duration_str = f"{hours}h {mins}m" if hours else f"{mins}m"

    context = {
        "incident_id": str(incident.id),
        "title": incident.title,
        "severity": incident.severity,
        "status": incident.status,
        "created_at": incident.created_at.isoformat() if incident.created_at else None,
        "resolved_at": incident.resolved_at.isoformat() if incident.resolved_at else None,
        "duration": duration_str,
        "escalation_count": incident.escalation_count,
        "agent_reasoning": incident.agent_reasoning,
        "channels_involved": list({t.channel for t in thread_context}),
        "timeline": timeline_text,
    }

    user_message = f"""Generate a postmortem for this resolved incident:

{json.dumps(context, indent=2)}

Full timeline:
{timeline_text}"""

    try:
        client = AsyncOpenAI(
            api_key=settings.openai_api_key,
            base_url=settings.openai_base_url or None,
        )
        response = await client.chat.completions.create(
            model=settings.openai_model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            temperature=0.3,
            max_tokens=2000,
        )
        markdown_content = response.choices[0].message.content.strip()

        logger.info(f"[PostmortemAgent] Generated postmortem for incident {incident.id} ({len(markdown_content)} chars)")

        from app.services.activity_logger import activity_logger
        await activity_logger.log_activity(
            category="llm",
            title=f"Postmortem Synthesis [{incident.title[:30]}]",
            summary=f"AI synthesized incident postmortem ({len(markdown_content)} characters)",
            details=markdown_content[:600] + ("..." if len(markdown_content) > 600 else ""),
            incident_id=str(incident.id),
            incident_title=incident.title,
            severity=incident.severity,
            metadata={"agent": "postmortem_generator", "chars": len(markdown_content)},
        )

        # Commit to GitHub
        github_url = await _commit_to_github(incident, markdown_content)
        return github_url

    except Exception as e:
        logger.error(f"[PostmortemAgent] Failed: {e}")
        return None


async def _commit_to_github(incident: Incident, content: str) -> Optional[str]:
    """Commit postmortem markdown to GitHub via REST API."""
    from app.services.activity_logger import activity_logger

    date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    short_id = str(incident.id)[:8]
    filename = f"postmortems/incident-{short_id}-{date_str}.md"

    if not settings.github_token:
        logger.warning("[PostmortemAgent] No GITHUB_TOKEN — skipping commit")
        simulated_url = f"https://github.com/{settings.github_postmortem_repo}/blob/{settings.github_postmortem_branch}/{filename}"
        await activity_logger.log_activity(
            category="github",
            title="GitHub Postmortem Prepared (Token Not Set)",
            summary=f"Postmortem markdown prepared for repo {settings.github_postmortem_repo}",
            details=f"File: {filename}\nStatus: Ready for commit",
            incident_id=str(incident.id),
            incident_title=incident.title,
            severity=incident.severity,
            metadata={"repo": settings.github_postmortem_repo, "filename": filename, "simulated": True},
        )
        return None

    url = f"https://api.github.com/repos/{settings.github_postmortem_repo}/contents/{filename}"

    import base64
    content_b64 = base64.b64encode(content.encode()).decode()

    payload = {
        "message": f"postmortem: incident-{short_id} [{date_str}] — {incident.severity} severity",
        "content": content_b64,
        "branch": settings.github_postmortem_branch,
    }

    headers = {
        "Authorization": f"Bearer {settings.github_token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.put(url, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()
            html_url = data.get("content", {}).get("html_url", "")
            logger.info(f"[PostmortemAgent] ✅ Committed to GitHub: {html_url}")
            await activity_logger.log_activity(
                category="github",
                title="GitHub Postmortem Committed",
                summary=f"Automated postmortem committed to {settings.github_postmortem_repo}@{settings.github_postmortem_branch}",
                details=f"File: {filename}\nURL: {html_url}",
                incident_id=str(incident.id),
                incident_title=incident.title,
                severity=incident.severity,
                metadata={
                    "github_url": html_url,
                    "repo": settings.github_postmortem_repo,
                    "branch": settings.github_postmortem_branch,
                    "filename": filename,
                },
            )
            return html_url
    except httpx.HTTPStatusError as e:
        logger.error(f"[PostmortemAgent] GitHub commit failed: {e.response.status_code} {e.response.text}")
        await activity_logger.log_activity(
            category="github",
            title="GitHub Commit Failed",
            summary=f"GitHub API error {e.response.status_code}",
            details=e.response.text[:300],
            incident_id=str(incident.id),
            incident_title=incident.title,
            severity=incident.severity,
            metadata={"status_code": e.response.status_code},
        )
        return None
    except Exception as e:
        logger.error(f"[PostmortemAgent] GitHub commit error: {e}")
        return None
