"""OAuth check for an owner application's MCP endpoint.

Shared by the owner applications. Edit this file only in standards/mcp-oauth/, then copy it with
sync.sh. The applications keep their own copies, which are generated; never edit those.

Access tokens come from Authelia, the owner's authorization server (security/). A token is valid when
its RS256 signature matches Authelia's published keys, its issuer is Authelia, its audience is this
application's MCP address (RFC 8707), and it has not expired. The client id in the token is
returned for logging. Per-client bearer tokens stay in each application, next to this check.
Revoking a client stops its refresh tokens at once; its access tokens stop at their expiry, 15 minutes.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from urllib.parse import urlsplit

import jwt

log = logging.getLogger(__name__)

WELL_KNOWN = "/.well-known/oauth-protected-resource"


@dataclass(frozen=True)
class OAuthSettings:
    issuer: str  # Authelia's issuer as it appears in tokens, e.g. https://seansoul.gr/authelia
    resource: str  # this application's MCP address, e.g. https://seansoul.gr/organiser/mcp
    jwks_url: str  # where Authelia publishes the signing keys, reachable from the application

    def metadata_url(self) -> str:
        """The RFC 9728 address of the protected resource metadata: the well-known name, then the path."""
        parts = urlsplit(self.resource)
        return f"{parts.scheme}://{parts.netloc}{WELL_KNOWN}{parts.path}"


class OAuthAuthenticator:
    def __init__(self, settings: OAuthSettings, key_source=None):
        self.settings = settings
        self._keys = key_source or jwt.PyJWKClient(settings.jwks_url, cache_keys=True, lifespan=300)

    def client_for(self, authorization: str) -> str | None:
        """Return the client id of a valid access token from an Authorization header, or None."""
        if not authorization.lower().startswith("bearer "):
            return None
        token = authorization[7:].strip()
        try:
            key = self._keys.get_signing_key_from_jwt(token).key
            claims = jwt.decode(
                token,
                key,
                algorithms=["RS256"],
                audience=self.settings.resource,
                issuer=self.settings.issuer,
                options={"require": ["exp", "iss", "aud", "iat"]},
            )
        except (jwt.PyJWTError, OSError) as exc:
            # OSError: the keys could not be fetched. The token is refused either way.
            log.info("oauth token refused: %s", type(exc).__name__)
            return None
        return str(claims.get("client_id", "unknown"))

    def challenge(self) -> tuple[bytes, bytes]:
        """The WWW-Authenticate header to send with a 401, as (name, value) bytes for ASGI."""
        return b"www-authenticate", f'Bearer resource_metadata="{self.settings.metadata_url()}"'.encode()

    def metadata(self) -> dict:
        """The protected resource metadata document (RFC 9728), served at metadata_url()."""
        return {
            "resource": self.settings.resource,
            "authorization_servers": [self.settings.issuer],
            "bearer_methods_supported": ["header"],
        }
