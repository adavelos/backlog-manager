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
    # MCP access, served at /mcp. One token per client: "claude-code:<token>,..." (secrets file only).
    # The endpoint refuses every request when no token is set and OAuth is off.
    mcp_tokens: str = ""
    mcp_allowed_hosts: str = "127.0.0.1:*,localhost:*"
    mcp_allowed_origins: str = "http://127.0.0.1:*,http://localhost:*"
    # OAuth through Authelia, the owner's authorization server. Off when the issuer is empty.
    oauth_issuer: str = ""
    oauth_resource: str = ""
    oauth_jwks_url: str = ""

    @property
    def db_path(self) -> Path:
        return self.data_dir / self.db_filename

    @property
    def database_url(self) -> str:
        return f"sqlite:///{self.db_path}"

    def token_map(self) -> dict[str, str]:
        """Token -> client name."""
        out = {}
        for part in self.mcp_tokens.split(","):
            name, sep, token = part.strip().partition(":")
            if sep and name and token:
                out[token.strip()] = name.strip()
        return out


settings = Settings()
