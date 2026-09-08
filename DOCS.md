# 🛡️ Sentinel — Autonomous Incident Commander

> *"It doesn't just tell you what's happening. It decides who needs to know, how urgently, and follows up until it's resolved."*

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Project Structure](#project-structure)
4. [Core Concepts](#core-concepts)
5. [Data Models](#data-models)
6. [API Reference](#api-reference)
7. [AI Agents](#ai-agents)
8. [Services](#services)
9. [Notification Channels](#notification-channels)
10. [Escalation Engine](#escalation-engine)
11. [Caspian SDK Integration](#caspian-sdk-integration)
12. [Frontend Dashboard](#frontend-dashboard)
13. [Configuration & Environment Variables](#configuration--environment-variables)
14. [Installation & Setup](#installation--setup)
15. [Running the Application](#running-the-application)
16. [Testing](#testing)
17. [Demo Mode](#demo-mode)
18. [Dependencies](#dependencies)

---

## Overview

**Sentinel** is a fully autonomous, AI-powered incident management system. It ingests events from any source (GitHub Actions, Datadog, PagerDuty, custom webhooks), clusters related events into incidents, determines severity using an LLM reasoning agent, dispatches notifications across multiple channels (Slack, Telegram, Email), and escalates without human intervention until an on-call engineer responds.

When an engineer replies in any channel, Sentinel parses the free-text intent (`ack`, `investigating`, `resolved`, `escalate`) and takes the appropriate action — including auto-generating a postmortem to GitHub when the incident is resolved.

### Key Features

| Feature | Description |
|---|---|
| **AI Severity Assessment** | LLM classifies every event as `low / medium / high / critical` with natural-language reasoning |
| **Clustering Detection** | Groups related events by `source + error_signature` within 30-min windows |
| **Severity Override** | 3+ occurrences of the same error signature in 20 min → automatic bump to next severity level |
| **Multi-Channel Escalation** | Auto-escalates Slack → Telegram → Email with per-severity SLA timers |
| **Intent Parsing** | Understands free-text replies: "I'm on it", "fixed", "need help" etc. |
| **Postmortem Generation** | Auto-generates structured markdown postmortems and commits to GitHub on resolution |
| **Unified Caspian Layer** | Single `@on_message` handler across all channels via Caspian SDK |
| **Live Dashboard** | React + Vite frontend with real-time incident feed and chaos demo button |

---

## Architecture

```
┌────────────────────────────────────────────────────────────┐
│                       Event Sources                        │
│       GitHub Actions · Datadog · PagerDuty · Custom        │
└────────────────────────┬───────────────────────────────────┘
                         │  POST /webhook  (X-Api-Key)
                         ▼
┌────────────────────────────────────────────────────────────┐
│                  FastAPI Backend (Sentinel)                 │
│                                                            │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  Webhook    │  │  Clustering  │  │  Severity Agent  │  │
│  │  Ingestion  │→ │  Engine(30m) │→ │  (LLM Reasoning) │  │
│  └─────────────┘  └──────────────┘  └──────────────────┘  │
│                                              │             │
│  ┌───────────────────────────────────────────▼──────────┐  │
│  │              Notifier Service                        │  │
│  │   Slack SDK · python-telegram-bot · Resend Email     │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │      APScheduler Escalation Engine (every 60s)       │  │
│  │  Checks SLAs · Advances channels · Re-notifies       │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │       Caspian CommClient (unified handler)           │  │
│  │  @on_message → Intent Parser → Status → Reply        │  │
│  └──────────────────────────────────────────────────────┘  │
└──────────────────────────┬─────────────────────────────────┘
                           │
             ┌─────────────┼──────────────┐
             ▼             ▼              ▼
        PostgreSQL       GitHub         React
        (SQLite dev)  (Postmortems)   Dashboard
```

### Startup Lifecycle

On startup (`lifespan`), Sentinel executes:

1. **Initialize Database** — creates all tables if not yet migrated
2. **Seed Escalation Rules** — inserts default severity → SLA → channel-path rules if empty
3. **Start APScheduler** — runs `run_escalation_check()` every `ESCALATION_INTERVAL_SECONDS` (default: 60s)
4. **Initialize Caspian CommClient** — connects Slack, Telegram, Email and registers the unified `@on_message` handler

---

## Project Structure

```
sentinel_caspian/
├── app/
│   ├── main.py                  # FastAPI app, lifespan, startup logic
│   ├── config.py                # Settings via pydantic-settings (.env)
│   ├── database.py              # Async SQLAlchemy engine + session factory
│   ├── models.py                # ORM models: Event, Incident, ThreadContext, EscalationRule
│   ├── schemas.py               # Pydantic request/response schemas
│   ├── caspian_handler.py       # Unified Caspian @on_message handler
│   ├── routers/
│   │   ├── webhook.py           # POST /webhook — event ingestion
│   │   ├── reply.py             # POST /reply/slack, /reply/telegram
│   │   ├── incidents.py         # GET /incidents, /incidents/{id}, /incidents/{id}/timeline
│   │   └── demo.py              # POST /demo/chaos — synthetic burst demo
│   ├── agents/
│   │   ├── severity_agent.py    # LLM severity classifier + clustering override
│   │   ├── intent_parser.py     # LLM intent parser for engineer replies
│   │   └── postmortem_agent.py  # LLM postmortem generator + GitHub commit
│   └── services/
│       ├── notifier.py          # Channel-specific message formatters & senders
│       └── escalation.py        # APScheduler escalation logic
├── frontend/
│   ├── src/
│   │   ├── App.tsx              # Main React dashboard
│   │   ├── api.ts               # API client functions
│   │   ├── types.ts             # TypeScript interfaces
│   │   ├── index.css            # Global styles (dark cyberpunk theme)
│   │   └── main.tsx             # React entry point
│   ├── index.html
│   ├── package.json
│   └── vite.config.ts
├── tests/
│   └── test_core.py             # Unit tests for severity, escalation, notifier
├── scripts/
│   └── seed_db.py               # Manual DB seeding script
├── requirements.txt
├── .env.example
├── pytest.ini
└── DOCS.md                      # This file
```

---

## Core Concepts

### Events

An **Event** represents a single raw signal from any external system. Events are the raw inputs to Sentinel and carry:
- `source` — where it came from (e.g. `github-actions`, `datadog`)
- `error_signature` — a normalized key for deduplication and clustering (e.g. `payment-service::deploy::exit-code-1`)
- `raw_payload` — the full JSON payload from the source

### Incidents

An **Incident** is Sentinel's unit of work. Multiple events can be **clustered** into one incident if they share the same `source + error_signature` within a 30-minute window.

Incident lifecycle:

```
open → escalated → ack → resolved
```

| Status | Meaning |
|---|---|
| `open` | Newly created, awaiting acknowledgment |
| `escalated` | SLA timer expired, notification advanced to next channel |
| `ack` | Engineer has acknowledged — escalation halted |
| `resolved` | Issue fixed — postmortem triggered |

### Escalation Rules

Default seeded rules (customizable in DB):

| Severity | Time-to-Ack | Escalation Path |
|---|---|---|
| `low` | 60 min | slack |
| `medium` | 15 min | slack → telegram |
| `high` | 5 min | slack → telegram |
| `critical` | 2 min | slack → telegram → email |

### Thread Context

Every message — whether from the AI agent, an engineer reply, or a system escalation — is stored as a `ThreadContext` entry, creating a complete cross-channel audit trail for each incident.

---

## Data Models

### `Event`

```
id              UUID     — Primary key
incident_id     UUID     — FK → Incident (nullable, set after clustering)
source          Text     — e.g. "github-actions", "datadog"
raw_payload     JSON     — Full raw event data
error_signature Text     — Normalized error key for deduplication
received_at     DateTime — UTC timestamp
```

### `Incident`

```
id                UUID     — Primary key
title             Text     — Human-readable incident title
severity          String   — low | medium | high | critical
status            String   — open | escalated | ack | resolved
current_channel   Text     — slack | telegram | email
escalation_count  Integer  — Number of times escalated
agent_reasoning   Text     — LLM's natural-language explanation
created_at        DateTime — First event received
last_notified_at  DateTime — Last notification sent (used for SLA timer)
resolved_at       DateTime — When resolved (nullable)
```

### `ThreadContext`

```
id              UUID     — Primary key
incident_id     UUID     — FK → Incident
channel         Text     — slack | telegram | email | system
sender          Text     — User ID or "sentinel-agent" / "system"
message         Text     — Full message text
intent_parsed   Text     — ack | investigating | resolved | escalate |
                           severity_assessment | escalation | postmortem | clarification
created_at      DateTime
```

### `EscalationRule`

```
id                    UUID     — Primary key
severity              Text     — Unique: low | medium | high | critical
time_to_ack_minutes   Integer  — SLA threshold in minutes
escalation_path       JSON     — Ordered list: ["slack", "telegram", "email"]
```

---

## API Reference

### Authentication

Most endpoints require an `X-Api-Key` header matching `SENTINEL_API_KEY`.

The `/demo/chaos`, `/incidents`, `/health`, and reply endpoints do **not** require an API key.

---

### `GET /` — Root

```json
{
  "name": "Sentinel",
  "tagline": "Autonomous Incident Commander",
  "version": "1.0.0",
  "docs": "/docs",
  "team": "Nova Legions"
}
```

---

### `GET /health` — Health Check

```json
{
  "status": "ok",
  "version": "1.0.0",
  "db": "connected",
  "channels_available": ["slack", "telegram", "email"]
}
```

---

### `POST /webhook` — Ingest Event

**Headers:** `X-Api-Key: <SENTINEL_API_KEY>`

**Request Body:**

```json
{
  "source": "github-actions",
  "error_signature": "payment-service::deploy::exit-code-1",
  "title": "Payment Service Deploy Failed",
  "payload": {
    "workflow": "Deploy Production",
    "error": "Run migrations failed",
    "branch": "main"
  }
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `source` | string | ✅ | Identifies the event origin (e.g. `datadog`, `github-actions`) |
| `error_signature` | string | ❌ | Normalized key for clustering; events with the same signature cluster into one incident |
| `title` | string | ❌ | Human-readable event title; auto-generated if omitted |
| `payload` | object | ❌ | Full raw event data (stored as JSON) |

**Processing Flow:**
1. Store raw event in DB
2. Cluster check: find open incident with same `source + error_signature` in last 30 min
3. Attach to existing incident OR create new one
4. Run Severity Reasoning Agent (LLM)
5. Determine initial notification channel from escalation rules
6. Send notification (background task — non-blocking)

**Response:**

```json
{
  "event_id": "uuid",
  "incident_id": "uuid",
  "action": "created",
  "severity": "high",
  "agent_reasoning": "The payment service deploy has failed with a migration error..."
}
```

| `action` | Meaning |
|---|---|
| `created` | New incident was opened |
| `attached` | Event clustered into existing incident |

---

### `GET /incidents` — List Incidents

**Query Parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `status` | string | — | Filter: `open`, `escalated`, `ack`, `resolved` |
| `severity` | string | — | Filter: `low`, `medium`, `high`, `critical` |
| `limit` | int | 50 | Max results (max: 200) |
| `offset` | int | 0 | Pagination offset |

**Response:**

```json
{
  "total": 42,
  "incidents": [
    {
      "id": "uuid",
      "title": "Payment Service Deploy Failed",
      "severity": "critical",
      "status": "escalated",
      "current_channel": "telegram",
      "escalation_count": 2,
      "agent_reasoning": "...",
      "created_at": "2026-09-06T13:00:00Z",
      "last_notified_at": "2026-09-06T13:07:00Z",
      "resolved_at": null
    }
  ]
}
```

---

### `GET /incidents/{incident_id}` — Get Incident

Returns a single incident by UUID. Returns `404` if not found.

---

### `GET /incidents/{incident_id}/timeline` — Incident Timeline

Returns the full cross-channel message thread for an incident, ordered chronologically.

**Response:**

```json
[
  {
    "id": "uuid",
    "incident_id": "uuid",
    "channel": "system",
    "sender": "sentinel-agent",
    "message": "Severity assessed: CRITICAL. CLUSTERING OVERRIDE TRIGGERED...",
    "intent_parsed": "severity_assessment",
    "created_at": "2026-09-06T13:00:05Z"
  },
  {
    "channel": "slack",
    "sender": "john.doe",
    "message": "I'm on it",
    "intent_parsed": "investigating",
    "created_at": "2026-09-06T13:03:10Z"
  }
]
```

---

### `POST /reply/slack` — Slack Events API Webhook

Receives Slack Events API callbacks. Handles URL verification challenge automatically.

Supports:
- `type: url_verification` — echoes back the `challenge` field
- `event.type: message` or `app_mention` — processes engineer reply

Slack signature verification is performed if `SLACK_SIGNING_SECRET` is configured.

---

### `POST /reply/telegram` — Telegram Bot Webhook

Receives Telegram Bot webhook `Update` objects and processes engineer replies.

---

### `POST /demo/chaos` — Trigger Chaos Burst

No API key required. Fires a pre-configured synthetic 3-event burst with the same `error_signature`.

**Response:**

```json
{
  "message": "🔥 Chaos triggered! 3 synthetic events fired. Severity escalated to CRITICAL...",
  "events_fired": 3,
  "incident_id": "uuid",
  "severity": "critical",
  "agent_reasoning": "CLUSTERING OVERRIDE TRIGGERED — 3 events with the same signature in <20 min..."
}
```

---

## AI Agents

### Severity Reasoning Agent

**File:** `app/agents/severity_agent.py`

The core differentiator. Uses an LLM (default: `gemini-2.0-flash`) to classify every incoming event.

**Input context provided to the LLM:**
- The new event (source, error_signature, raw_payload, timestamp)
- Up to 5 recent related events from the same source in the last 30 min
- Cluster analysis: count of same-signature events, override condition flag
- Current escalation rules (for SLA context)

**Severity Definitions:**

| Level | Criteria |
|---|---|
| `low` | Isolated, non-user-impacting, informational |
| `medium` | Degraded performance, potential user impact, recoverable |
| `high` | Significant user impact, service degradation, needs immediate attention |
| `critical` | Full outage, data loss risk, cascading failures, payment/auth down |

**Clustering Override Rule:**

> If the same `error_signature` appears **3+ times within 20 minutes**, the LLM **MUST** bump severity at least one level higher and state `"CLUSTERING OVERRIDE TRIGGERED"` in its reasoning.

**Fallback Behavior** (when LLM is unavailable):

```
cluster_count >= 5  →  critical
cluster_count >= 3  →  high
cluster_count >= 2  →  medium
cluster_count  = 1  →  low
```

**LLM Output Format:**

```json
{
  "severity": "critical",
  "override_triggered": true,
  "reasoning": "CLUSTERING OVERRIDE TRIGGERED. Payment service has failed 3 times..."
}
```

---

### Intent Parser Agent

**File:** `app/agents/intent_parser.py`

Translates free-text engineer replies into structured intent classifications.

**Valid Intents:**

| Intent | Example Triggers |
|---|---|
| `ack` | "got it", "on it", "I see it", "acknowledged" |
| `investigating` | "looking into it", "checking", "investigating" |
| `resolved` | "fixed", "resolved", "all clear", "rolled back" |
| `escalate` | "need help", "escalate", "page the DB team" |
| `unclear` | Ambiguous or unrelated message |

**LLM Output Format:**

```json
{
  "intent": "resolved",
  "confidence": 0.97,
  "reasoning": "Engineer explicitly states the issue is fixed.",
  "follow_up_question": null
}
```

When `intent = "unclear"`, Sentinel sends a follow-up clarification question back in the originating channel.

**Intent Actions:**

| Intent | Action Taken |
|---|---|
| `ack` | Sets `incident.status = "ack"`, stops escalation |
| `investigating` | Sets status to `ack` if not already, notes investigation |
| `resolved` | Sets `status = "resolved"`, records `resolved_at`, triggers postmortem |
| `escalate` | Resets `last_notified_at` to force escalation on next scheduler tick |
| `unclear` | Sends follow-up clarification question |

---

### Postmortem Generator Agent

**File:** `app/agents/postmortem_agent.py`

Auto-generates a professional incident postmortem when an incident is resolved.

**Input:** Full `ThreadContext` history for the incident (all channel messages, system logs, escalations).

**Generated Markdown Structure:**

```markdown
# Incident Postmortem: {title}

## Summary
## Incident Details
  - Severity, Status, Duration, Incident ID
## Timeline
  HH:MM UTC | channel | sender | message
## Root Cause
## Resolution
## Action Items
  - [ ] follow-up tasks
## Time to Resolve
```

**GitHub Commit:**
- File path: `postmortems/incident-{short_id}-{date}.md`
- Commit message: `postmortem: incident-{short_id} [{date}] — {severity} severity`
- Branch: `GITHUB_POSTMORTEM_BRANCH` (default: `main`)
- Returns the GitHub HTML URL on success, `None` on failure

---

## Services

### Notifier Service

**File:** `app/services/notifier.py`

Routes and sends notifications. Each channel has a distinct format:

#### Slack (Block Kit)
- Technical, detailed format
- Severity badge, incident ID, status, escalation count, AI reasoning snippet
- Reply instructions embedded in message
- Color-coded attachment bar

#### Telegram
- Short, urgent, plain language with emoji
- Severity emoji, title, short ID, elapsed time, escalation note
- Quick reply commands shown inline

#### Email (via Resend)
- Formal HTML incident report
- Severity-colored header banner
- Metadata table, AI reasoning section, required action checklist

**Severity Colors:**

| Severity | Emoji | Hex Color |
|---|---|---|
| `low` | 🟡 | `#FFDD57` |
| `medium` | 🟠 | `#FF9900` |
| `high` | 🔴 | `#FF3860` |
| `critical` | 🚨 | `#8B0000` |

**Channel Router:**

```python
send_channel_notification(incident, channel)
# Routes to: send_slack_notification | send_telegram_notification | send_email_notification
```

---

## Escalation Engine

**File:** `app/services/escalation.py`

Runs as an APScheduler background job every `ESCALATION_INTERVAL_SECONDS` (default: 60s).

**Algorithm:**

1. Fetch all incidents with status `open` or `escalated`
2. For each, load the corresponding `EscalationRule` by severity
3. Compute `elapsed = now - last_notified_at`
4. If `elapsed >= time_to_ack_minutes` → escalate:
   - Determine next channel in `escalation_path` (stays on last if exhausted)
   - Send notification to next channel
   - Increment `escalation_count`, update `current_channel`, set `status = "escalated"`, update `last_notified_at`
   - Log escalation entry to `ThreadContext`

**Channel Advancement:**

```
escalation_path = ["slack", "telegram", "email"]

slack    → telegram  (after SLA expires)
telegram → email     (after SLA expires again)
email    → email     (stays, keeps re-notifying)
```

---

## Notification Channels

### Slack Setup

1. Create a Slack App at [api.slack.com](https://api.slack.com)
2. Enable **Bot Token Scopes**: `chat:write`, `chat:write.public`
3. Enable **Event Subscriptions** → subscribe to `message.channels`, `app_mention`
4. Set the reply webhook URL to: `https://your-domain.com/reply/slack`
5. Copy `Bot User OAuth Token` → `SLACK_BOT_TOKEN`
6. Copy `Signing Secret` → `SLACK_SIGNING_SECRET`
7. Set `SLACK_INCIDENT_CHANNEL` to target channel (e.g. `#incidents`)

### Telegram Setup

1. Create a bot via [@BotFather](https://t.me/BotFather) → `TELEGRAM_BOT_TOKEN`
2. Add bot to group or get personal chat ID → `TELEGRAM_CHAT_ID`
3. Register webhook:
   ```
   https://api.telegram.org/bot{TOKEN}/setWebhook?url=https://your-domain.com/reply/telegram
   ```

### Email (Resend) Setup

1. Sign up at [resend.com](https://resend.com) → `RESEND_API_KEY`
2. `EMAIL_FROM` — must be a verified domain in Resend
3. `EMAIL_TO_ONCALL` — on-call engineer's email

### LLM Setup (OpenAI-compatible)

| Provider | `OPENAI_BASE_URL` | `OPENAI_MODEL` |
|---|---|---|
| OpenAI | *(leave blank)* | `gpt-4o-mini` |
| Gemini (free tier) | `https://generativelanguage.googleapis.com/v1beta/openai/` | `gemini-2.0-flash` |
| Groq | `https://api.groq.com/openai/v1` | `llama-3.1-70b-versatile` |

---

## Caspian SDK Integration

**File:** `app/caspian_handler.py`

Sentinel uses the [Caspian SDK](https://trycaspianai.com) as a unified communication layer. A **single `@on_message` handler** processes replies from all channels (Slack, Telegram, Email).

### How It Works

```python
@client.on_message
async def handle_message(message):
    # Caspian normalizes the message — same interface for all channels
    text    = message.text
    channel = message.channel   # "slack" | "telegram" | "email"
    sender  = message.sender

    # Extract incident ID → parse intent → update DB → reply
    await message.reply(reply_text)  # Routes to correct channel/thread automatically
```

### Channel Connection (startup)

```python
client.connect_slack(token=SLACK_BOT_TOKEN, username="sentinel-agent")
client.connect_telegram(bot_token=TELEGRAM_BOT_TOKEN, username="sentinel-agent")
client.connect_email(api_key=RESEND_API_KEY, username="sentinel-agent")
```

The Caspian listener runs in a **background daemon thread** to avoid blocking the FastAPI event loop.

### Direct SDK Fallback

If `CASPIAN_API_KEY` is not configured, Sentinel falls back to direct channel SDKs (slack-sdk, python-telegram-bot, resend) for **outbound** notifications. Inbound replies are handled via `/reply/slack` and `/reply/telegram` HTTP webhooks.

---

## Frontend Dashboard

**Location:** `frontend/`

**Tech Stack:** React 19 + TypeScript + Vite + Tailwind CSS

### Features

| Feature | Description |
|---|---|
| **Live Incident Feed** | Polls `/incidents` every 5 seconds |
| **Stat Cards** | Total, Active, Critical, Resolved counts with conditional glow effects |
| **Status Filters** | Filter by `open`, `escalated`, `ack`, `resolved` |
| **Incident Cards** | Severity badge, status dot, channel badge, escalation counter, AI reasoning preview |
| **Detail Panel** | Full incident metadata, AI reasoning, cross-channel timeline |
| **Chaos Panel** | One-click `POST /demo/chaos` with live agent reasoning display |
| **Channel Indicators** | Header shows which channels are active/online |

### Design System

Dark cyberpunk theme:
- CSS custom properties: `--cyan`, `--violet`, `--red`, `--orange`, `--green`
- Glassmorphism panels with subtle borders
- Gradient text headings
- Animated pulsing indicators for critical incidents
- Monospace fonts throughout for technical aesthetic

### Running the Frontend

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173
```

Proxies API calls to `http://localhost:8000` via `vite.config.ts`.

### API Client (`api.ts`)

```typescript
fetchIncidents(status?)     → GET /incidents?status={status}
fetchHealth()               → GET /health
fetchTimeline(incidentId)   → GET /incidents/{id}/timeline
triggerChaos()              → POST /demo/chaos
```

### TypeScript Types (`types.ts`)

```typescript
interface Incident {
  id: string;
  title: string;
  severity: 'low' | 'medium' | 'high' | 'critical' | null;
  status: 'open' | 'escalated' | 'ack' | 'resolved';
  current_channel: string | null;
  escalation_count: number;
  agent_reasoning: string | null;
  created_at: string;
  last_notified_at: string;
  resolved_at: string | null;
}

interface TimelineEntry {
  id: string;
  incident_id: string;
  channel: string;
  sender: string;
  message: string;
  intent_parsed: string | null;
  created_at: string;
}

interface ChaosResponse {
  message: string;
  events_fired: number;
  incident_id: string | null;
  severity: string | null;
  agent_reasoning: string | null;
}
```

---

## Configuration & Environment Variables

Copy `.env.example` to `.env` and fill in your values.

### Database

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://postgres:postgres@localhost:5432/sentinel` | PostgreSQL connection string |

> **Recommended:** [Neon](https://neon.tech) serverless PostgreSQL for production.

### LLM

| Variable | Default | Description |
|---|---|---|
| `OPENAI_API_KEY` | — | API key for OpenAI or any compatible provider |
| `OPENAI_MODEL` | `gemini-2.0-flash` | Model used by all AI agents |
| `OPENAI_BASE_URL` | — | Override base URL for Gemini, Groq, etc. |

### Caspian

| Variable | Default | Description |
|---|---|---|
| `CASPIAN_API_KEY` | — | Caspian API key (run `caspian init` to generate) |
| `CASPIAN_BASE_URL` | `https://api.trycaspianai.com` | Caspian API endpoint |
| `CASPIAN_AGENT_USERNAME` | `sentinel-agent` | Agent identity shown across channels |

### Slack

| Variable | Default | Description |
|---|---|---|
| `SLACK_BOT_TOKEN` | — | Bot OAuth token (`xoxb-...`) |
| `SLACK_SIGNING_SECRET` | — | For Slack request signature verification |
| `SLACK_INCIDENT_CHANNEL` | `#incidents` | Channel for incident alerts |

### Telegram

| Variable | Default | Description |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | — | Bot token from @BotFather |
| `TELEGRAM_CHAT_ID` | — | Target group or user chat ID |

### Email (Resend)

| Variable | Default | Description |
|---|---|---|
| `RESEND_API_KEY` | — | Resend API key (`re_...`) |
| `EMAIL_FROM` | `sentinel@example.com` | Sender address (verified in Resend) |
| `EMAIL_TO_ONCALL` | `oncall@example.com` | On-call engineer's email |

### GitHub (Postmortems)

| Variable | Default | Description |
|---|---|---|
| `GITHUB_TOKEN` | — | Personal access token with `repo` write scope |
| `GITHUB_POSTMORTEM_REPO` | `your-org/your-repo` | Target repo (`owner/repo`) |
| `GITHUB_POSTMORTEM_BRANCH` | `main` | Branch for postmortem commits |

### Sentinel App

| Variable | Default | Description |
|---|---|---|
| `SENTINEL_API_KEY` | `sentinel-secret-key-change-me` | Webhook ingestion API key |
| `APP_BASE_URL` | `http://localhost:8000` | App URL (for webhook registration) |
| `ESCALATION_INTERVAL_SECONDS` | `60` | How often escalation check runs |

---

## Installation & Setup

### Prerequisites

- Python 3.11+
- PostgreSQL (or [Neon](https://neon.tech) account)
- Node.js 18+ (for frontend)

### Backend Setup

```bash
# 1. Clone and navigate
cd sentinel_caspian

# 2. Create virtual environment
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS/Linux

# 3. Install dependencies
pip install -r requirements.txt

# 4. Configure environment
copy .env.example .env          # Windows
# cp .env.example .env          # macOS/Linux
# Edit .env with your credentials

# 5. (Optional) Install and init Caspian
pip install caspian-sdk
caspian init                    # Mints API key, writes to .env
```

### Database Setup

```bash
# Tables are auto-created on first startup via init_db()
# For production migrations with Alembic:
alembic upgrade head
```

### Frontend Setup

```bash
cd frontend
npm install
```

---

## Running the Application

### Backend

```bash
# Development (auto-reload)
uvicorn app.main:app --reload --port 8000

# Or via Python
python -m app.main
```

**API Docs:**
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

### Frontend

```bash
cd frontend
npm run dev
# → http://localhost:5173
```

### Send a Test Webhook

```bash
curl -X POST http://localhost:8000/webhook \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: sentinel-secret-key-change-me" \
  -d '{
    "source": "github-actions",
    "error_signature": "api-service::health::timeout",
    "title": "API Health Check Timeout",
    "payload": {
      "endpoint": "/api/health",
      "latency_ms": 5400,
      "status": 504
    }
  }'
```

### Simulate an Engineer Reply

```bash
curl -X POST http://localhost:8000/reply/slack \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Got it, investigating the health check timeout — incident abc12345",
    "sender": "jane.doe"
  }'
```

---

## Testing

```bash
# Run all tests
pytest tests/ -v

# Run specific test file
pytest tests/test_core.py -v
```

### Test Coverage

| Test | Description |
|---|---|
| `test_fallback_severity_by_cluster_count` | Verifies fallback severity scales: 1→low, 2→medium, 3→high, 5→critical |
| `test_get_next_channel_advances` | Verifies channel advancement: slack→telegram→email, stays on email |
| `test_get_next_channel_not_in_path` | Verifies default to first channel when current is not in path |
| `test_format_slack_message` | Verifies Block Kit structure, severity label, and attachments |
| `test_format_telegram_message` | Verifies severity, ack instructions, and message is concise (<500 chars) |
| `test_format_email` | Verifies valid subject, HTML structure, and severity in subject |

---

## Demo Mode

The `POST /demo/chaos` endpoint fires a pre-configured synthetic incident burst without requiring any external integration.

### Synthetic Events Fired

1. **`github-actions`** — "Payment Service Deploy Failed" (migration error)
2. **`datadog`** — "Payment API Error Rate Spike" (18.7% error rate)
3. **`github-actions`** — "Payment Service Health Check Failing" (503 responses)

All three share `error_signature: payment-service::deploy::exit-code-1`.

### What You'll See

- Severity agent processes each event sequentially
- By the **3rd event**, clustering condition is met (≥3 same signature in 20 min)
- Agent **triggers CLUSTERING OVERRIDE** and bumps severity to `critical`
- Full LLM reasoning returned in response, visible in dashboard

### Dashboard Demo Walkthrough

1. Open `http://localhost:5173`
2. Click **"🔥 Trigger Chaos Burst"** in the Chaos Panel
3. Watch the agent reasoning appear with the clustering override
4. Click the new incident card to see the full cross-channel timeline

---

## Logging

Sentinel uses structured logging with format: `HH:MM:SS | LEVEL | logger_name | message`

| Logger | Source |
|---|---|
| `sentinel` | App startup/shutdown |
| `sentinel.webhook` | Event ingestion |
| `sentinel.reply` | Slack/Telegram reply processing |
| `sentinel.incidents` | Incident CRUD |
| `sentinel.severity_agent` | LLM severity reasoning |
| `sentinel.intent_parser` | LLM intent parsing |
| `sentinel.postmortem_agent` | Postmortem generation & GitHub commit |
| `sentinel.notifier` | Channel notifications |
| `sentinel.escalation` | APScheduler escalation checks |
| `sentinel.caspian_handler` | Caspian unified message handler |

---

## Dependencies

### Backend (`requirements.txt`)

| Package | Version | Purpose |
|---|---|---|
| `fastapi` | ≥0.115 | Web framework |
| `uvicorn[standard]` | ≥0.32 | ASGI server |
| `caspian-sdk` | ≥0.6 | Unified communication layer |
| `sqlalchemy[asyncio]` | ≥2.0 | ORM + async DB |
| `asyncpg` | ≥0.30 | Async PostgreSQL driver |
| `alembic` | ≥1.14 | DB migrations |
| `apscheduler` | ≥3.10 | Background scheduler |
| `openai` | ≥1.55 | LLM API client (OpenAI-compatible) |
| `slack-sdk` | ≥3.33 | Direct Slack notifications |
| `python-telegram-bot` | ≥21.7 | Telegram notifications |
| `httpx` | ≥0.28 | Async HTTP client (GitHub API) |
| `PyGithub` | ≥2.5 | GitHub REST API |
| `resend` | ≥2.4 | Email delivery |
| `pydantic-settings` | ≥2.6 | `.env` config management |
| `pytest` | ≥8.3 | Test framework |
| `pytest-asyncio` | ≥0.24 | Async test support |

### Frontend (`package.json`)

| Package | Version | Purpose |
|---|---|---|
| `react` | ^19 | UI framework |
| `react-dom` | ^19 | DOM rendering |
| `vite` | ^8 | Build tool + dev server |
| `typescript` | ~6 | Type safety |
| `tailwindcss` | ^3.4 | Utility-first CSS |
| `@vitejs/plugin-react` | ^6 | React HMR |

---

*Built by Nova Legions · Sentinel v1.0.0*
