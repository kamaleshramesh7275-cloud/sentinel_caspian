# 🛡️ Sentinel — Autonomous AI Incident Commander

Sentinel is an AI agent system that acts as an autonomous Incident Commander. It ingests system alerts, uses an LLM to evaluate severity with dynamic error-clustering overrides, and manages cross-channel escalations (Slack, Telegram, Email) using the Caspian SDK.

---

## ⚙️ How It Works (Architecture & System Design)

```
                       ┌─────────────────────────┐
                       │  Inbound Alert Stream   │
                       │  (Sentry / Datadog)     │
                       └───────────┬─────────────┘
                                   │
                                   ▼
                       ┌─────────────────────────┐
                       │  POST /webhook          │
                       └───────────┬─────────────┘
                                   │
                                   ▼
                     ┌─────────────────────────────┐
                     │   Severity Reasoning Agent  │
                     │  - Gemini LLM Analysis      │
                     │  - Error Clustering Override│
                     └─────────────┬───────────────┘
                                   │
                                   ▼
                     ┌─────────────────────────────┐
                     │   Incident DB Record (ORM)  │
                     │  - Status: OPEN             │
                     │  - Severity: CRITICAL       │
                     └─────────────┬───────────────┘
                                   │
            ┌──────────────────────┴──────────────────────┐
            │                                             │
            ▼                                             ▼
┌─────────────────────────┐                   ┌─────────────────────────┐
│ APScheduler (30s Tick)  │                   │ Caspian CommClient      │
│ - Checks SLA timeouts   │                   │ - Multi-channel Hub     │
│ - Escalates channels    │                   │ - Unified @on_message   │
└───────────┬─────────────┘                   └───────────┬─────────────┘
            │                                             │
            ▼                                             ▼
┌─────────────────────────┐                   ┌─────────────────────────┐
│ Slack / Telegram / Email│                   │ Natural Reply Intent    │
│ Outbound Alerts         │                   │ Parsing Agent           │
└─────────────────────────┘                   └───────────┬─────────────┘
                                                          │
                                                          ▼
                                              ┌─────────────────────────┐
                                              │ Auto Postmortem Agent   │
                                              │ & GitHub Commit         │
                                              └─────────────────────────┘
```

### Core Execution Flow

1. **Ingestion (`POST /webhook`)**: High-frequency system alerts arrive via webhook. Events with identical `error_signature`s within a 20-minute sliding window are automatically grouped.
2. **AI Severity Assessment (`app/agents/severity_agent.py`)**: 
   - Uses **Google Gemini 2.5/Flash** via OpenAI-compatible endpoints.
   - Evaluates technical impact and raw payload summaries.
   - **Clustering Rule**: If 3 or more recurring failures are detected in the window, Sentinel automatically forces a **1-level severity override** (e.g., `HIGH` → `CRITICAL`) and logs `CLUSTERING OVERRIDE TRIGGERED` into the database.
3. **Multi-Channel Orchestration (`Caspian SDK`)**:
   - Outbound notifications format messages specifically for the target channel (rich blocks for Slack, urgent text for Telegram, formal HTML for Email).
   - Inbound replies across channels hit a single `@client.on_message` handler in `app/caspian_handler.py`.
4. **Intent Parsing Agent (`app/agents/intent_parser.py`)**:
   - Parses natural human replies (`"on it"`, `"ack"`, `"fixed"`).
   - Updates incident status to `ack` or `resolved`.
   - If a message is ambiguous, Sentinel sends a follow-up clarification request back into the channel thread.
5. **Auto Postmortem Generator (`app/agents/postmortem_agent.py`)**:
   - On resolution, generates a Markdown postmortem (Summary, Root Cause, Timeline, Resolution, TTR) and commits it to a GitHub repository.
6. **Escalation Engine (`app/services/escalation.py`)**:
   - Background APScheduler runs every 30s. If an unacknowledged incident breaches its SLA (e.g., 2 minutes for Critical), it automatically escalates to the next channel in the escalation path (Slack → Telegram → Email).

---

## ✅ What's Done (Completed Features)

