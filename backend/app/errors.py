class NotFoundError(Exception):
    """Raised by a repository when a row looked up by id doesn't exist."""


class ConflictError(Exception):
    """Raised by a repository when a write violates a DB constraint (FK, check, unique)."""
    def __init__(self, message: str, code: str | None = None):
        super().__init__(message)
        self.code = code
