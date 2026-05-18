"""Detect duplicate photos via SHA-256 (exact) + perceptual hash (resize-robust).

Two-pass workflow:
1. **hash pass** — walks rows with ``url LIKE '/photos/%'`` that don't yet have
   ``content_hash`` or ``phash``, reads the file from PHOTO_STORE, computes
   both hashes, writes them back. Cheap on repeat runs (skips already-hashed).
2. **cluster pass** — finds:
   - exact-dup clusters (same SHA-256)
   - perceptual clusters (pHash Hamming distance ≤ threshold, default 6)
   Reports cluster sizes + recoverable bytes.

Optional ``--hardlink`` collapses each exact-dup cluster on disk: keep the
earliest file, replace siblings with hardlinks. Frees disk WITHOUT touching
the DB or the served URLs — every photo row keeps its own path, the rows just
share inode-equivalent storage.

Usage:
    python3 -m tools.enricher photo-dedupe --hash-only         # populate hashes
    python3 -m tools.enricher photo-dedupe --report            # show clusters
    python3 -m tools.enricher photo-dedupe --hardlink          # storage dedup
    python3 -m tools.enricher photo-dedupe --report --hamming 4  # tighter pHash
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
import os
import pathlib
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Iterable

try:
    from PIL import Image as PILImage
    import imagehash
except ImportError as e:  # pragma: no cover
    raise SystemExit(
        f"photo-dedupe requires Pillow + imagehash. "
        f"Install: pip install Pillow imagehash. ({e})"
    )

from ..db.pool import get_pool

log = logging.getLogger("enricher.photo_dedupe")

CHUNK = 64 * 1024
PHASH_SIZE = 8  # 8x8 = 64-bit pHash; fits in BIGINT


@dataclass
class DedupeStats:
    hashed: int = 0
    hash_failed: int = 0
    sha_clusters: int = 0  # groups of 2+ exact duplicates
    sha_redundant_files: int = 0
    sha_redundant_bytes: int = 0
    phash_clusters: int = 0
    phash_pairs: int = 0
    hardlinked: int = 0
    examples: list[tuple[str, list[str]]] = field(default_factory=list)


def _sha256_file(path: pathlib.Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while True:
            chunk = f.read(CHUNK)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


def _phash_file(path: pathlib.Path) -> int | None:
    """Compute a 64-bit perceptual hash as a signed BIGINT-safe int."""
    try:
        with PILImage.open(path) as img:
            img = img.convert("L")  # grayscale before pHash for stability
            ph = imagehash.phash(img, hash_size=PHASH_SIZE)
    except Exception:
        return None
    # imagehash returns numpy-bool array; pack to 64-bit int.
    bits = 0
    for row in ph.hash:
        for b in row:
            bits = (bits << 1) | int(bool(b))
    # BIGINT is signed 64-bit. Map > 2^63 to negative two's-complement so
    # Postgres accepts it. Reverse is symmetric (bits ^ 0xFFFF...).
    if bits >= 1 << 63:
        bits -= 1 << 64
    return bits


def _local_path(store: pathlib.Path, url: str) -> pathlib.Path | None:
    """Map a /photos/... URL back to a filesystem path under PHOTO_STORE."""
    if not url.startswith("/photos/"):
        return None
    rel = url[len("/photos/"):]
    abs_ = (store / rel).resolve()
    # Defense-in-depth — refuse paths escaping the store
    if not str(abs_).startswith(str(store.resolve())):
        return None
    return abs_ if abs_.exists() and abs_.is_file() else None


async def _fetch_unhashed(pool, limit: int | None) -> list[tuple[str, str]]:
    sql = """
        SELECT id::text, url
        FROM photos
        WHERE url LIKE '/photos/%'
          AND (content_hash IS NULL OR phash IS NULL)
        ORDER BY created_at DESC
    """
    if limit:
        sql += f" LIMIT {int(limit)}"
    async with pool.acquire() as conn:
        rows = await conn.fetch(sql)
    return [(r["id"], r["url"]) for r in rows]


async def _write_hashes(
    pool, updates: list[tuple[str, str | None, int | None]]
) -> None:
    if not updates:
        return
    async with pool.acquire() as conn:
        await conn.executemany(
            """
            UPDATE photos
               SET content_hash = $2,
                   phash = $3
             WHERE id = $1::uuid
            """,
            updates,
        )


def _hash_one(store: pathlib.Path, row_id: str, url: str) -> tuple[str, str | None, int | None]:
    path = _local_path(store, url)
    if not path:
        return row_id, None, None
    try:
        sha = _sha256_file(path)
    except OSError:
        return row_id, None, None
    ph = _phash_file(path)
    return row_id, sha, ph


async def _run_hash_pass(
    pool, store: pathlib.Path, limit: int | None, batch_size: int = 200
) -> tuple[int, int]:
    targets = await _fetch_unhashed(pool, limit)
    log.info("hashing %d files", len(targets))
    if not targets:
        return 0, 0
    loop = asyncio.get_running_loop()
    batch: list[tuple[str, str | None, int | None]] = []
    hashed = failed = 0
    # I/O-bound + CPU-bound — run in default thread pool to parallelize.
    sem = asyncio.Semaphore(8)

    async def one(rid: str, url: str):
        nonlocal hashed, failed
        async with sem:
            result = await loop.run_in_executor(None, _hash_one, store, rid, url)
        if result[1] is None:
            failed += 1
        else:
            hashed += 1
        batch.append(result)
        if len(batch) >= batch_size:
            await _write_hashes(pool, list(batch))
            batch.clear()

    tasks = [asyncio.create_task(one(r, u)) for r, u in targets]
    for i, fut in enumerate(asyncio.as_completed(tasks), 1):
        await fut
        if i % 500 == 0:
            log.info("  ... %d/%d hashed", i, len(targets))
    if batch:
        await _write_hashes(pool, batch)
    return hashed, failed


async def _cluster_sha(pool) -> list[tuple[str, list[tuple[str, str, int]]]]:
    """Returns [(sha, [(photo_id, url, size_bytes)])] for sha groups with >1 row."""
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT content_hash, id::text AS id, url
            FROM photos
            WHERE content_hash IS NOT NULL
              AND content_hash IN (
                  SELECT content_hash FROM photos
                  WHERE content_hash IS NOT NULL
                  GROUP BY content_hash HAVING COUNT(*) > 1
              )
            ORDER BY content_hash, created_at ASC
            """
        )
    groups: dict[str, list[tuple[str, str]]] = defaultdict(list)
    for r in rows:
        groups[r["content_hash"]].append((r["id"], r["url"]))
    return [(sha, [(pid, url, 0) for pid, url in lst]) for sha, lst in groups.items()]


