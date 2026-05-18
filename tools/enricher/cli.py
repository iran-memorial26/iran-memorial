"""CLI interface — argparse subcommands for the enrichment service."""

from __future__ import annotations

import argparse
import asyncio
import logging
import sys

from . import __version__
from .config import load_config
from .db.models import DedupStats, RunStats
from .sources import list_plugins


def setup_logging(level: str) -> None:
    """Configure logging."""
    logging.basicConfig(
        level=getattr(logging, level.upper(), logging.INFO),
        format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
        datefmt="%H:%M:%S",
    )


def format_stats(stats: RunStats) -> str:
    """Format run statistics for display."""
    lines = [
        f"  Processed:     {stats.processed:>6}",
        f"  Matched:       {stats.matched:>6}",
        f"  Enriched:      {stats.enriched:>6}  ({stats.fields_updated} fields)",
        f"  Sources added: {stats.sources_added:>6}",
        f"  Photos added:  {stats.photos_added:>6}",
        f"  No new data:   {stats.no_new_data:>6}",
        f"  Ambiguous:     {stats.ambiguous:>6}",
        f"  Unmatched:     {stats.unmatched:>6}",
    ]
    if stats.new_imported:
        lines.append(f"  New imported:  {stats.new_imported:>6}")
    if stats.errors:
        lines.append(f"  Errors:        {stats.errors:>6}")
    return "\n".join(lines)


async def cmd_enrich(args: argparse.Namespace) -> int:
    """Run enrichment pipeline."""
    from .pipeline.orchestrator import run_all_sources, run_enrichment

    cfg = load_config(args.config)
    setup_logging(cfg.log_level if not args.verbose else "DEBUG")
    log = logging.getLogger("enricher")

    if args.all:
        results = await run_all_sources(
            database_url=cfg.database_url,
            state_dir=cfg.state_dir,
            mode=args.mode,
            dry_run=args.dry_run,
            limit=args.limit,
            batch_size=cfg.batch_size,
            resume=args.resume,
            verbose=args.verbose,
        )
        for name, stats in results.items():
            log.info(f"\n--- {name} ---\n{format_stats(stats)}")
        return 0

    if not args.source:
        print("Error: --source NAME or --all required", file=sys.stderr)
        return 1

    stats = await run_enrichment(
        source_name=args.source,
        database_url=cfg.database_url,
        state_dir=cfg.state_dir,
        mode=args.mode,
        dry_run=args.dry_run,
        limit=args.limit,
        batch_size=cfg.batch_size,
        resume=args.resume,
        verbose=args.verbose,
    )

    prefix = "[DRY RUN] " if args.dry_run else ""
    log.info(f"\n{prefix}Results:\n{format_stats(stats)}")
    return 0


async def cmd_check(args: argparse.Namespace) -> int:
    """Dry-run preview — alias for 'enrich --dry-run'."""
    args.dry_run = True
    args.mode = "enrich"
    return await cmd_enrich(args)


async def cmd_photo_dedupe(args: argparse.Namespace) -> int:
    """Detect duplicate photos via SHA-256 + perceptual hash."""
    from .pipeline.photo_dedupe import run_photo_dedupe

    cfg = load_config(args.config)
    setup_logging(cfg.log_level if not args.verbose else "DEBUG")

    stats = await run_photo_dedupe(
        database_url=cfg.database_url,
        photo_store=args.photo_store,
        hash_only=args.hash_only,
        report=not args.hash_only,
        hardlink=args.hardlink,
        hamming_threshold=args.hamming,
        limit=args.limit,
    )

    print(f"\nPhoto Dedupe")
    print(f"  Hash pass:")
    print(f"    Hashed:        {stats.hashed:>6}")
    print(f"    Failed:        {stats.hash_failed:>6}")
    if not args.hash_only:
        print(f"  Exact duplicates (SHA-256):")
        print(f"    Clusters:      {stats.sha_clusters:>6}")
        print(f"    Redundant:     {stats.sha_redundant_files:>6} files")
        mb = stats.sha_redundant_bytes / (1024 * 1024)
        print(f"    Recoverable:   {mb:>9.1f} MB")
        if args.hardlink:
            hl_mb = stats.hardlinked / (1024 * 1024)
            print(f"    Freed by hardlink: {hl_mb:>5.1f} MB")
        print(f"  Perceptual (pHash, Hamming <= {args.hamming}):")
        print(f"    Pairs:         {stats.phash_pairs:>6}")
        if stats.examples:
            print(f"  Examples:")
            for sha, files in stats.examples:
                print(f"    {sha}...  {files}")
    return 0


