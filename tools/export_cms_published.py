#!/usr/bin/env python3
from __future__ import annotations

import json
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
            flat = dict(data)
            flat['slug'] = slug
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
