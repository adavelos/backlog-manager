# backlog-mcp

An MCP server exposing the Backlog Manager REST API as tools for AI agents (Claude Code, Claude Desktop, OpenCode, or any other MCP client).

It is a pure HTTP client to the Backlog Manager backend — it never touches the SQLite database directly, and never runs git itself. It requires the Backlog Manager backend to already be running (`./start.sh` or `./serve.sh` from the repo root).

## Setup

```bash
cd mcp_server
uv sync
```

By default the server talks to `http://localhost:8001/api` (matching the dev backend default port). Override with:

```bash
export BACKLOG_API_BASE_URL=http://localhost:8001/api   # match your backend's port
export BACKLOG_API_TIMEOUT=10                            # seconds
```

## Registering with Claude Code

```bash
claude mcp add backlog-manager -- uv run --project /path/to/backlog-manager/mcp_server backlog-mcp
```

Or add directly to `.mcp.json` / `~/.claude.json`:

```json
{
  "mcpServers": {
    "backlog-manager": {
      "command": "uv",
      "args": ["run", "--project", "/path/to/backlog-manager/mcp_server", "backlog-mcp"]
    }
  }
}
```

## Workflow

1. Invoke the `start_session` prompt (or follow it manually): compute the current repo's `org/repo` slug from `git remote get-url origin` (your own Bash tool — this server does not run git), call `list_projects()`, match the slug against each project's `repoPath`, and call `select_project(project_id)`. If there's no match, ask the user which project to use.
2. `select_project` auto-resolves the project's default release (`isDefault` flag on `Release`, independent of its `state` — a project can have several `ACTIVE` releases, but at most one default).
3. Call `get_candidate_items(limit=10)` for a ranked "what to work on next" list (release tier → priority → state → recency), or `list_items()` to browse. Use `select_release(release_id)` to work against a specific non-default release instead.
4. `get_item(item_id=...)` or `get_item(ticket_id="ABC-0042")` to pull an item's full detail (analysis/prompt/report) before implementing.
5. After implementing: commit using the item's `ticketId` yourself (`git commit -m "ABC-0042: ..."`) — this server intentionally has no commit tool.
6. `update_item(item_id, report=..., files_affected=[...], state="DONE")` to write back your findings. Use glob patterns in `files_affected` (e.g. `"frontend/src/components/boards/**/*.vue"`) instead of enumerating every file when there are many.

## Session scope

`select_project`/`select_release` set in-memory state for the lifetime of this server process. This assumes one long-lived stdio subprocess per client session (the normal case for Claude Code/Desktop MCP servers) — not a fresh process per tool call.

## Tools

| Tool | Purpose |
|---|---|
| `list_projects()` | List all projects with nested releases |
| `select_project(project_id)` | Pin session scope, auto-select default release |
| `select_release(release_id \| null)` | Override/clear release scope |
| `list_items(state?, all_releases?)` | Raw filtered browse |
| `get_candidate_items(limit?)` | Ranked "what to work on next" |
| `get_item(item_id? \| ticket_id?)` | Full item detail |
| `create_item(...)` | Create an item |
| `update_item(item_id, ...)` | Partial update (only passed fields change) |
| `delete_item(item_id)` | Delete an item |
