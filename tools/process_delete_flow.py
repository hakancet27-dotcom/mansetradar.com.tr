from __future__ import annotations

import argparse
import json
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[1]
SITE_HOSTS = {"mansetradar.com.tr", "www.mansetradar.com.tr"}
ARTICLE_ROOTS = {
    "articles": ROOT / "articles",
    "news/articles": ROOT / "news" / "articles",
    "nachrichten/artikel": ROOT / "nachrichten" / "artikel",
}
DATA_CACHE_FILES = [
    ROOT / "data" / "articles.json",
    ROOT / "data" / "home.json",
    ROOT / "data" / "search-index.json",
]
IMAGE_SUFFIXES = (".webp", ".jpg", ".jpeg", ".png", ".avif")


def run_git(*args: str) -> str:
    result = subprocess.run(
        ["git", *args],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=True,
    )
    return result.stdout


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def write_json(path: Path, payload: Any) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def clean_text(value: Any) -> str:
    return str(value or "").strip()


def deleted_cms_paths(before: str, head: str) -> list[Path]:
    if not before or before == "0000000000000000000000000000000000000000":
        return []
    diff_output = run_git(
        "diff",
        "--name-status",
        before,
        head,
        "--",
        "data/cms-published",
    )
    deleted: list[Path] = []
    for line in diff_output.splitlines():
        parts = line.split("\t", 1)
        if len(parts) != 2 or parts[0] != "D":
            continue
        rel_path = Path(parts[1])
        if rel_path.suffix.lower() != ".json":
            continue
        deleted.append(rel_path)
    return deleted


def deleted_payload(before: str, rel_path: Path) -> dict[str, Any]:
    raw = run_git("show", f"{before}:{rel_path.as_posix()}")
    payload = json.loads(raw)
    return payload if isinstance(payload, dict) else {}


def source_article_rel_path(payload: dict[str, Any], cms_rel_path: Path) -> Path | None:
    raw_source_path = clean_text(payload.get("source_json_path")).lstrip("/")
    if raw_source_path:
        candidate = Path(raw_source_path)
        if candidate.suffix.lower() == ".json":
            return candidate

    slug = clean_text(payload.get("slug")) or cms_rel_path.stem
    raw_url_prefix = clean_text(payload.get("url_prefix")).strip("/")
    if raw_url_prefix:
        return Path(raw_url_prefix) / f"{slug}.json"

    raw_public_url = clean_text(payload.get("public_url")).strip("/")
    if raw_public_url:
        public_path = Path(raw_public_url)
        return public_path.parent / f"{slug}.json"

    cms_posix = cms_rel_path.as_posix()
    if cms_posix.startswith("data/cms-published/articles/"):
        return Path("articles") / f"{slug}.json"
    if cms_posix.startswith("data/cms-published/news/articles/"):
        return Path("news/articles") / f"{slug}.json"
    if cms_posix.startswith("data/cms-published/nachrichten/artikel/"):
        return Path("nachrichten/artikel") / f"{slug}.json"
    return None


def article_root_prefix(rel_path: Path) -> str:
    rel_posix = rel_path.as_posix()
    for prefix in ARTICLE_ROOTS:
        if rel_posix == prefix or rel_posix.startswith(prefix + "/"):
            return prefix
    raise ValueError(f"Article root bilinmiyor: {rel_path}")


def url_prefix_for_article(rel_path: Path, payload: dict[str, Any]) -> str:
    explicit = clean_text(payload.get("url_prefix"))
    if explicit:
        return explicit.strip("/")

    prefix = article_root_prefix(rel_path)
    root_path = Path(prefix)
    try:
        rel_parent = rel_path.parent.relative_to(root_path)
    except ValueError:
        return prefix
    if rel_parent == Path("."):
        return prefix
    return f"{prefix}/{rel_parent.as_posix()}".strip("/")


def detail_json_path(url_prefix: str, slug: str) -> Path:
    return ROOT / "data" / "details" / Path(url_prefix) / f"{slug}.json"


def article_url(url_prefix: str, slug: str) -> str:
    return f"/{url_prefix.strip('/')}/{slug}/"


def article_id(url_prefix: str, slug: str) -> str:
    return f"{url_prefix}:{slug}"


def local_image_path(value: Any) -> Path | None:
    raw = clean_text(value)
    if not raw:
        return None

    path_part = ""
    if raw.startswith(("http://", "https://")):
        parsed = urlparse(raw)
        if parsed.netloc.lower() not in SITE_HOSTS:
            return None
        path_part = parsed.path
    else:
        path_part = raw

    rel = Path(path_part.lstrip("/"))
    if not rel.parts:
        return None
    if "stock" in {part.lower() for part in rel.parts}:
        return None
    try:
        absolute = (ROOT / rel).resolve()
        absolute.relative_to(ROOT.resolve())
    except Exception:
        return None
    return absolute


def iter_article_json_paths() -> list[Path]:
    paths: list[Path] = []
    for directory in ARTICLE_ROOTS.values():
        if directory.exists():
            paths.extend(directory.rglob("*.json"))
    return paths


def image_is_still_referenced(candidate: Path) -> bool:
    target = candidate.resolve()
    for article_path in iter_article_json_paths():
        try:
            payload = read_json(article_path)
        except Exception:
            continue
        referenced = local_image_path(payload.get("image_url"))
        if referenced and referenced.resolve() == target:
            return True
    return False


def remove_path(path: Path, removed: list[str]) -> None:
    if not path.exists():
        return
    if path.is_dir():
        shutil.rmtree(path, ignore_errors=True)
    else:
        path.unlink(missing_ok=True)
    removed.append(path.relative_to(ROOT).as_posix())


