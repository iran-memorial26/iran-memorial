"""Abstract base class for source plugins."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import AsyncIterator, Optional

import aiohttp

from ..db.models import ExternalVictim
from ..utils.progress import ProgressTracker


class SourcePlugin(ABC):
    """Base class all source plugins must implement."""

    session: aiohttp.ClientSession
    progress: ProgressTracker
    cache_dir: str

    @property
    @abstractmethod
    def name(self) -> str:
        """Short unique name: 'boroumand', 'iranvictims'."""
        ...

    @property
    @abstractmethod
    def full_name(self) -> str:
        """Human-readable name."""
        ...

    @property
    @abstractmethod
    def base_url(self) -> str:
        """Base URL for this source."""
        ...

    @abstractmethod
    async def fetch_all(self) -> AsyncIterator[ExternalVictim]:
        """Yield all victims from this source."""
        ...
        yield  # type: ignore  # make it a generator

    async def fetch_detail(self, source_id: str) -> Optional[ExternalVictim]:
        """Fetch a single victim (optional, for targeted enrichment)."""
        return None

    async def setup(
        self,
        config: dict,
        http_session: aiohttp.ClientSession,
        progress: ProgressTracker,
        cache_dir: str = "",
    ) -> None:
        """Called once before fetch_all(). Inject dependencies."""
        self.config = config
        self.session = http_session
        self.progress = progress
        self.cache_dir = cache_dir

    async def teardown(self) -> None:
        """Cleanup after processing."""
        pass
