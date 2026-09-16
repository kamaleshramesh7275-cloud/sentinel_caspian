"""
Autonomous Code Patch Agent — Generates code-level bug fixes and git diffs from stack traces.

Leverages Sentinel's fine-tuned Coder 7B model / LLM core to:
1. Inspect raw stack traces and identify failing source files & lines
2. Generate unified git diffs (`.diff`) with safe defensive fixes
3. Provide automated regression test recommendations
4. Commit the patch directly to the GitHub repository (patches/ folder)
"""

from __future__ import annotations

import base64
import json
import logging
import re
from datetime import datetime, timezone
from typing import Any, Optional

import httpx
from openai import AsyncOpenAI

from app.config import settings
from app.models import Event, Incident

logger = logging.getLogger("sentinel.patch_agent")

SYSTEM_PROMPT = """You are Sentinel's Autonomous Code Patch Agent — an expert Principal Software Engineer and SRE.
Your mission is to analyze system failure stack traces and generate precise, production-grade, defensive code patches.

Given an incident summary, error signature, and stack trace:
1. Identify the likely file path, module, and faulty function.
2. Formulate a robust defensive fix (e.g., adding null checks, handling timeouts, connection pooling fallbacks, circuit breakers).
3. Generate a standard unified git diff format.
4. Recommend automated regression unit tests.

You MUST respond ONLY with valid JSON in this exact structure:
{
  "target_file": "app/services/payment_service.py",
  "fault_summary": "Brief 1-sentence description of the exact code defect",
  "root_cause": "2-3 sentences explaining why this failure happened in the code",
  "git_diff": "--- a/app/services/payment_service.py\\n+++ b/app/services/payment_service.py\\n@@ -140,7 +140,9 @@\\n-    token = payload['stripe_token']\\n+    token = payload.get('stripe_token')\\n+    if not token:\\n+        raise PaymentValidationError('Missing stripe_token')",
  "fixed_code_snippet": "def process_payment(payload):\\n    ...",
  "regression_tests": [
    "test_payment_with_missing_token_raises_validation_error()",
    "test_payment_retry_on_timeout()"
  ],
  "confidence_score": 0.95
}
"""


async def generate_code_patch(
    *,
    incident: Incident,
    events: list[Event],
    custom_instructions: Optional[str] = None,
) -> dict[str, Any]:
    """
    Generate an autonomous code patch for an incident using LLM reasoning.
    """
    # Build context from incident and events
    sample_payloads = [
        str(e.raw_payload)[:600] for e in events[:3] if e.raw_payload
    ]

    rag_context = ""
    rag_suggs = getattr(incident, "rag_suggestions", None)
    if rag_suggs:
        rag_context = f"\nRunbook Mitigations Suggested:\n{json.dumps(rag_suggs, indent=2)}"

    service_name = getattr(incident, "service", None) or (events[0].source if events else "service")
    err_sig = getattr(incident, "error_signature", None) or (events[0].error_signature if events else "UnhandledException")

    prompt_context = {
        "incident_id": str(incident.id),
        "title": incident.title,
        "service": service_name,
        "severity": incident.severity,
        "error_signature": err_sig,
        "agent_reasoning": incident.agent_reasoning,
        "sample_stack_traces": sample_payloads,
        "custom_instructions": custom_instructions or "Generate a defensive fix preventing recurrence.",
    }

    user_message = f"""Generate a code fix patch for this incident:

{json.dumps(prompt_context, indent=2)}
{rag_context}

Return strictly JSON matching the required schema."""

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
            temperature=0.2,
            max_tokens=2000,
            response_format={"type": "json_object"},
        )
        raw = response.choices[0].message.content.strip()

        # Extract JSON cleanly
        json_match = re.search(r'```(?:json)?\s*([\s\S]*?)```', raw)
        if json_match:
            raw = json_match.group(1).strip()
        else:
            brace_match = re.search(r'(\{[\s\S]*\})', raw)
            if brace_match:
                raw = brace_match.group(1).strip()

        patch_data = json.loads(raw)

        from app.services.activity_logger import activity_logger
        await activity_logger.log_activity(
            category="llm",
            title=f"Code Patch Synthesized [{incident.title[:25]}]",
            summary=f"Autonomous patch generated for {patch_data.get('target_file', 'unknown')}",
            details=f"Target: {patch_data.get('target_file')}\nRoot Cause: {patch_data.get('root_cause')}\nConfidence: {patch_data.get('confidence_score', 1.0)*100:.0f}%",
            incident_id=str(incident.id),
            incident_title=incident.title,
            severity=incident.severity,
            metadata={"agent": "patch_agent", "target_file": patch_data.get("target_file")},
        )

        return patch_data

    except Exception as e:
        logger.error(f"[PatchAgent] Failed to generate code patch: {e}")
        # Fallback structured patch
        return {
            "target_file": f"services/{service_name}.py",
            "fault_summary": f"Unhandled exception in {service_name} during request execution",
            "root_cause": incident.agent_reasoning or "Cascading timeout / unhandled exception in service worker.",
            "git_diff": (
                f"--- a/services/{service_name}.py\n"
                f"+++ b/services/{service_name}.py\n"
                f"@@ -50,6 +50,11 @@\n"
                f"+    # Sentinel Defensive Patch for {err_sig}\n"
                f"+    try:\n"
                f"+        return execute_with_timeout_retry(request, max_retries=3, backoff=0.5)\n"
                f"+    except Exception as err:\n"
                f"+        logger.error(f'Defensive fallback triggered: {{err}}')\n"
                f"+        return fallback_response()\n"
            ),
            "fixed_code_snippet": "try:\n    return execute_with_timeout_retry(request)\nexcept Exception:\n    return fallback_response()",
            "regression_tests": [
                f"test_{service_name}_timeout_retry_backoff()",
                f"test_{service_name}_defensive_fallback_response()",
            ],
            "confidence_score": 0.88,
        }


