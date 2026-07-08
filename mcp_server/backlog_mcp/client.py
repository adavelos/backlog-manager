import httpx

from backlog_mcp.config import BASE_URL, TIMEOUT


class BacklogApiError(Exception):
    def __init__(self, status_code: int, message: str, code: str | None = None):
        self.status_code = status_code
        self.message = message
        self.code = code
        super().__init__(f"[{status_code}] {message}" + (f" ({code})" if code else ""))


class BacklogClient:
    def __init__(self, base_url: str = BASE_URL, timeout: float = TIMEOUT):
        self._client = httpx.Client(base_url=base_url, timeout=timeout)

    def _raise_for_status(self, response: httpx.Response) -> None:
        if response.is_success:
            return
        try:
            body = response.json()
            message = body.get("message", response.text)
            code = body.get("code")
        except ValueError:
            message = response.text
            code = None
        raise BacklogApiError(response.status_code, message, code)

    def list_projects(self) -> list[dict]:
        resp = self._client.get("/projects")
        self._raise_for_status(resp)
        return resp.json()

    def list_items(
        self,
        project_id: str | None = None,
        state: str | None = None,
        release_id: str | None = None,
        ticket_id: str | None = None,
    ) -> list[dict]:
        params = {}
        if project_id is not None:
            params["projectId"] = project_id
        if state is not None:
            params["state"] = state
        if release_id is not None:
            params["releaseId"] = release_id
        if ticket_id is not None:
            params["ticketId"] = ticket_id
        resp = self._client.get("/items", params=params)
        self._raise_for_status(resp)
        return resp.json()

    def get_candidate_items(self, project_id: str, limit: int = 10) -> list[dict]:
        resp = self._client.get(
            "/items/candidates", params={"projectId": project_id, "limit": limit}
        )
        self._raise_for_status(resp)
        return resp.json()

    def get_item(self, item_id: str) -> dict:
        resp = self._client.get(f"/items/{item_id}")
        self._raise_for_status(resp)
        return resp.json()

    def create_item(self, payload: dict) -> dict:
        resp = self._client.post("/items", json=payload)
        self._raise_for_status(resp)
        return resp.json()

    def update_item(self, item_id: str, payload: dict) -> dict:
        resp = self._client.patch(f"/items/{item_id}", json=payload)
        self._raise_for_status(resp)
        return resp.json()

    def delete_item(self, item_id: str) -> None:
        resp = self._client.delete(f"/items/{item_id}")
        self._raise_for_status(resp)


backlog_client = BacklogClient()
