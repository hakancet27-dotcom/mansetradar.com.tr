#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path

ARTICLE_SOURCES = (
    (Path('articles'), Path('data/cms-published/articles')),
    (Path('news/articles'), Path('data/cms-published/news/articles')),
    (Path('nachrichten/artikel'), Path('data/cms-published/nachrichten/artikel')),
)
SKIP_PARTS = {'images', 'review', 'pending', 'duplicates', 'archive'}


def article_json_paths(root: Path) -> list[Path]:
    paths: list[Path] = []
    if not root.exists():
        return paths
    for path in root.rglob('*.json'):
        try:
            rel = path.relative_to(root)
        except ValueError:
            continue
        if any(part in SKIP_PARTS for part in rel.parts[:-1]):
            continue
        paths.append(path)
    return sorted(paths, key=lambda item: (len(item.relative_to(root).parts), item.as_posix()))


def read_json(path: Path):
    try:
        data = json.loads(path.read_text(encoding='utf-8-sig'))
    except Exception as exc:
        print(f'Skip {path}: {exc}')
        return None
    return data if isinstance(data, dict) else None


def should_skip_public_export(data: dict) -> bool:
    lifecycle = str(data.get('publication_lifecycle') or '').strip().lower()
    return lifecycle == 'archived'


def url_prefix(source_name: str, source_root: Path, path: Path, data: dict) -> str:
    explicit = str(data.get('url_prefix') or '').strip().strip('/')
    if explicit:
        return explicit
    try:
        parent = path.parent.relative_to(source_root)
    except ValueError:
        return source_name
    if parent == Path('.'):
        return source_name
    return f'{source_name}/{parent.as_posix()}'.strip('/')


def parse_dt(raw: str) -> datetime | None:
    value = str(raw or '').strip()
    if not value:
        return None
    normalized = value.replace('Z', '+00:00')
    try:
        dt = datetime.fromisoformat(normalized)
        return dt.astimezone(timezone.utc) if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except ValueError:
        pass
    for fmt in ('%d.%m.%Y %H:%M', '%d.%m.%Y', '%Y-%m-%d %H:%M', '%Y-%m-%d'):
        try:
            dt = datetime.strptime(value, fmt)
            return dt.replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return None


def source_datetime(data: dict, path: Path) -> datetime:
    for key in ('source_published_at', 'published_at', 'created_at', 'publication_changed_at'):
        dt = parse_dt(str(data.get(key) or ''))
        if dt:
            return dt
    date_text = str(data.get('date') or '').strip()
    time_text = str(data.get('time') or '').strip()
    dt = parse_dt(f'{date_text} {time_text}'.strip()) or parse_dt(date_text)
    if dt:
        return dt
    match = re.search(r'_(20\d{6})(?:\D|$)', path.stem)
    if match:
        try:
            return datetime.strptime(match.group(1), '%Y%m%d').replace(tzinfo=timezone.utc)
        except ValueError:
            pass
    return datetime.now(timezone.utc)


def write_json(path: Path, data: dict) -> bool:
    path.parent.mkdir(parents=True, exist_ok=True)
    content = json.dumps(data, ensure_ascii=False, indent=2) + '\n'
    if path.exists() and path.read_text(encoding='utf-8') == content:
        return False
    path.write_text(content, encoding='utf-8')
    return True


def prune(folder: Path, expected: set[Path]) -> None:
    if not folder.exists():
        return
    expected_resolved = {path.resolve() for path in expected}
    for path in sorted(folder.glob('*.json')):
        if path.resolve() not in expected_resolved:
            path.unlink()


def main() -> None:
    scanned = 0
    written = 0
    skipped = 0
    for source_root, target_root in ARTICLE_SOURCES:
        expected: set[Path] = set()
        source_name = source_root.as_posix()
        for path in article_json_paths(source_root):
            scanned += 1
            data = read_json(path)
            if not data:
                continue
            if should_skip_public_export(data):
                skipped += 1
                continue
            slug = str(data.get('slug') or path.stem).strip() or path.stem
            prefix = url_prefix(source_name, source_root, path, data)
            dt = source_datetime(data, path)
            flat = dict(data)
            flat['slug'] = slug
            flat['published_at'] = dt.isoformat().replace('+00:00', 'Z')
            flat['sort_date'] = dt.strftime('%Y-%m-%dT%H:%M:%SZ')
            flat['time'] = dt.strftime('%H:%M')
            flat['url_prefix'] = prefix
            flat['public_url'] = f'/{prefix}/{slug}/'
            flat['source_json_path'] = path.as_posix()
            flat['cms_generated_from_monthly_source'] = True
            target = target_root / f'{slug}.json'
            expected.add(target)
            if write_json(target, flat):
                written += 1
        prune(target_root, expected)
    print(f'CMS published export done: scanned={scanned} written={written} skipped={skipped}')


if __name__ == '__main__':
    main()