def _hamming(a: int, b: int) -> int:
    return bin((a ^ b) & 0xFFFFFFFFFFFFFFFF).count("1")


async def _cluster_phash(pool, threshold: int) -> int:
    """Union-find clustering on pHash Hamming distance. Returns pair count.

    Brute O(n²) on ~30k items = ~450M comparisons. Each cmp is ~1µs (popcount),
    so worst case ~7-10 min. For a one-time sweep that's acceptable; future
    incremental runs can scan only new rows against the existing cluster heads.
    """
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT id::text AS id, phash FROM photos WHERE phash IS NOT NULL"
        )
    items = [(r["id"], int(r["phash"]) & 0xFFFFFFFFFFFFFFFF) for r in rows]
    pairs = 0
    for i in range(len(items)):
        a_id, a_hash = items[i]
        for j in range(i + 1, len(items)):
            b_id, b_hash = items[j]
            if _hamming(a_hash, b_hash) <= threshold:
                pairs += 1
        if i % 2000 == 0 and i > 0:
            log.info("  pHash compare: %d/%d", i, len(items))
    return pairs


def _hardlink_cluster(files: list[pathlib.Path]) -> int:
    """Replace all but the first file with hardlinks to it. Returns bytes saved."""
    if len(files) < 2:
        return 0
    keeper = files[0]
    try:
        kstat = keeper.stat()
    except OSError:
        return 0
    saved = 0
    for f in files[1:]:
        try:
            fstat = f.stat()
        except OSError:
            continue
        # Already hardlinked to the same inode → skip
        if (fstat.st_dev, fstat.st_ino) == (kstat.st_dev, kstat.st_ino):
            continue
        # Atomic: link to a sibling tmp name, then rename over.
        tmp = f.with_suffix(f.suffix + ".tmp-link")
        try:
            os.link(keeper, tmp)
            os.replace(tmp, f)
            saved += fstat.st_size
        except OSError as e:
            log.warning("hardlink failed for %s: %s", f, e)
            tmp.unlink(missing_ok=True)
    return saved


async def run_photo_dedupe(
    database_url: str,
    *,
    photo_store: str | None = None,
    hash_only: bool = False,
    report: bool = True,
    hardlink: bool = False,
    hamming_threshold: int = 6,
    limit: int | None = None,
) -> DedupeStats:
    store = pathlib.Path(photo_store or os.environ.get("PHOTO_STORE", "/var/photos"))
    pool = await get_pool(database_url)
    stats = DedupeStats()

    # Pass 1 — populate missing hashes.
    hashed, failed = await _run_hash_pass(pool, store, limit)
    stats.hashed = hashed
    stats.hash_failed = failed
    log.info("hash pass: %d hashed, %d failed", hashed, failed)

    if hash_only:
        return stats

    # Pass 2 — exact-duplicate clusters.
    sha_clusters = await _cluster_sha(pool)
    stats.sha_clusters = len(sha_clusters)
    redundant_files = 0
    redundant_bytes = 0
    examples: list[tuple[str, list[str]]] = []

    for sha, group in sha_clusters:
        # group is [(id, url, _)]
        files = [_local_path(store, url) for _, url, _ in group]
        files = [f for f in files if f]
        if not files:
            continue
        try:
            size_each = files[0].stat().st_size
        except OSError:
            continue
        redundant_files += len(files) - 1
        redundant_bytes += (len(files) - 1) * size_each
        if hardlink:
            saved = _hardlink_cluster(files)
            stats.hardlinked += saved
        if len(examples) < 5:
            examples.append((sha[:12], [f.name for f in files[:3]]))

    stats.sha_redundant_files = redundant_files
    stats.sha_redundant_bytes = redundant_bytes
    stats.examples = examples

    # Pass 3 — perceptual cluster count (no action, just report).
    if report:
        pairs = await _cluster_phash(pool, hamming_threshold)
        stats.phash_pairs = pairs

    return stats