async def cmd_photo_mirror(args: argparse.Namespace) -> int:
    """Download photos to local disk + rewrite URLs."""
    from .pipeline.photo_mirror import run_photo_mirror

    cfg = load_config(args.config)
    setup_logging(cfg.log_level if not args.verbose else "DEBUG")

    if getattr(args, "apply", False):
        args.dry_run = False

    stats = await run_photo_mirror(
        database_url=cfg.database_url,
        dry_run=args.dry_run,
        limit=args.limit,
        concurrency=args.concurrency,
        photo_store=args.photo_store,
        photos_only=args.photos_only,
        legacy_only=args.legacy_only,
    )

    print(f"\nPhoto Mirror {'(DRY RUN)' if args.dry_run else '(APPLIED)'}")
    print(f"  photos table:")
    print(f"    Checked:    {stats.photos_checked:>6}")
    print(f"    Mirrored:   {stats.photos_mirrored:>6}")
    print(f"    Blocked:    {stats.photos_blocked:>6}")
    print(f"    Failed:     {stats.photos_failed:>6}")
    print(f"  victims.photo_url:")
    print(f"    Checked:    {stats.legacy_checked:>6}")
    print(f"    Mirrored:   {stats.legacy_mirrored:>6}")
    print(f"    Blocked:    {stats.legacy_blocked:>6}")
    print(f"    Failed:     {stats.legacy_failed:>6}")
    mb = stats.bytes_written / (1024 * 1024)
    print(f"  Bytes written: {mb:>9.1f} MB")
    return 0


async def cmd_photo_audit(args: argparse.Namespace) -> int:
    """Find photo content_hash collisions across victims."""
    from .pipeline.photo_audit import run_photo_audit

    cfg = load_config(args.config)
    setup_logging(cfg.log_level if not args.verbose else "DEBUG")
    await run_photo_audit(cfg.database_url, as_json=args.json)
    return 0


async def cmd_photo_block(args: argparse.Namespace) -> int:
    """Add a sha256 to the blocklist + retroactively scrub references."""
    from .pipeline.photo_audit import add_to_blocklist

    cfg = load_config(args.config)
    setup_logging(cfg.log_level if not args.verbose else "DEBUG")
    summary = await add_to_blocklist(
        cfg.database_url,
        sha256=args.sha256,
        reason=args.reason,
        added_by=args.added_by,
        delete_files=not args.keep_files,
        dry_run=args.dry_run,
    )
    prefix = "(DRY RUN) " if args.dry_run else ""
    print(f"\n{prefix}Blocklist: {summary['sha256']}")
    print(f"  Reason:       {summary['reason']}")
    print(f"  Photo rows:   {summary['photo_rows_found']}")
    print(f"  Files:        {summary['files_found']}")
    return 0


async def cmd_photo_unblock(args: argparse.Namespace) -> int:
    """Remove a sha256 from the blocklist (keeps existing scrubbed data)."""
    from .pipeline.photo_audit import remove_from_blocklist

    cfg = load_config(args.config)
    setup_logging(cfg.log_level if not args.verbose else "DEBUG")
    ok = await remove_from_blocklist(cfg.database_url, sha256=args.sha256)
    print(f"Unblock {args.sha256}: {'ok' if ok else 'not found'}")
    return 0 if ok else 1


