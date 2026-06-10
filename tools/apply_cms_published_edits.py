#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

CMS_ROOTS = (
    Path('data/cms-published/articles'),
    Path('data/cms-published/news/articles'),
    Path('data/cms-published/nachrichten/artikel'),
)
EDITABLE_FIELDS = {
    'title', 'date', 'category', 'spot', 'summary', 'content_html',
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


def write_json_if_changed(path: Path, data: dict[str, Any]) -> bool:
    content = json.dumps(data, ensure_ascii=False, indent=2) + '\n'
    if path.exists() and path.read_text(encoding='utf-8') == content:
        return False
    path.write_text(content, encoding='utf-8')
    return True


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
    stats = apply_edits(Path('.').resolve())
    print(
        'CMS published edits applied -> '
        f"scanned={stats['scanned']} changed={stats['changed']} missing_source={stats['missing_source']}"
    )


if __name__ == '__main__':
    main()
