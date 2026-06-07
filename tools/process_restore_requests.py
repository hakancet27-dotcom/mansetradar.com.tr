from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from process_delete_flow import ROOT, read_json, sync_queue_files, write_json


REQUEST_ROOT = ROOT / "cms-restore-requests"
RESTORE_MAP = {
    "unpublished": "published",
    "archived": "unpublished",
    "trash": "archived",
}


def restore_article(article_rel: str, current_stage: str) -> None:
    article_path = (ROOT / article_rel).resolve()
    if not str(article_path).startswith(str(ROOT.resolve())):
        raise ValueError(f"Unsafe article path: {article_rel}")
    if not article_path.exists():
        raise FileNotFoundError(f"Article not found: {article_rel}")
    if current_stage not in RESTORE_MAP:
        raise ValueError(f"Unsupported current_stage: {current_stage}")

    payload = read_json(article_path)
    new_stage = RESTORE_MAP[current_stage]
    now = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    payload["publication_lifecycle"] = new_stage
    payload["publication_changed_at"] = now
    payload["publication_changed_by"] = "cms_restore_request"
    payload["manual_noindex"] = new_stage != "published"
    payload["indexed_on_home"] = new_stage == "published"
    payload["publication_note"] = f"CMS restore request applied: {current_stage} -> {new_stage}"
    if new_stage != "trash":
        payload.pop("trashed_at", None)
        payload.pop("trash_delete_after", None)
    write_json(article_path, payload)


def main() -> int:
    REQUEST_ROOT.mkdir(parents=True, exist_ok=True)
    changed = False
    for request_file in sorted(REQUEST_ROOT.glob("*.json")):
        request = json.loads(request_file.read_text(encoding="utf-8-sig"))
        article_rel = str(request.get("article_path") or "").strip().lstrip("/")
        current_stage = str(request.get("current_stage") or "").strip().lower()
        if not article_rel or current_stage not in RESTORE_MAP:
            request_file.unlink(missing_ok=True)
            continue
        restore_article(article_rel, current_stage)
        request_file.unlink(missing_ok=True)
        changed = True

    if changed:
        sync_queue_files()
    print(f"restore_requests_changed={changed}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
