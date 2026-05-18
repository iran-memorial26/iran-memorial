"""Source plugin registry with auto-discovery."""

from __future__ import annotations

import importlib
import pkgutil
from typing import Type

from .base import SourcePlugin

_REGISTRY: dict[str, Type[SourcePlugin]] = {}


def register(cls: Type[SourcePlugin]) -> Type[SourcePlugin]:
    """Decorator to register a source plugin."""
    # Instantiate temporarily to get the name property
    instance = cls.__new__(cls)
    _REGISTRY[instance.name] = cls
    return cls


def get_plugin(name: str) -> Type[SourcePlugin]:
    """Get a registered plugin class by name."""
    if name not in _REGISTRY:
        available = ", ".join(sorted(_REGISTRY.keys()))
        raise ValueError(f"Unknown source '{name}'. Available: {available}")
    return _REGISTRY[name]


def list_plugins() -> list[str]:
    """List all registered plugin names."""
    return sorted(_REGISTRY.keys())


# Auto-discover all modules in this package
for _info in pkgutil.iter_modules(__path__):
    if _info.name != "base":
        importlib.import_module(f".{_info.name}", __package__)