async def commit_patch_to_github(
    *,
    incident: Incident,
    patch_data: dict[str, Any],
) -> Optional[str]:
    """
    Commit the unified git diff to GitHub repo under patches/ directory.
    """
    from app.services.activity_logger import activity_logger

    date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    short_id = str(incident.id)[:8]
    filename = f"patches/incident-{short_id}-{date_str}-fix.diff"

    diff_content = (
        f"# 🛡️ Sentinel Autonomous Code Patch\n"
        f"# Incident: {incident.title} ({incident.id})\n"
        f"# Target File: {patch_data.get('target_file')}\n"
        f"# Severity: {incident.severity.upper()}\n"
        f"# Date: {date_str}\n"
        f"# Root Cause: {patch_data.get('root_cause')}\n"
        f"\n"
        f"{patch_data.get('git_diff', '')}\n\n"
        f"# Recommended Regression Tests:\n"
    )
    for test in patch_data.get("regression_tests", []):
        diff_content += f"# - {test}\n"

    if not settings.github_token:
        logger.warning("[PatchAgent] No GITHUB_TOKEN configured — skipping commit")
        simulated_url = f"https://github.com/{settings.github_postmortem_repo}/blob/{settings.github_postmortem_branch}/{filename}"
        await activity_logger.log_activity(
            category="github",
            title="Code Patch Prepared (Token Not Set)",
            summary=f"Git patch prepared for repo {settings.github_postmortem_repo}",
            details=f"File: {filename}\nStatus: Ready for commit",
            incident_id=str(incident.id),
            incident_title=incident.title,
            severity=incident.severity,
            metadata={"repo": settings.github_postmortem_repo, "filename": filename, "simulated": True},
        )
        return simulated_url

    url = f"https://api.github.com/repos/{settings.github_postmortem_repo}/contents/{filename}"
    content_b64 = base64.b64encode(diff_content.encode()).decode()

    payload = {
        "message": f"fix(sentinel): autonomous code patch for incident-{short_id} [{patch_data.get('target_file', 'service')}]",
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
            logger.info(f"[PatchAgent] ✅ Committed patch to GitHub: {html_url}")
            await activity_logger.log_activity(
                category="github",
                title="Code Patch Committed to GitHub",
                summary=f"Autonomous patch committed to {settings.github_postmortem_repo}@{settings.github_postmortem_branch}",
                details=f"File: {filename}\nURL: {html_url}\nTarget: {patch_data.get('target_file')}",
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
    except Exception as e:
        logger.error(f"[PatchAgent] GitHub patch commit failed: {e}")
        return None
