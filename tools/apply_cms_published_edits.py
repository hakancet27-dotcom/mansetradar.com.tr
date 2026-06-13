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
    'title', 'date', 'time', 'category', 'spot', 'summary', 'content_html',
    'image_url', 'image_alt', 'image_gallery', 'meta_title', 'meta_description',
    'discover_titles', 'tags', 'language', 'country'
}
STALE_IMAGE_FIELDS = {
    'image_local_webp', 'image_identity_url', 'original_image_url', 'image_source_url',
    'image_credit', 'image_credit_url', 'image_finalized_at', 'image_provider',
    'image_kind', 'image_license_status', 'image_license_note', 'image_score',
    'image_query', 'image_quality_note'
}


def clean(value: Any) -> str:
    return str(value or '').strip()


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


def cms_image_overrides_source(cms_data: dict[str, Any], source_data: dict[str, Any]) -> bool:
    cms_image = clean(cms_data.get('image_url'))
    if not cms_image:
        return False
    source_image = clean(source_data.get('image_url'))
    source_local = clean(source_data.get('image_local_webp'))
    source_original = clean(source_data.get('original_image_url'))
    return bool(
        cms_image != source_image
        or (source_local and source_local != cms_image)
        or (source_original and source_original != cms_image and cms_image.lstrip('/').startswith(('articles/images/', 'cms-stock-images/')))
    )


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
        image_override = cms_image_overrides_source(cms_data, source_data)
        for field in EDITABLE_FIELDS:
            if field in cms_data:
                updated[field] = cms_data[field]
        if image_override:
            for field in STALE_IMAGE_FIELDS:
                updated.pop(field, None)
            updated['image_provider'] = 'cms'
            updated['image_license_status'] = 'cms_editor_selected'
        updated['slug'] = source_data.get('slug') or cms_data.get('slug') or source_path.stem
        if write_json_if_changed(source_path, updated):
            stats['changed'] += 1
            print(f'CMS edit applied: {cms_path} -> {source_path}')
    if stats['changed']:
        Path('.newsroom_site_changed').write_text('cms_published_edits\n', encoding='utf-8')
    return stats


def main() -> None:
    site_root = Path('.').resolve()
    edit_stats = apply_edits(site_root)
    print(
        'CMS published edits applied -> '
        f"scanned={edit_stats['scanned']} changed={edit_stats['changed']} "
        f"missing_source={edit_stats['missing_source']}"
    )


if __name__ == '__main__':
    main()