async def cmd_photo_blocklist(args: argparse.Namespace) -> int:
    """List all hashes on the blocklist."""
    from .pipeline.photo_audit import list_blocklist

    cfg = load_config(args.config)
    setup_logging(cfg.log_level if not args.verbose else "DEBUG")
    await list_blocklist(cfg.database_url, as_json=args.json)
    return 0


async def cmd_translate(args: argparse.Namespace) -> int:
    """Translate _en bio fields into _de / _fa via Anthropic Batches API."""
    from .pipeline.translate import (
        TRANSLATABLE_FIELDS,
        SUPPORTED_TARGETS,
        run_translate,
    )

    cfg = load_config(args.config)
    setup_logging(cfg.log_level if not args.verbose else "DEBUG")

    if getattr(args, "apply", False):
        args.dry_run = False

    targets = [t.strip() for t in args.target.split(",") if t.strip()]
    fields = (
        [f.strip() for f in args.field.split(",") if f.strip()]
        if args.field else list(TRANSLATABLE_FIELDS)
    )

    stats = await run_translate(
        database_url=cfg.database_url,
        targets=targets,
        fields=fields,
        limit=args.limit,
        dry_run=args.dry_run,
        poll=not args.no_poll,
        poll_interval=args.poll_interval,
    )

    print(f"\nTranslate {'(DRY RUN)' if args.dry_run else '(SUBMITTED)'}")
    print(f"  Queried:    {stats.queried:>6}")
    print(f"  Submitted:  {stats.submitted:>6}")
    if stats.by_field:
        print(f"  Per field:")
        for k, n in sorted(stats.by_field.items()):
            print(f"    {k:<35} {n:>6}")
    if stats.batch_id:
        print(f"  Batch IDs:  {stats.batch_id}")
    if not args.no_poll and not args.dry_run:
        print(f"  Succeeded:  {stats.succeeded:>6}")
        print(f"  Errored:    {stats.errored:>6}")
        print(f"  Applied:    {stats.applied:>6}")
    return 0


async def cmd_translate_poll(args: argparse.Namespace) -> int:
    """Resume a previously-submitted translate batch."""
    from .pipeline.translate import run_translate_poll

    cfg = load_config(args.config)
    setup_logging(cfg.log_level if not args.verbose else "DEBUG")
    stats = await run_translate_poll(
        cfg.database_url, batch_id=args.batch_id, dry_run=args.dry_run
    )
    print(f"\nTranslate Poll batch={stats.batch_id}")
    print(f"  Succeeded:  {stats.succeeded:>6}")
    print(f"  Errored:    {stats.errored:>6}")
    print(f"  Applied:    {stats.applied:>6}")
    return 0


async def cmd_grokipedia(args: argparse.Namespace) -> int:
    """Probe Grokipedia per victim, attach source + fill NULL circumstances."""
    from .pipeline.grokipedia import run_grokipedia

    cfg = load_config(args.config)
    setup_logging(cfg.log_level if not args.verbose else "DEBUG")

    if getattr(args, "apply", False):
        args.dry_run = False

    stats = await run_grokipedia(
        database_url=cfg.database_url,
        dry_run=args.dry_run,
        limit=args.limit,
        recheck=args.recheck,
        verbose=args.verbose,
        concurrency=args.concurrency,
    )

    print(f"\nGrokipedia {'(DRY RUN)' if args.dry_run else '(APPLIED)'}")
    print(f"  Processed:               {stats.processed:>6}")
    print(f"  Probed (article found):  {stats.probed:>6}")
    print(f"  Matched (validated):     {stats.matched:>6}")
    print(f"  Rejected:                {stats.rejected:>6}")
    for reason, n in sorted(stats.rejection_reasons.items()):
        print(f"    {reason:<20} {n:>6}")
    print(f"  Sources added:           {stats.sources_added:>6}")
    print(f"  Circumstances filled:    {stats.circumstances_filled:>6}")
    print(f"  Skipped (existing src):  {stats.skipped_existing:>6}")
    print(f"  Errors:                  {stats.errors:>6}")
    return 0


