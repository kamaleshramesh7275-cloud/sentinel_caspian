"""
APM Ingestion Adapters — normalize native webhook payloads from Sentry, Datadog, and GitHub Actions.

Each adapter:
1. Extracts human-readable incident title
2. Extracts or computes normalized MD5 error_signature for temporal clustering
3. Normalizes payload into standard Sentinel WebhookPayload format
"""

from __future__ import annotations

import hashlib
import json
import logging
from typing import Any, Dict

logger = logging.getLogger("sentinel.apm_adapters")


def _md5_hash(text: str) -> str:
    """Generate a clean 16-char hex hash from input text."""
    return hashlib.md5(text.encode("utf-8", errors="ignore")).hexdigest()[:16]


def parse_sentry_payload(raw: Dict[str, Any]) -> Dict[str, Any]:
    """
    Parse native Sentry webhook payload (Issue alert or Event alert).
    """
    # Sentry issues or event structure
    event_data = raw.get("event") or raw.get("data", {}).get("event") or raw
    issue_data = raw.get("data", {}).get("issue") or raw.get("issue") or {}

    title = (
        raw.get("message")
        or issue_data.get("title")
        or event_data.get("title")
        or event_data.get("message")
        or "Sentry Exception Detected"
    )

    culprit = event_data.get("culprit") or issue_data.get("culprit") or ""

    # Extract exception details if present
    exception_values = event_data.get("exception", {}).get("values", [])
    exc_type = "Exception"
    exc_val = ""
    frames_signature = ""

    if exception_values:
        first_exc = exception_values[0]
        exc_type = first_exc.get("type", "Error")
        exc_val = first_exc.get("value", "")
        frames = first_exc.get("stacktrace", {}).get("frames", [])
        if frames:
            # Hash top 3 innermost frames (filename + function)
            recent_frames = frames[-3:]
            frames_signature = ":".join(f"{f.get('filename')}:{f.get('function')}" for f in recent_frames)

    # Compute deterministic error_signature
    sig_base = f"sentry:{exc_type}:{exc_val}:{frames_signature or culprit or title}"
    error_signature = _md5_hash(sig_base)

    service_name = (
        raw.get("project_name")
        or raw.get("project_slug")
        or event_data.get("tags", {}).get("server_name")
        or "backend"
    )

    return {
        "source": "sentry",
        "title": f"[{service_name.upper()}] {exc_type}: {title}",
        "error_signature": f"sentry_{error_signature}",
        "payload": {
            "sentry_project": service_name,
            "culprit": culprit,
            "exception_type": exc_type,
            "exception_value": exc_val,
            "url": raw.get("web_url") or issue_data.get("web_url", ""),
            "raw": raw,
        },
    }


def parse_datadog_payload(raw: Dict[str, Any]) -> Dict[str, Any]:
    """
    Parse native Datadog Monitor webhook payload.
    """
    title = (
        raw.get("event_title")
        or raw.get("title")
        or raw.get("msg_title")
        or "Datadog Monitor Alert"
    )

    body = raw.get("body") or raw.get("text") or raw.get("message") or ""
    alert_type = raw.get("alert_type") or raw.get("event_type") or "error"
    tags_str = raw.get("tags") or ""
    tags = [t.strip() for t in tags_str.split(",")] if isinstance(tags_str, str) else tags_str

    # Extract service tag if present
    service = "infrastructure"
    for tag in tags:
        if tag.startswith("service:"):
            service = tag.split("service:", 1)[1]
            break

    # Compute deterministic error_signature from title + service
    sig_base = f"datadog:{service}:{title}"
    error_signature = _md5_hash(sig_base)

    return {
        "source": "datadog",
        "title": f"[{service.upper()}] Datadog Alert: {title}",
        "error_signature": f"datadog_{error_signature}",
        "payload": {
            "service": service,
            "alert_type": alert_type,
            "body": body,
            "tags": tags,
            "link": raw.get("link") or raw.get("snapshot_url", ""),
            "raw": raw,
        },
    }


def parse_github_actions_payload(raw: Dict[str, Any]) -> Dict[str, Any]:
    """
    Parse native GitHub Actions workflow_job or workflow_run failure webhook.
    """
    # workflow_run event
    wf_run = raw.get("workflow_run")
    wf_job = raw.get("workflow_job")
    repo = raw.get("repository", {}).get("full_name", "unknown/repo")

    if wf_job:
        job_name = wf_job.get("name", "build")
        conclusion = wf_job.get("conclusion", "failure")
        html_url = wf_job.get("html_url", "")
        run_id = wf_job.get("run_id", "")
        title = f"CI Job Failure: {repo} / {job_name}"
        sig_base = f"github_actions:{repo}:{job_name}:{conclusion}"
    elif wf_run:
        wf_name = wf_run.get("name", "CI/CD Pipeline")
        conclusion = wf_run.get("conclusion", "failure")
        html_url = wf_run.get("html_url", "")
        run_id = wf_run.get("id", "")
        title = f"Workflow Failed: {repo} ({wf_name})"
        sig_base = f"github_actions:{repo}:{wf_name}:{conclusion}"
    else:
        title = f"GitHub Pipeline Failure in {repo}"
        run_id = raw.get("id", "")
        html_url = ""
        sig_base = f"github_actions:{repo}:{raw.get('action', 'failed')}"

    error_signature = _md5_hash(sig_base)

    return {
        "source": "github-actions",
        "title": title,
        "error_signature": f"gh_{error_signature}",
        "payload": {
            "repository": repo,
            "run_id": run_id,
            "url": html_url,
            "raw": raw,
        },
    }
