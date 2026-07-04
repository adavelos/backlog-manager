from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="BACKLOG_")

    data_dir: Path = Path.home() / ".backlog" / "data"
    db_filename: str = "backlog.sqlite3"
    port: int = 8000
    # Directory containing the built frontend (frontend/dist). None in dev mode,
    # where the Vite dev server serves the SPA and proxies /api here instead.
    static_dir: Path | None = None

    @property
    def db_path(self) -> Path:
        return self.data_dir / self.db_filename

    @property
    def database_url(self) -> str:
        return f"sqlite:///{self.db_path}"


settings = Settings()