async def cmd_photo_health(args: argparse.Namespace) -> int:
    """HEAD-check photo URLs, mark broken ones."""
    from .pipeline.photo_health import run_photo_health

    cfg = load_config(args.config)
    setup_logging(cfg.log_level if not args.verbose else "DEBUG")

    if getattr(args, "apply", False):
        args.dry_run = False

    stats = await run_photo_health(
        database_url=cfg.database_url,
        dry_run=args.dry_run,
        domain=args.domain,
        recheck_broken=args.recheck_broken,
        limit=args.limit,
        concurrency=args.concurrency,
    )

    print(f"\nPhoto Health {'(DRY RUN)' if args.dry_run else '(APPLIED)'}")
    print(f"  Checked:       {stats.checked:>6}")
    print(f"  OK:            {stats.ok:>6}")
    print(f"  Newly broken:  {stats.newly_broken:>6}")
    print(f"  Still broken:  {stats.still_broken:>6}")
    print(f"  Recovered:     {stats.recovered:>6}")
    print(f"  Network errs:  {stats.errors:>6}")
    if stats.by_status:
        print("  Status codes:")
        for code in sorted(stats.by_status):
            print(f"    {code}: {stats.by_status[code]}")
    print(f"  Legacy victims.photo_url:")
    print(f"    Checked: {stats.legacy_checked:>6}")
    print(f"    Nulled:  {stats.legacy_nulled:>6}")
    return 0


async def cmd_status(args: argparse.Namespace) -> int:
    """Show progress status for all sources."""
    import json
    import os

    cfg = load_config(args.config)
    progress_dir = os.path.join(cfg.state_dir, "progress")

    if not os.path.exists(progress_dir):
        print("No progress data yet.")
        return 0

    for filename in sorted(os.listdir(progress_dir)):
        if not filename.endswith(".json"):
            continue
        filepath = os.path.join(progress_dir, filename)
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)

        source = data.get("source", filename)
        last_run = data.get("last_run", "never")
        processed = len(data.get("processed_ids", []))
        stats = data.get("stats", {})

        print(f"\n{source}:")
        print(f"  Last run:   {last_run}")
        print(f"  Processed:  {processed}")
        if stats:
            for k, v in stats.items():
                print(f"  {k}: {v}")

    return 0


def format_dedup_stats(stats: DedupStats) -> str:
    """Format dedup statistics for display."""
    return "\n".join([
        f"  Groups found:      {stats.groups_found:>6}",
        f"  Auto-merge (>=50): {stats.auto_merge:>6}",
        f"  Review (30-49):    {stats.review:>6}",
        f"  Skipped (<30):     {stats.skipped:>6}",
        f"",
        f"  Victims merged:    {stats.victims_merged:>6}",
        f"  Sources migrated:  {stats.sources_migrated:>6}",
        f"  Photos migrated:   {stats.photos_migrated:>6}",
        f"  Victims deleted:   {stats.victims_deleted:>6}",
    ])


async def cmd_dedup(args: argparse.Namespace) -> int:
    """Find and merge duplicate victim records."""
    from .pipeline.dedup import run_dedup

    cfg = load_config(args.config)
    setup_logging(cfg.log_level if not args.verbose else "DEBUG")
    log = logging.getLogger("enricher")

    dry_run = args.dry_run
    stats = await run_dedup(
        database_url=cfg.database_url,
        dry_run=dry_run,
        include_review=args.include_review,
        limit=args.limit,
        verbose=args.verbose,
    )

    prefix = "[DRY RUN] " if dry_run else ""
    log.info(f"\n{prefix}Dedup Results:\n{format_dedup_stats(stats)}")
    return 0


async def cmd_list(args: argparse.Namespace) -> int:
    """List available source plugins."""
    plugins = list_plugins()
    if not plugins:
        print("No plugins registered.")
        return 0

    from .sources import get_plugin

    print(f"\nAvailable sources ({len(plugins)}):\n")
    for name in plugins:
        cls = get_plugin(name)
        instance = cls.__new__(cls)
        print(f"  {name:<20s}  {instance.full_name}")
        print(f"  {'':20s}  {instance.base_url}")
        print()

    return 0


