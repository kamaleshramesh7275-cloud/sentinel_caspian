"""
Unit tests for APM webhook adapters (Sentry, Datadog, GitHub Actions).
"""

import pytest
from app.services.apm_adapters import (
    parse_sentry_payload,
    parse_datadog_payload,
    parse_github_actions_payload,
)


def test_parse_sentry_payload():
    raw_sentry = {
        "project_name": "checkout-service",
        "message": "Database connection pool timeout",
        "culprit": "checkout/db.py in get_connection",
        "event": {
            "title": "OperationalError: connection pool exhausted",
            "exception": {
                "values": [
                    {
                        "type": "OperationalError",
                        "value": "Connection pool exhausted (limit=50)",
                        "stacktrace": {
                            "frames": [
                                {"filename": "app/main.py", "function": "handle_checkout"},
                                {"filename": "app/db.py", "function": "get_connection"},
                            ]
                        },
                    }
                ]
            },
        },
    }

    result = parse_sentry_payload(raw_sentry)
    assert result["source"] == "sentry"
    assert "CHECKOUT-SERVICE" in result["title"]
    assert "OperationalError" in result["title"]
    assert result["error_signature"].startswith("sentry_")
    assert result["payload"]["exception_type"] == "OperationalError"
    assert result["payload"]["sentry_project"] == "checkout-service"


def test_parse_datadog_payload():
    raw_datadog = {
        "event_title": "High CPU utilization on host worker-04",
        "body": "CPU usage is 98% for > 5 minutes",
        "alert_type": "error",
        "tags": "environment:production,service:payment-processor,region:us-east-1",
        "link": "https://app.datadoghq.com/monitors/12345",
    }

    result = parse_datadog_payload(raw_datadog)
    assert result["source"] == "datadog"
    assert "[PAYMENT-PROCESSOR]" in result["title"]
    assert result["error_signature"].startswith("datadog_")
    assert result["payload"]["service"] == "payment-processor"
    assert result["payload"]["alert_type"] == "error"


def test_parse_github_actions_payload():
    raw_gh = {
        "repository": {"full_name": "acme-corp/api-gateway"},
        "workflow_job": {
            "name": "run-integration-tests",
            "conclusion": "failure",
            "html_url": "https://github.com/acme-corp/api-gateway/actions/runs/999/job/111",
            "run_id": 999,
        },
    }

    result = parse_github_actions_payload(raw_gh)
    assert result["source"] == "github-actions"
    assert "CI Job Failure: acme-corp/api-gateway / run-integration-tests" == result["title"]
    assert result["error_signature"].startswith("gh_")
    assert result["payload"]["repository"] == "acme-corp/api-gateway"
