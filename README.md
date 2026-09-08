# 🛡️ Sentinel — Autonomous AI Incident Commander

> **It doesn't just tell you what's happening. It decides who needs to know, how urgently, suggests runbook mitigations, executes safe auto-remediation, and auto-documents postmortems until resolved.**

Built by **Nova Legions** for the **LLM Forge 2026** / **Caspian AI Agent Hackathon**.

---

## 🌟 What is Sentinel?

Sentinel is a production-grade, multi-agent AI Incident Commander that eliminates alert fatigue and drastically shortens MTTA & MTTR:

- **Ingests Real-Time Telemetry**: Native webhook adapters for **Sentry**, **Datadog**, **GitHub Actions CI/CD**, and custom monitoring streams.
- **Reasons with LLM Triage**: Uses **Google Gemini Flash** to evaluate raw stack traces and assign contextual severity (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`).
- **Temporal Clustering Override**: Aggregates identical error signatures over a 20-minute sliding window — automatically enforcing a **1-level severity escalation** when $N \ge 3$ recurring failures occur.
- **RAG-Powered Runbook Suggester**: Embeds SRE runbooks and matches error traces using semantic search to inject root-cause analysis and actionable mitigation steps directly into alert threads.
- **Autonomous Auto-Remediation**: Safely executes sandboxed mitigations (`restart_service`, `drain_db_connections`, `flush_cache`, `rollback_deployment`, `scale_replicas`) with human-in-the-loop confirmation.
- **Multi-Channel SLA Escalations**: Background APScheduler timers enforce SLAs across **Slack** $\rightarrow$ **Telegram** $\rightarrow$ **Email** with in-thread continuity.
- **Natural Language Intent Parsing**: Parses free-form chat replies (`"looking into this"`, `"ack 8b3fb055"`, `"fixed"`) without rigid slash commands.
- **Autonomous GitHub Postmortems**: Automatically generates structured Markdown postmortems (Summary, Root Cause, Timeline, Resolution, TTR) and commits them directly to GitHub upon resolution.
- **Live Instrument Dashboard**: Real-time React 18 + Vite interface with low-latency WebSocket streaming (`/ws/incidents`).

---

## 🏗️ Architecture

```
                         ┌────────────────────────────────────────────────────────┐
                         │               Incoming Telemetry Webhooks              │
                         │   • Sentry (/webhook/sentry)                           │
                         │   • Datadog (/webhook/datadog)                         │
                         │   • GitHub Actions (/webhook/github)                   │
                         │   • Custom Webhook (/webhook)                          │
                         └───────────────────────────┬────────────────────────────┘
                                                     │
                                                     ▼
                                     ┌───────────────────────────────┐
                                     │   APM Adapters & Dedup        │
                                     │  (app/services/apm_adapters)  │
                                     └───────────────┬───────────────┘
                                                     │
                                                     ▼
                         ┌────────────────────────────────────────────────────────┐
                         │                   Sentinel Core Engine                 │
                         │  • Severity Agent (Gemini Flash)                       │
                         │  • Sliding-Window Signature Clustering Override        │
                         │  • RAG SRE Runbook Search Engine                       │
                         │  • In-Thread Message Metadata (Slack ts, Telegram msg) │
                         │  • Real-Time WebSocket Broadcaster (/ws/incidents)     │
                         └───────────┬───────────────────────────────┬────────────┘
                                     │                               │
                                     ▼                               ▼
                 ┌───────────────────────────────────────┐   ┌───────────────────────────┐
                 │       In-Thread Multi-Channel Alerts  │   │  React Live Dashboard     │
                 │  • Slack Block Kit (#all-team)        │   │  • WebSocket live stream  │
                 │  • Telegram Bot (@Sentinal_bot)       │   │  • Interactive Auto-Fix   │
                 │  • Resend Formal Email Reports        │   │  • Chaos Burst Generator  │
                 │  • Caspian CommClient Hub             │   │  • Cross-channel Timeline │
                 └───────────────────┬───────────────────┘   └─────────────┬─────────────┘
                                     │                                     │
                                     ▼                                     ▼
                         ┌────────────────────────────────────────────────────────┐
                         │          Autonomous Auto-Remediation & Postmortem      │
                         │  • Safe Mitigations (restart, drain_db, flush_cache)   │
                         │  • Auto-Generates Markdown Postmortem                  │
                         │  • Commits directly to GitHub Repository               │
                         └────────────────────────────────────────────────────────┘
```

---

## 🚀 Quickstart & One-Click Launch

### 1. Prerequisites
- Python 3.11+
- Node.js 18+ & npm

### 2. Install Dependencies
```powershell
pip install -r requirements.txt
cd frontend
npm install
cd ..
```

### 3. Verify Channels Diagnostic Probe
```powershell
python scripts/verify_channels.py
```

### 4. One-Click Full-Stack Launch
```powershell
python scripts/start_all.py
```
This automatically initializes the database, checks channel connections, launches the FastAPI backend on port 8000 and the React dashboard on port 5173, and opens your browser.

---

## 🎬 Live Demonstration Flow (6-Act Rehearsal)

To run the automated end-to-end rehearsal simulation script:
```powershell
python scripts/run_demo_flow.py
```

### Interactive Walkthrough:
1. **Act I — Telemetry Ingestion & Clustering Override**:
   Click **"🔥 Trigger Chaos Burst"** on `http://localhost:5173` $\rightarrow$ Sentinel ingests 3 recurring errors, applies the **Clustering Override**, and bumps severity to `HIGH/CRITICAL`.
2. **Act II — RAG Runbook Suggestion**:
   The Severity Agent matches the error against SRE runbooks and attaches mitigation steps in the alert.
3. **Act III — Multi-Channel Escalation**:
   Alert lands in Slack `#all-team`. If unacknowledged, APScheduler escalates to Telegram `@Sentinal_incident_commander_bot`.
4. **Act IV — Intent Parsing**:
   Reply `"investigating payment timeout"` in chat $\rightarrow$ status updates to `ACK` in real time on the dashboard.
5. **Act V — Auto-Remediation Execution**:
   Click **"⚡ Execute Auto-Fix"** on the dashboard card $\rightarrow$ Sentinel executes `restart_service` and logs the container restart trace.
6. **Act VI — Autonomous GitHub Postmortem**:
   Sentinel synthesizes a postmortem and commits it directly to your GitHub repository ([Mohan-121/sentinal_postmartem](https://github.com/Mohan-121/sentinal_postmartem)).

---

## 🧪 Automated Test Suite

Sentinel includes complete unit and integration test coverage:
```powershell
pytest -v
```
**17/17 tests passing**:
- APM Webhook Adapters (Sentry, Datadog, GitHub Actions)
- RAG Runbook Vector Matching
- Auto-Remediation Execution & Safety Checks
- Real-Time WebSocket Broadcasting
- Channel Formatters & In-Thread Tracking

---

## 📁 Repository Structure

```text
├── app/
│   ├── agents/
│   │   ├── severity_agent.py      # LLM severity reasoning & clustering override
│   │   ├── intent_parser.py       # Natural language chat reply parser
│   │   └── postmortem_agent.py    # Markdown postmortem generator & GitHub committer
│   ├── data/
│   │   └── runbooks.json          # SRE runbook knowledge base
│   ├── routers/
│   │   ├── webhook.py             # Ingestion endpoints (Sentry, Datadog, GitHub)
│   │   ├── reply.py               # Slack & Telegram webhook handlers
│   │   ├── incidents.py           # Dashboard query endpoints
│   │   ├── remediation.py         # Auto-remediation executor endpoints
│   │   ├── ws.py                  # Real-time WebSocket endpoint (/ws/incidents)
│   │   └── demo.py                # Chaos burst generator (/demo/chaos)
│   ├── services/
│   │   ├── apm_adapters.py        # Webhook payload translators
│   │   ├── rag_engine.py          # Semantic runbook retrieval
│   │   ├── remediator.py          # Safe mitigation action handlers
│   │   ├── broadcaster.py         # WebSocket live stream manager
│   │   ├── notifier.py            # Slack, Telegram, Resend email formatters
│   │   └── escalation.py          # APScheduler SLA background checker
│   ├── caspian_handler.py         # Caspian CommClient unified @on_message hub
│   ├── config.py                  # Pydantic Settings & environment variables
│   ├── database.py                # Async SQLite / PostgreSQL session engine
│   ├── models.py                  # SQLAlchemy ORM models
│   └── schemas.py                 # Pydantic validation models
├── frontend/
│   ├── src/
│   │   ├── App.tsx                # Instrument dashboard UI & WebSocket listener
│   │   ├── api.ts                 # Backend API client & WebSocket connector
│   │   └── types.ts               # TypeScript data interfaces
├── scripts/
│   ├── start_all.py               # Unified 1-click full-stack launcher
│   ├── run_demo_flow.py           # Automated end-to-end demo rehearsal script
│   ├── reset_db.py                # Clean-slate database reset utility
│   └── verify_channels.py         # 6-channel diagnostic probe
├── tests/
│   ├── test_core.py               # Core clustering and escalation tests
│   ├── test_adapters.py           # APM webhook adapter tests
│   ├── test_ws_and_threading.py   # WebSocket and thread tracking tests
│   └── test_rag_and_remediation.py# RAG matching and auto-remediation tests
├── .env                           # Active environment variables
├── .env.example                   # Template environment configuration
└── requirements.txt               # Python package dependencies
```