def build_parser() -> argparse.ArgumentParser:
    """Build the argument parser."""
    parser = argparse.ArgumentParser(
        prog="enricher",
        description="Iran Memorial — DB enrichment from external sources",
    )
    parser.add_argument(
        "--version", action="version", version=f"enricher {__version__}"
    )
    parser.add_argument(
        "--config", "-c",
        help="Path to enricher.toml config file",
        default=None,
    )

    sub = parser.add_subparsers(dest="command", required=True)

    # --- enrich ---
    p_enrich = sub.add_parser(
        "enrich", help="Run enrichment pipeline"
    )
    p_enrich.add_argument(
        "--source", "-s", help="Source plugin name"
    )
    p_enrich.add_argument(
        "--all", "-a", action="store_true",
        help="Run all registered sources",
    )
    p_enrich.add_argument(
        "--mode", "-m", default="enrich",
        choices=["enrich", "import-new", "full"],
        help="Mode: enrich (fill NULLs), import-new (add unmatched), full (both)",
    )
    p_enrich.add_argument(
        "--dry-run", "-n", action="store_true",
        help="Preview without writing to DB",
    )
    p_enrich.add_argument(
        "--resume", "-r", action="store_true",
        help="Resume from last progress",
    )
    p_enrich.add_argument(
        "--limit", "-l", type=int, default=None,
        help="Max entries to process",
    )
    p_enrich.add_argument(
        "--verbose", "-v", action="store_true",
        help="Verbose output",
    )

    # --- check ---
    p_check = sub.add_parser(
        "check", help="Dry-run preview (alias for enrich --dry-run)"
    )
    p_check.add_argument("--source", "-s", help="Source plugin name")
    p_check.add_argument(
        "--all", "-a", action="store_true",
        help="Check all sources",
    )
    p_check.add_argument(
        "--resume", "-r", action="store_true",
        help="Resume from last progress",
    )
    p_check.add_argument(
        "--limit", "-l", type=int, default=None,
        help="Max entries to check",
    )
    p_check.add_argument(
        "--verbose", "-v", action="store_true",
        help="Verbose output",
    )
    p_check.add_argument("--config", dest="_config_dup", help=argparse.SUPPRESS)

    # --- dedup ---
    p_dedup = sub.add_parser(
        "dedup", help="Find and merge duplicate victim records"
    )
    p_dedup.add_argument(
        "--dry-run", "-n", action="store_true", default=True,
        help="Preview without writing to DB (default)",
    )
    p_dedup.add_argument(
        "--apply", action="store_true",
        help="Actually execute merges (disables dry-run)",
    )
    p_dedup.add_argument(
        "--include-review", action="store_true",
        help="Also merge review-tier duplicates (score 30-49)",
    )
    p_dedup.add_argument(
        "--limit", "-l", type=int, default=None,
        help="Max groups to process",
    )
    p_dedup.add_argument(
        "--verbose", "-v", action="store_true",
        help="Verbose output",
    )

    # --- status ---
    sub.add_parser("status", help="Show progress status for all sources")

    # --- list ---
    sub.add_parser("list", help="List available source plugins")

    # --- photo-dedupe ---
    p_pd = sub.add_parser(
        "photo-dedupe",
        help="Find duplicate photos (SHA-256 + perceptual hash)",
    )
    p_pd.add_argument("--hash-only", action="store_true",
                      help="Just populate content_hash/phash columns, skip clustering report")
    p_pd.add_argument("--report", action="store_true", default=True,
                      help="Print cluster report (default)")
    p_pd.add_argument("--hardlink", action="store_true",
                      help="Replace exact-duplicate files with hardlinks (frees disk)")
    p_pd.add_argument("--hamming", type=int, default=6,
                      help="Max Hamming distance for pHash cluster (default 6)")
    p_pd.add_argument("--limit", "-l", type=int, default=None,
                      help="Cap on hash pass (canary mode)")
    p_pd.add_argument("--photo-store", default=None,
                      help="Local filesystem root (default $PHOTO_STORE or /var/photos)")
    p_pd.add_argument("--verbose", "-v", action="store_true", help="Verbose output")

    # --- photo-mirror ---
    p_pm = sub.add_parser(
        "photo-mirror",
        help="Download external photo URLs to local disk and rewrite to /photos/<id>",
    )
    p_pm.add_argument("--dry-run", "-n", action="store_true", default=True,
                      help="Preview without writing to DB or disk (default)")
    p_pm.add_argument("--apply", action="store_true",
                      help="Actually download + update DB")
    p_pm.add_argument("--limit", "-l", type=int, default=None,
                      help="Max rows to mirror (canary mode)")
    p_pm.add_argument("--concurrency", type=int, default=16,
                      help="Parallel downloads (default 16)")
    p_pm.add_argument("--photo-store", default=None,
                      help="Local filesystem root (default $PHOTO_STORE or /var/photos)")
    p_pm.add_argument("--photos-only", action="store_true",
                      help="Mirror photos table only (skip victims.photo_url)")
    p_pm.add_argument("--legacy-only", action="store_true",
                      help="Mirror victims.photo_url only (skip photos table)")
    p_pm.add_argument("--verbose", "-v", action="store_true", help="Verbose output")

    # --- photo-health ---
    p_ph = sub.add_parser(
        "photo-health",
        help="HEAD-check photo URLs and mark broken ones (e.g. expired Telegram CDN)",
    )
    p_ph.add_argument("--dry-run", "-n", action="store_true", default=True,
                      help="Preview without writing to DB (default)")
    p_ph.add_argument("--apply", action="store_true",
                      help="Write is_broken flags back to DB")
    p_ph.add_argument("--recheck-broken", action="store_true",
                      help="Also re-test photos already marked broken (recover them if URL came back)")
    p_ph.add_argument("--domain", default=None,
                      help="Restrict check to URLs matching this substring (e.g. 'telesco.pe')")
    p_ph.add_argument("--limit", "-l", type=int, default=None,
                      help="Max photos to check")
    p_ph.add_argument("--concurrency", type=int, default=32,
                      help="Total parallel HEAD requests (default 32)")
    p_ph.add_argument("--verbose", "-v", action="store_true", help="Verbose output")

    # --- photo-audit ---
    p_pa = sub.add_parser(
        "photo-audit",
        help="Find photo content_hash collisions across victims (blocklist candidates)",
    )
    p_pa.add_argument("--json", action="store_true",
                      help="Emit full structured collision report as JSON")
    p_pa.add_argument("--verbose", "-v", action="store_true", help="Verbose output")

    # --- photo-block ---
    p_pb = sub.add_parser(
        "photo-block",
        help="Add a SHA-256 to bad_photo_hashes + scrub every reference",
    )
    p_pb.add_argument("sha256", help="64-char lowercase hex sha256")
    p_pb.add_argument("--reason", required=True,
                      help="Why is this image blocked? Shown in audit reports.")
    p_pb.add_argument("--added-by", default=None,
                      help="Operator handle (optional)")
    p_pb.add_argument("--keep-files", action="store_true",
                      help="Skip deleting on-disk files (default: delete)")
    p_pb.add_argument("--dry-run", "-n", action="store_true",
                      help="Preview only — count affected rows + files, no writes")
    p_pb.add_argument("--verbose", "-v", action="store_true", help="Verbose output")

    # --- photo-unblock ---
    p_pu = sub.add_parser(
        "photo-unblock",
        help="Remove a SHA-256 from bad_photo_hashes",
    )
    p_pu.add_argument("sha256", help="64-char lowercase hex sha256")
    p_pu.add_argument("--verbose", "-v", action="store_true", help="Verbose output")

    # --- photo-blocklist ---
    p_pl = sub.add_parser(
        "photo-blocklist",
        help="List all entries in bad_photo_hashes",
    )
    p_pl.add_argument("--json", action="store_true", help="Emit JSON")
    p_pl.add_argument("--verbose", "-v", action="store_true", help="Verbose output")

    # --- translate ---
    p_tr = sub.add_parser(
        "translate",
        help="Translate _en bio fields to _de/_fa via Anthropic Batches API",
    )
    p_tr.add_argument("--target", required=True,
                      help="Comma-separated targets: de or fa or de,fa")
    p_tr.add_argument("--field", default=None,
                      help="Comma-separated field names (default: all translatable)")
    p_tr.add_argument("--limit", "-l", type=int, default=None,
                      help="Per-(field,target) cap (canary mode)")
    p_tr.add_argument("--dry-run", "-n", action="store_true", default=True,
                      help="Count what would be submitted, don't send (default)")
    p_tr.add_argument("--apply", action="store_true",
                      help="Actually submit the batch")
    p_tr.add_argument("--no-poll", action="store_true",
                      help="Fire-and-forget — submit + exit. Resume later via translate-poll.")
    p_tr.add_argument("--poll-interval", type=int, default=30,
                      help="Seconds between status checks (default 30)")
    p_tr.add_argument("--verbose", "-v", action="store_true", help="Verbose output")

    # --- translate-poll ---
    p_trp = sub.add_parser(
        "translate-poll",
        help="Poll a previously-submitted translate batch and apply results",
    )
    p_trp.add_argument("batch_id", help="Anthropic batch ID returned by translate --no-poll")
    p_trp.add_argument("--dry-run", "-n", action="store_true",
                      help="Fetch results but don't write to DB")
    p_trp.add_argument("--verbose", "-v", action="store_true", help="Verbose output")

    # --- grokipedia ---
    # Match-only enrichment from grokipedia.com. Walks existing victims and
    # attaches a Grokipedia source URL + fills NULL circumstances_en when a
    # confident article match is found. Never creates new victim rows.
    p_gk = sub.add_parser(
        "grokipedia",
        help="Enrich victims with Grokipedia article URLs + bio snippets (match-only, fill-NULL)",
    )
    p_gk.add_argument("--dry-run", "-n", action="store_true", default=True,
                      help="Preview without writing to DB (default)")
    p_gk.add_argument("--apply", action="store_true",
                      help="Write source rows + fill NULL circumstances_en")
    p_gk.add_argument("--recheck", action="store_true",
                      help="Also re-probe victims that already have a grokipedia source")
    p_gk.add_argument("--limit", "-l", type=int, default=None,
                      help="Max victims to probe (useful for canary runs)")
    p_gk.add_argument("--concurrency", type=int, default=4,
                      help="Parallel HTTP requests to grokipedia.com (default 4 — be polite)")
    p_gk.add_argument("--verbose", "-v", action="store_true", help="Verbose output")

    return parser


