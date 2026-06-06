from __future__ import annotations

import argparse
import json
import shutil
import subprocess
from datetime import datetime, timedelta, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
QUEUE_ROOT = ROOT / "cms-delete-flow"
ARTICLE_DIRS = (ROOT / "articles", ROOT / "news" / "articles", ROOT / "nachrichten" / "artikel")
STAGE_ORDER = {
    "published": "unpublished",
    "unpublished": "archived",
    "archived": "trash",
    "trash": "delete",
}


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def clean_queue_root() -> None:
    if QUEUE_ROOT.exists():
        shutil.rmtree(QUEUE_ROOT)
    for stage in STAGE_ORDER:
        (QUEUE_ROOT / stage).mkdir(parents=True, exist_ok=True)


def write_stage_placeholders() -> None:
    for stage in STAGE_ORDER:
        stage_dir = QUEUE_ROOT / stage
        if any(stage_dir.glob("*.json")):
            keep = stage_dir / ".gitkeep"
            if keep.exists():
                keep.unlink()
            continue
        (stage_dir / ".gitkeep").write_text("", encoding="utf-8")


def article_stage(payload: dict) -> str:
    value = str(payload.get("publication_lifecycle") or "").strip().lower()
    if value in {"unpublished", "archived", "trash"}:
        return value
    return "published"


def marker_name(article_path: Path) -> str:
    rel = article_path.relative_to(ROOT).as_posix().replace("/", "__")
    return rel.removesuffix(".json") + ".json"


def next_delete_action(stage: str) -> str:
    return {
        "published": "Delete = Yayindan Kaldir",
        "unpublished": "Delete = Arsive Tasi",
        "archived": "Delete = Cop Kutusuna Gonder",
        "trash": "Delete = Kalici Sil",
    }[stage]


def sync_queue_files() -> None:
    clean_queue_root()
    for article_dir in ARTICLE_DIRS:
        if not article_dir.exists():
            continue
        for article_path in sorted(article_dir.glob("*.json")):
            try:
                payload = read_json(article_path)
            except Exception:
                continue
            stage = article_stage(payload)
            marker = {
                "title": payload.get("title") or article_path.stem,
                "slug": payload.get("slug") or article_path.stem,
                "date": payload.get("date") or "",
                "category": payload.get("category") or "",
                "language": payload.get("language") or "",
                "article_path": article_path.relative_to(ROOT).as_posix(),
                "current_stage": stage,
                "next_delete_action": next_delete_action(stage),
                "publication_lifecycle": payload.get("publication_lifecycle") or "published",
            }
            write_json(QUEUE_ROOT / stage / marker_name(article_path), marker)
    write_stage_placeholders()


def transition_article(article_path: Path, stage: str) -> None:
    if not article_path.exists():
        return
    if stage == "trash":
        html_path = article_path.with_suffix(".html")
        pretty_dir = article_path.with_suffix("")
        article_path.unlink(missing_ok=True)
        html_path.unlink(missing_ok=True)
        if pretty_dir.exists() and pretty_dir.is_dir():
            shutil.rmtree(pretty_dir, ignore_errors=True)
        return

    payload = read_json(article_path)
    new_stage = STAGE_ORDER.get(stage)
    now = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    payload["publication_changed_at"] = now
    payload["publication_changed_by"] = "cms_delete_flow"
    payload["manual_noindex"] = new_stage != "published"
    payload["indexed_on_home"] = new_stage == "published"
    if new_stage:
        payload["publication_lifecycle"] = new_stage
    if new_stage == "trash":
        payload["trashed_at"] = now
        payload["trash_delete_after"] = (datetime.now(timezone.utc) + timedelta(days=30)).replace(microsecond=0).isoformat()
    write_json(article_path, payload)


def deleted_markers(before: str, head: str) -> list[tuple[str, dict]]:
    if not before or before == "0000000000000000000000000000000000000000":
        return []
    diff = subprocess.run(
        ["git", "diff", "--name-status", before, head, "--", str(QUEUE_ROOT.relative_to(ROOT)).replace("\\", "/")],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=True,
    )
    items: list[tuple[str, dict]] = []
    for line in diff.stdout.splitlines():
        parts = line.split("\t", 1)
        if len(parts) != 2 or parts[0] != "D":
            continue
        path = parts[1]
        show = subprocess.run(
            ["git", "show", f"{before}:{path}"],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=True,
        )
        payload = json.loads(show.stdout)
        items.append((path, payload))
    return items


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--before", default="")
    parser.add_argument("--head", default="HEAD")
    args = parser.parse_args()

    changed = False
    for _, marker in deleted_markers(args.before, args.head):
        article_rel = marker.get("article_path")
        stage = marker.get("current_stage")
        if not article_rel or stage not in STAGE_ORDER:
            continue
        transition_article(ROOT / article_rel, stage)
        changed = True

    sync_queue_files()
    print(f"delete_flow_changed={changed}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