### 1. Backend & Database Infrastructure
- **FastAPI Engine**: Fully structured API with CORS middleware, lifespan events, and robust error handlers.
- **SQLite Async Storage**: Configured `sqlite+aiosqlite:///./sentinel.db` to bypass local Windows SSL/PostgreSQL pooler hangs while retaining complete schema parity with PostgreSQL.
- **ORM Schema (`app/models.py`)**: Four core tables (`events`, `incidents`, `thread_context`, `escalation_rules`) using standard `JSON` types.

### 2. Gemini LLM Integration
- **OpenAI-Compatible Gemini Client**: Configured `OPENAI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/` with model `models/gemini-flash-latest`.
- **Robust JSON Extraction**: Built regex-backed JSON parser that cleanly extracts JSON payloads even when wrapped in Markdown blocks (` ```json `) or containing trailing commas.

### 3. Caspian Multi-Channel Handler
- Integrated Caspian CommClient with `@client.on_message` registered for unified cross-channel message handling.
- Implemented dual-mode incident matching (full 36-character UUID or 8-character short ID prefix like `ack 8b3fb055`).

### 4. Interactive Demo & Frontend Dashboard
- **`/demo/chaos` Endpoint**: Synthetic incident generator firing 3-event payment-service bursts with matching signatures to demonstrate real-time AI reasoning and severity overrides.
- **React + Vite + Tailwind Dashboard (`frontend/`)**: Dark instrument-panel interface displaying live stats, severity badges, channel indicators, a Chaos trigger button, and a cross-channel timeline viewer.
- **Automated Test Suite (`tests/test_core.py`)**: 6/6 unit tests passing for clustering fallbacks, escalation paths, and channel formatters.

---

## 📋 Production Channel & GitHub Token Setup Guide

To activate live messaging across Slack, Telegram, Email, and GitHub, update the placeholder values in [.env](file:///c:/projects/sentinel_caspian/.env):

### 1. Slack Integration (`SLACK_BOT_TOKEN`)
- Go to [api.slack.com/apps](https://api.slack.com/apps) → **Create New App** → *From Scratch*.
- Go to **OAuth & Permissions** → Add Bot Token Scopes: `chat:write`, `channels:read`, `incoming-webhook`.
- Click **Install to Workspace** and copy the `xoxb-...` token into `SLACK_BOT_TOKEN`.
- Set `SLACK_INCIDENT_CHANNEL` to your target channel name (e.g., `#incidents`).

### 2. Telegram Integration (`TELEGRAM_BOT_TOKEN`)
- Open Telegram and search for **[@BotFather](https://t.me/BotFather)**.
- Send `/newbot`, choose a name and username, and copy the HTTP API token into `TELEGRAM_BOT_TOKEN`.
- Add your bot to your incident group/chat, or send a message to `@userinfobot` to get your `chat_id`, and set `TELEGRAM_CHAT_ID`.

### 3. Email Integration (`RESEND_API_KEY`)
- Sign up at [resend.com](https://resend.com) → **API Keys** → *Create API Key*.
- Copy the `re_...` key into `RESEND_API_KEY`.
- Set `EMAIL_TO_ONCALL` to your team's on-call email address.

### 4. GitHub Postmortem Auto-Commit (`GITHUB_TOKEN` & `GITHUB_REPO`)
- Go to [github.com/settings/tokens](https://github.com/settings/tokens) → **Generate new token (classic)**.
- Select scope: `repo` (Full control of private repositories).
- Set `GITHUB_TOKEN=ghp_...` and `GITHUB_POSTMORTEM_REPO=your-username/sentinel-postmortems`.

---

## 🔮 Future Add-ons & Technical Roadmap

1. **Voice Alert Escalation (Twilio Integration)**:
   - Extend `escalation_path` to include `voice_call` for Critical incidents when Slack/Telegram/Email go unanswered after 10 minutes.
2. **Autonomous Auto-Remediation Agents**:
   - Provide Sentinel with execution tools (Kubernetes API / AWS SDK) to execute safe remediation actions (e.g., restarting pod deployments, clearing Redis caches, rolling back bad commits).
3. **RAG-Powered Runbook Suggestions**:
   - Connect Sentinel to an internal Vector DB (Pinecone/Qdrant) containing company runbooks to attach immediate debugging steps directly inside Slack alert threads.
4. **PagerDuty / Opsgenie Bi-directional Sync**:
   - Create webhooks for PagerDuty to synchronize incident states bi-directionally across enterprise monitoring systems.
