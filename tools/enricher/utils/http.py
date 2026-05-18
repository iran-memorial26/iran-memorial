"""Async HTTP client with retry, rate limiting, and caching."""

from __future__ import annotations

import asyncio
import hashlib
import json
import os
import random
import ssl
from typing import Optional

import aiohttp

USER_AGENT = (
    "iran-memorial/2.0 "
    "(https://github.com/iran-memorial26/iran-memorial; iran-memorial26@proton.me)"
)


def create_session(
    max_connections: int = 10,
    per_host: int = 4,
    timeout_sec: int = 30,
) -> aiohttp.ClientSession:
    """Create an aiohttp session with sensible defaults."""
    ssl_ctx = ssl.create_default_context()
    ssl_ctx.check_hostname = False
    ssl_ctx.verify_mode = ssl.CERT_NONE

    connector = aiohttp.TCPConnector(
        limit=max_connections,
        limit_per_host=per_host,
        ttl_dns_cache=300,
        enable_cleanup_closed=True,
        ssl=ssl_ctx,
    )
    timeout = aiohttp.ClientTimeout(total=timeout_sec, connect=10)
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/json",
        "Accept-Language": "en-US,en;q=0.9,fa;q=0.8",
    }
    return aiohttp.ClientSession(
        connector=connector, timeout=timeout, headers=headers
    )


async def fetch_with_retry(
    session: aiohttp.ClientSession,
    url: str,
    retries: int = 3,
    backoff_base: float = 5.0,
    rate_limit: tuple[float, float] = (0.8, 1.2),
    cache_dir: Optional[str] = None,
    extra_headers: Optional[dict[str, str]] = None,
) -> Optional[str]:
    """Fetch a URL with retry, rate limiting, and optional disk cache."""
    # Check cache first
    if cache_dir:
        cached = _read_cache(cache_dir, url)
        if cached is not None:
            return cached

    for attempt in range(retries):
        try:
            async with session.get(url, headers=extra_headers) as resp:
                if resp.status == 200:
                    text = await resp.text()
                    await asyncio.sleep(random.uniform(*rate_limit))
                    if cache_dir:
                        _write_cache(cache_dir, url, text)
                    return text
                elif resp.status == 429:
                    wait = backoff_base * (2**attempt)
                    await asyncio.sleep(wait)
                elif resp.status >= 500:
                    await asyncio.sleep(backoff_base * (attempt + 1))
                else:
                    return None  # 404 etc — don't retry
        except (aiohttp.ClientError, asyncio.TimeoutError, OSError):
            if attempt < retries - 1:
                await asyncio.sleep(backoff_base * (attempt + 1))

    return None


def _cache_key(url: str) -> str:
    return hashlib.sha256(url.encode()).hexdigest()[:16]


def _read_cache(cache_dir: str, url: str) -> Optional[str]:
    path = os.path.join(cache_dir, _cache_key(url) + ".json")
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f).get("body")
    return None


def _write_cache(cache_dir: str, url: str, body: str) -> None:
    os.makedirs(cache_dir, exist_ok=True)
    path = os.path.join(cache_dir, _cache_key(url) + ".json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump({"url": url, "body": body}, f, ensure_ascii=False)