def cleanup_empty_dirs(start: Path, stop: Path) -> None:
    current = start
    while current.exists() and current != stop:
        try:
            current.rmdir()
        except OSError:
            break
        current = current.parent


def article_matcher(meta: dict[str, str], value: Any) -> bool:
    if not isinstance(value, dict):
        return False
    if value.get("id") == meta["article_id"]:
        return True
    if value.get("detail_json_url") == meta["detail_json_url"]:
        return True
    if value.get("url") == meta["article_url"]:
        return True
    return value.get("slug") == meta["slug"] and value.get("section") == meta["section"]


def prune_value(value: Any, meta: dict[str, str]) -> tuple[Any, bool]:
    if isinstance(value, list):
        changed = False
        items = []
        for item in value:
            if article_matcher(meta, item):
                changed = True
                continue
            pruned_item, item_changed = prune_value(item, meta)
            changed = changed or item_changed
            items.append(pruned_item)
        return items, changed

    if isinstance(value, dict):
        changed = False
        result: dict[str, Any] = {}
        for key, item in value.items():
            pruned_item, item_changed = prune_value(item, meta)
            changed = changed or item_changed
            result[key] = pruned_item
        return result, changed

    return value, False


def data_cache_paths() -> list[Path]:
    paths = list(DATA_CACHE_FILES)
    paths.extend(sorted((ROOT / "data" / "categories").glob("*.json")))
    paths.extend(sorted((ROOT / "data" / "sections").glob("*.json")))
    return paths


def prune_cache_files(meta: dict[str, str]) -> list[Path]:
    changed: list[Path] = []
    for path in data_cache_paths():
        if not path.exists():
            continue
        try:
            payload = read_json(path)
        except Exception:
            continue
        pruned, did_change = prune_value(payload, meta)
        if not did_change:
            continue
        write_json(path, pruned)
        changed.append(path)
    return changed


def sync_cache_meta(changed_paths: list[Path]) -> None:
    articles_path = ROOT / "data" / "articles.json"
    if not articles_path.exists():
        return
    try:
        articles_payload = read_json(articles_path)
    except Exception:
        return
    if not isinstance(articles_payload, dict):
        return
    article_count = len(articles_payload.get("articles") or [])
    generated_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    all_paths = list(dict.fromkeys(data_cache_paths() + changed_paths))
    for path in all_paths:
        if not path.exists():
            continue
        try:
            payload = read_json(path)
        except Exception:
            continue
        if not isinstance(payload, dict) or not isinstance(payload.get("meta"), dict):
            continue
        meta = payload["meta"]
        updated = False
        if meta.get("article_count") != article_count:
            meta["article_count"] = article_count
            updated = True
        if meta.get("generated_at") != generated_at:
            meta["generated_at"] = generated_at
            updated = True
        if updated:
            write_json(path, payload)


def remove_deleted_article_outputs(rel_path: Path, payload: dict[str, Any]) -> list[str]:
    slug = clean_text(payload.get("slug")) or rel_path.stem
    url_prefix = url_prefix_for_article(rel_path, payload)
    removed: list[str] = []

    source_json = ROOT / rel_path
    flat_html = (ROOT / rel_path).with_suffix(".html")
    pretty_dir = (ROOT / rel_path).with_suffix("")
    detail_path = detail_json_path(url_prefix, slug)

    remove_path(source_json, removed)
    cleanup_empty_dirs(source_json.parent, ARTICLE_ROOTS[article_root_prefix(rel_path)])
    remove_path(flat_html, removed)
    remove_path(pretty_dir, removed)
    remove_path(detail_path, removed)
    cleanup_empty_dirs(detail_path.parent, ROOT / "data" / "details")

    image_candidates = {(ROOT / rel_path.parent / "images" / f"{slug}{suffix}").resolve() for suffix in IMAGE_SUFFIXES}
    explicit_image = local_image_path(payload.get("image_url"))
    if explicit_image:
        image_candidates.add(explicit_image.resolve())

    for image_path in sorted(image_candidates):
        if not image_path.exists():
            continue
        if image_is_still_referenced(image_path):
            continue
        remove_path(image_path, removed)

    meta = {
        "slug": slug,
        "section": article_root_prefix(rel_path),
        "article_id": article_id(url_prefix, slug),
        "article_url": clean_text(payload.get("public_url")) or article_url(url_prefix, slug),
        "detail_json_url": f"/data/details/{url_prefix.strip('/')}/{slug}.json",
    }
    changed_cache_paths = prune_cache_files(meta)
    sync_cache_meta(changed_cache_paths)

    return removed


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--before", default="")
    parser.add_argument("--head", default="HEAD")
    args = parser.parse_args()

    deleted_paths = deleted_cms_paths(args.before, args.head)
    if not deleted_paths:
        print("cms_article_delete_changed=False")
        return 0

    total_removed: dict[str, list[str]] = {}
    for cms_rel_path in deleted_paths:
        payload = deleted_payload(args.before, cms_rel_path)
        source_rel_path = source_article_rel_path(payload, cms_rel_path)
        if source_rel_path is None:
            print(f"CMS_DELETE_CLEANUP skipped={cms_rel_path.as_posix()} reason=missing_source_path")
            continue
        removed = remove_deleted_article_outputs(source_rel_path, payload)
        total_removed[source_rel_path.as_posix()] = removed
        print(
            "CMS_DELETE_CLEANUP "
            f"mirror={cms_rel_path.as_posix()} "
            f"article={source_rel_path.as_posix()} "
            f"removed={','.join(removed) or '-'}"
        )

    print(f"cms_article_delete_changed={bool(total_removed)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
