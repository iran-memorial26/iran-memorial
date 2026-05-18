"""JSON-based progress tracking with resume capability."""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from typing import Any


class ProgressTracker:
    """Track processing progress per source for resume capability."""

    def __init__(self, source_name: str, state_dir: str):
        self.source_name = source_name
        self.file_path = os.path.join(state_dir, "progress", f"{source_name}.json")
        self._data = self._load()

    def _load(self) -> dict[str, Any]:
        if os.path.exists(self.file_path):
            with open(self.file_path, "r", encoding="utf-8") as f:
                return json.load(f)
        return {
            "source": self.source_name,
            "last_run": None,
            "processed_ids": [],
            "stats": {},
            "checkpoint": {},
        }

    def save(self, stats: Any = None) -> None:
        """Save current progress to disk."""
        self._data["last_run"] = datetime.now(timezone.utc).isoformat()
        if stats:
            self._data["stats"] = {
                k: v for k, v in vars(stats).items() if isinstance(v, (int, float))
            }
        os.makedirs(os.path.dirname(self.file_path), exist_ok=True)
        with open(self.file_path, "w", encoding="utf-8") as f:
            json.dump(self._data, f, indent=2, ensure_ascii=False)

    def is_processed(self, source_id: str) -> bool:
        """Check if an entry has already been processed."""
        return source_id in self._processed_set

    @property
    def _processed_set(self) -> set[str]:
        if not hasattr(self, "_cached_set"):
            self._cached_set = set(self._data.get("processed_ids", []))
        return self._cached_set

    def mark_processed(self, source_id: str) -> None:
        """Mark an entry as processed."""
        if source_id not in self._processed_set:
            self._processed_set.add(source_id)
            self._data["processed_ids"].append(source_id)

    def set_checkpoint(self, key: str, value: Any) -> None:
        """Save a checkpoint value (e.g. last page number)."""
        self._data["checkpoint"][key] = value

    def get_checkpoint(self, key: str, default: Any = None) -> Any:
        """Get a checkpoint value."""
        return self._data.get("checkpoint", {}).get(key, default)

    @property
    def last_run(self) -> str | None:
        return self._data.get("last_run")

    @property
    def processed_count(self) -> int:
        return len(self._processed_set)

    def reset(self) -> None:
        """Reset progress for a fresh run."""
        self._data["processed_ids"] = []
        self._data["checkpoint"] = {}
        if hasattr(self, "_cached_set"):
            del self._cached_set