def main() -> None:
    """CLI entry point."""
    parser = build_parser()
    args = parser.parse_args()

    # Handle dedup --apply flag
    if args.command == "dedup" and getattr(args, "apply", False):
        args.dry_run = False

    commands = {
        "enrich": cmd_enrich,
        "check": cmd_check,
        "dedup": cmd_dedup,
        "status": cmd_status,
        "list": cmd_list,
        "photo-health": cmd_photo_health,
        "photo-mirror": cmd_photo_mirror,
        "photo-dedupe": cmd_photo_dedupe,
        "photo-audit": cmd_photo_audit,
        "photo-block": cmd_photo_block,
        "photo-unblock": cmd_photo_unblock,
        "photo-blocklist": cmd_photo_blocklist,
        "translate": cmd_translate,
        "translate-poll": cmd_translate_poll,
        "grokipedia": cmd_grokipedia,
    }

    handler = commands.get(args.command)
    if not handler:
        parser.print_help()
        sys.exit(1)

    try:
        exit_code = asyncio.run(handler(args))
    except KeyboardInterrupt:
        print("\nAborted.")
        exit_code = 130
    except Exception as e:
        logging.getLogger("enricher").error(f"Fatal: {e}", exc_info=True)
        exit_code = 1

    sys.exit(exit_code)
