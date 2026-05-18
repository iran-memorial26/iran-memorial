"""Configuration loading — TOML + environment variables."""

from __future__ import annotations

import os
import tomllib
from dataclasses import dataclass, field
from pathlib import Path

DEFAULT_STATE_DIR = str(Path(__file__).parent / "state")
DEFAULT_CONFIG_FILE = str(Path(__file__).parent / "enricher.toml")


@dataclass
class Config:
    """Enricher configuration."""

    database_url: str = ""
    state_dir: str = DEFAULT_STATE_DIR
    batch_size: int = 100
    log_level: str = "INFO"
    # Per-source overrides
    source_config: dict[str, dict] = field(default_factory=dict)


def load_config(config_file: str | None = None) -> Config:
    """Load config from TOML file + environment variables.

    Priority: ENV > TOML > defaults.
    """
    cfg = Config()

    # 1. Load TOML if present
    toml_path = config_file or DEFAULT_CONFIG_FILE
    if os.path.exists(toml_path):
        with open(toml_path, "rb") as f:
            data = tomllib.load(f)

        cfg.database_url = data.get("database_url", cfg.database_url)
        cfg.state_dir = data.get("state_dir", cfg.state_dir)
        cfg.batch_size = data.get("batch_size", cfg.batch_size)
        cfg.log_level = data.get("log_level", cfg.log_level)

        # Source-specific config sections
        for key, val in data.items():
            if isinstance(val, dict):
                cfg.source_config[key] = val

    # 2. Environment overrides (highest priority)
    if os.environ.get("DATABASE_URL"):
        cfg.database_url = os.environ["DATABASE_URL"]
    if os.environ.get("ENRICHER_STATE_DIR"):
        cfg.state_dir = os.environ["ENRICHER_STATE_DIR"]
    if os.environ.get("ENRICHER_BATCH_SIZE"):
        cfg.batch_size = int(os.environ["ENRICHER_BATCH_SIZE"])
    if os.environ.get("ENRICHER_LOG_LEVEL"):
        cfg.log_level = os.environ["ENRICHER_LOG_LEVEL"]

    # 3. Fallback: local PostgreSQL
    if not cfg.database_url:
        cfg.database_url = "postgresql://Pedi@localhost:5432/iran_memorial"

    return cfg
