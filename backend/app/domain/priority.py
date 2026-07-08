"""Canonical priority ordering, single source of truth for validation and ranking."""

# Index = rank, 0 = most important. Used both to constrain Item.priority
# and to rank items in item_repo.get_candidates().
PRIORITY_ORDER = ["BLOCKER", "CRITICAL", "HIGH", "MEDIUM", "LOW"]


def priority_rank(priority: str | None) -> int:
    """Lower is more important. Unset/unrecognized priority ranks last."""
    if priority is None:
        return len(PRIORITY_ORDER)
    try:
        return PRIORITY_ORDER.index(priority)
    except ValueError:
        return len(PRIORITY_ORDER)
