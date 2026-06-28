from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://localhost/helpdesk"
    helpdesk_api_url: str = "http://localhost:8000"
    api_secret: str = ""
    agent_service_secret: str = ""
    auth_secret: str = ""
    backend_internal_url: str = "http://localhost:8000"
    rate_limit_per_minute: int = 30

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
