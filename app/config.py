from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/sentinel"

    # LLM — supports any OpenAI-compatible API (OpenAI, Gemini, Groq, etc.)
    openai_api_key: Optional[str] = None
    openai_model: str = "gemini-2.0-flash"
    # Set this to use Gemini free tier:
    # https://generativelanguage.googleapis.com/v1beta/openai/
    openai_base_url: Optional[str] = None

    # Caspian
    caspian_api_key: Optional[str] = None
    caspian_base_url: str = "https://api.trycaspianai.com"
    caspian_agent_username: str = "sentinel-agent"

    # Slack
    slack_bot_token: Optional[str] = None
    slack_signing_secret: Optional[str] = None
    slack_incident_channel: str = "#incidents"

    # Telegram
    telegram_bot_token: Optional[str] = None
    telegram_chat_id: Optional[str] = None

    # Email (Resend)
    resend_api_key: Optional[str] = None
    email_from: str = "sentinel@example.com"
    email_to_oncall: str = "oncall@example.com"

    # GitHub
    github_token: Optional[str] = None
    github_postmortem_repo: str = "your-org/your-repo"
    github_postmortem_branch: str = "main"

    # Sentinel App
    sentinel_api_key: str = "sentinel-secret-key-change-me"
    app_base_url: str = "http://localhost:8000"
    escalation_interval_seconds: int = 60

    @property
    def available_channels(self) -> list[str]:
        channels = []
        if self.slack_bot_token:
            channels.append("slack")
        if self.telegram_bot_token and self.telegram_chat_id:
            channels.append("telegram")
        if self.resend_api_key:
            channels.append("email")
        return channels


settings = Settings()
