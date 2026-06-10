#!/usr/bin/env python3
from __future__ import annotations

import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

CMS_ROOTS = (
    Path('data/cms-published/articles'),
    Path('data/cms-published/news/articles'),
    Path('data/cms-published/nachrichten/artikel'),
)
MAX_REMOVALS_PER_RUN = 5
EDITABLE_FIELDS = {
    'title', 'date', 'time', 'category', 'spot', 'summary', 'content_html',
    'image_url', 'image_alt', 'image_gallery', 'meta_title', 'meta_description',
    'discover_titles', 'tags', 'language', 'country'
}


def read_json(path: Path) -> dict[str, Any] | None:
    try:
        data = json.loads(path.read_text(encoding='utf-8-sig'))
    except Exception as exc:
        print(f'Skip CMS edit {path}: {exc}')
        return None
    return data if isinstance(data, dict) else None


def parse_json_text(text: str) -> dict[str, Any] | None:
    try:
        data = json.loads(text)
    except Exception:
        return None
    return data if isinstance(data, dict) else None


def write_json_if_changed(path: Path, data: dict[str, Any]) -> bool:
    content = json.dumps(data, ensure_ascii=False, indent=2) + '\n'
    if path.exists() and path.read_text(encoding='utf-8') == content:
        return False
    path.write_text(content, encoding='utf-8')
    return True


def run_git(args: list[str], cwd: Path) -> str:
    proc = subprocess.run(['git', *args], cwd=cwd, text=True, capture_output=True, check=False)
    return proc.stdout if proc.returncode == 0 else ''


def safe_source_path(site_root: Path, value: Any) -> Path | None:
    raw = str(value or '').strip().lstrip('/')
    if not raw:
        return None
    path = (site_root / raw).resolve()
    try:
        path.relative_to(site_root.resolve())
    except ValueError:
        return None
    if path.suffix.lower() != '.json' or not path.exists():
        return None
    return path


def cms_paths(site_root: Path) -> list[Path]:
    paths: list[Path] = []
    for root in CMS_ROOTS:
        folder = site_root / root
        if folder.exists():
            paths.extend(sorted(folder.glob('*.json')))
    return paths


def recent_removed_cms_records(site_root: Path) -> list[dict[str, Any]]:
    roots = [root.as_posix() for root in CMS_ROOTS]
    out = run_git(['log', '--diff-filter=D', '--name-only', '--pretty=format:', '--', *roots], site_root)
    records: list[dict[str, Any]] = []
    seen: set[str] = set()
    for rel in [line.strip() for line in out.splitlines() if line.strip().endswith('.json')]:
        if rel in seen or (site_root / rel).exists():
            continue
        seen.add(rel)
        commit = run_git(['log', '--diff-filter=D', '--format=%H', '-n', '1', '--', rel], site_root).strip().splitlines()
        if not commit:
            continue
        old_text = run_git(['show', f'{commit[0]}^:{rel}'], site_root)
        data = parse_json_text(old_text)
        if data:
            records.append(data)
    return records[: MAX_REMOVALS_PER_RUN + 1]


def mark_source_archived(path: Path, data: dict[str, Any]) -> bool:
    if str(data.get('publication_lifecycle') or '').strip().lower() == 'archived':
        return False
    updated = dict(data)
    updated['manual_noindex'] = True
    updated['indexed_on_home'] = False
    updated['publication_lifecycle'] = 'archived'
    updated['archived_at'] = datetime.now(timezone.utc).isoformat(timespec='seconds')
    updated['publication_note'] = 'Sveltia yayin listesinden kaldirildi.'
    return write_json_if_changed(path, updated)


def apply_recent_removals(site_root: Path) -> dict[str, int]:
    records = recent_removed_cms_records(site_root)
    stats = {'seen': len(records), 'archived': 0, 'guard_skipped': 0}
    if len(records) > MAX_REMOVALS_PER_RUN:
        stats['guard_skipped'] = len(records)
        print(f'CMS removal guard skipped: more than {MAX_REMOVALS_PER_RUN} records detected.')
        return stats
    for record in records:
        source_path = safe_source_path(site_root, record.get('source_json_path'))
        if source_path is None:
            continue
        source_data = read_json(source_path)
        if source_data and mark_source_archived(source_path, source_data):
            stats['archived'] += 1
            print(f'CMS removal applied: {source_path} -> archived')
    return stats


def apply_edits(site_root: Path) -> dict[str, int]:
    stats = {'scanned': 0, 'changed': 0, 'missing_source': 0}
    for cms_path in cms_paths(site_root):
        stats['scanned'] += 1
        cms_data = read_json(cms_path)
        if not cms_data:
            continue
        source_path = safe_source_path(site_root, cms_data.get('source_json_path'))
        if source_path is None:
            stats['missing_source'] += 1
            continue
        source_data = read_json(source_path)
        if not source_data:
            continue
        updated = dict(source_data)
        for field in EDITABLE_FIELDS:
            if field in cms_data:
                updated[field] = cms_data[field]
        updated['slug'] = source_data.get('slug') or cms_data.get('slug') or source_path.stem
        if write_json_if_changed(source_path, updated):
            stats['changed'] += 1
            print(f'CMS edit applied: {cms_path} -> {source_path}')
    return stats


def main() -> None:
    site_root = Path('.').resolve()
    edit_stats = apply_edits(site_root)
    removal_stats = apply_recent_removals(site_root)
    print(
        'CMS published edits applied -> '
        f"scanned={edit_stats['scanned']} changed={edit_stats['changed']} "
        f"missing_source={edit_stats['missing_source']} "
        f"removed_seen={removal_stats['seen']} "
        f"removed_archived={removal_stats['archived']} "
        f"removal_guard_skipped={removal_stats['guard_skipped']}"
    )


if __name__ == '__main__':
    main()
