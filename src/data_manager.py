"""
Data management layer for ACM Compass
Handles all file I/O operations for problems, contests, and solutions
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import List, Optional
from datetime import datetime, timezone
from uuid import uuid4
from threading import Lock

from .models import LETTERS

# ----- Paths -----
BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)
DATA_FILE = DATA_DIR / "problems.json"
CONTESTS_FILE = DATA_DIR / "contests.json"
SOLUTIONS_DIR = DATA_DIR / "solutions"
SOLUTIONS_DIR.mkdir(exist_ok=True)

# Ensure data files exist
if not DATA_FILE.exists():
    DATA_FILE.write_text("[]", encoding="utf-8")
if not CONTESTS_FILE.exists():
    CONTESTS_FILE.write_text("[]", encoding="utf-8")

# Thread-safe read/write
_lock = Lock()


# ----- Problem Management -----
def normalize_record(rec: dict) -> dict:
    """Normalize problem record for backward compatibility"""
    rec = dict(rec)
    rec.pop('has_solution', None)
    owner = rec.pop('owner', None)

    if 'solved' not in rec:
        status = str(rec.get('status') or '').lower()
        rec['solved'] = True if status == 'done' else False

    if 'unsolved_stage' not in rec:
        rec['unsolved_stage'] = None
    else:
        stage = rec.get('unsolved_stage')
        if stage not in {"未看题", "已看题无思路", "知道做法未实现"}:
            rec['unsolved_stage'] = None

    custom_label = rec.get('unsolved_custom_label')
    if custom_label is not None:
        custom_label = str(custom_label).strip() or None
    rec['unsolved_custom_label'] = None if rec.get('solved') else custom_label

    if 'tags' not in rec or rec['tags'] is None:
        rec['tags'] = []

    try:
        if 'pass_count' in rec and rec['pass_count'] is not None:
            rec['pass_count'] = int(rec['pass_count'])
    except Exception:
        rec['pass_count'] = None

    assignee = rec.get('assignee')
    if assignee is None and owner:
        assignee = owner
    if assignee is not None:
        assignee = str(assignee).strip() or None
    rec['assignee'] = assignee

    if rec.get('solved'):
        rec['unsolved_stage'] = None
        rec['unsolved_custom_label'] = None

    return rec


def load_problems() -> List[dict]:
    """Load problems from JSON file"""
    with _lock:
        try:
            items = json.loads(DATA_FILE.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            backup = DATA_FILE.with_suffix(".backup.json")
            backup.write_text(DATA_FILE.read_text(encoding="utf-8"), encoding="utf-8")
            DATA_FILE.write_text("[]", encoding="utf-8")
            items = []

        changed = False
        normalized_items: List[dict] = []
        for rec in items:
            rec = dict(rec)
            # migrate any legacy solution fields into markdown files
            content = None
            for key in ('solution_markdown', 'solution_md', 'solution'):
                if key in rec and rec[key]:
                    content = rec.pop(key)
                    changed = True
                    break
            if content and rec.get('id'):
                write_solution(str(rec['id']), str(content))
            # drop deprecated or computed fields before normalization
            if rec.pop('has_solution', None) is not None:
                changed = True
            normalized_items.append(normalize_record(rec))

        if changed:
            sanitized = []
            for rec in normalized_items:
                clean = dict(rec)
                clean.pop('has_solution', None)
                sanitized.append(clean)
            DATA_FILE.write_text(json.dumps(sanitized, ensure_ascii=False, indent=2), encoding="utf-8")

    # attach solution presence flag outside of lock
    for rec in normalized_items:
        pid = rec.get('id')
        if pid:
            rec['has_solution'] = solution_exists(str(pid))
        else:
            rec['has_solution'] = False
    return normalized_items


def save_problems(items: List[dict]) -> None:
    """Save problems to JSON file"""
    with _lock:
        sanitized = []
        for rec in items:
            rec = dict(rec)
            rec.pop('has_solution', None)
            sanitized.append(rec)
        DATA_FILE.write_text(json.dumps(sanitized, ensure_ascii=False, indent=2), encoding="utf-8")


def create_problem(data: dict) -> dict:
    """Create a new problem"""
    items = load_problems()
    now = datetime.now(timezone.utc).isoformat()

    rec = {
        'id': str(uuid4()),
        'created_at': now,
        'updated_at': now,
        **data
    }
    items.append(normalize_record(rec))
    save_problems(items)
    rec['has_solution'] = solution_exists(rec['id'])
    return rec


def update_problem(problem_id: str, data: dict) -> Optional[dict]:
    """Update an existing problem"""
    items = load_problems()
    now = datetime.now(timezone.utc).isoformat()

    for i, rec in enumerate(items):
        if rec.get('id') == problem_id:
            rec.update(data)
            rec['updated_at'] = now
            items[i] = normalize_record(rec)
            save_problems(items)
            items[i]['has_solution'] = solution_exists(problem_id)
            return items[i]

    return None


def delete_problem(problem_id: str) -> bool:
    """Delete a problem and its solution"""
    items = load_problems()
    original_len = len(items)
    items = [it for it in items if it.get('id') != problem_id]

    if len(items) == original_len:
        return False

    save_problems(items)
    delete_solution(problem_id)
    return True


# ----- Solution Management -----
def solution_path(problem_id: str) -> Path:
    """Get the path to a solution file"""
    return SOLUTIONS_DIR / f"{problem_id}.md"


def solution_exists(problem_id: str) -> bool:
    """Check if a solution file exists"""
    return solution_path(problem_id).exists()


def read_solution(problem_id: str) -> Optional[str]:
    """Read a solution file"""
    path = solution_path(problem_id)
    if not path.exists():
        return None
    return path.read_text(encoding="utf-8")


def write_solution(problem_id: str, markdown: str) -> None:
    """Write a solution file"""
    path = solution_path(problem_id)
    path.write_text(markdown, encoding="utf-8")


def delete_solution(problem_id: str) -> None:
    """Delete a solution file"""
    path = solution_path(problem_id)
    if path.exists():
        path.unlink()


# ----- Contest Management -----
def normalize_contest(rec: dict) -> dict:
    """Normalize contest record"""
    rec = dict(rec)
    try:
        rec['total_problems'] = max(1, min(15, int(rec.get('total_problems') or 1)))
    except Exception:
        rec['total_problems'] = 1

    probs = rec.get('problems') or []
    out = []
    for i in range(rec['total_problems']):
        base = {'letter': LETTERS[i], 'pass_count': 0, 'attempt_count': 0, 'my_status': 'unsubmitted'}
        if i < len(probs) and isinstance(probs[i], dict):
            d = dict(base)
            d.update({k: probs[i].get(k, v) for k, v in base.items()})
            try:
                d['pass_count'] = int(d.get('pass_count') or 0)
            except Exception:
                d['pass_count'] = 0
            try:
                d['attempt_count'] = int(d.get('attempt_count') or 0)
            except Exception:
                d['attempt_count'] = 0
            if d.get('my_status') not in ('ac','attempted','unsubmitted'):
                d['my_status'] = 'unsubmitted'
            out.append(d)
        else:
            out.append(base)
    rec['problems'] = out
    return rec


def load_contests() -> List[dict]:
    """Load contests from JSON file"""
    with _lock:
        try:
            raw = CONTESTS_FILE.read_text(encoding="utf-8")
        except FileNotFoundError:
            CONTESTS_FILE.write_text("[]", encoding="utf-8")
            raw = "[]"
        try:
            items = json.loads(raw)
        except json.JSONDecodeError:
            backup = CONTESTS_FILE.with_suffix(".backup.json")
            backup.write_text(raw, encoding="utf-8")
            CONTESTS_FILE.write_text("[]", encoding="utf-8")
            items = []
    return [normalize_contest(it) for it in items]


def save_contests(items: List[dict]) -> None:
    """Save contests to JSON file"""
    with _lock:
        CONTESTS_FILE.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")


def create_contest(data: dict) -> dict:
    """Create a new contest"""
    items = load_contests()
    now = datetime.now(timezone.utc).isoformat()

    rec = {
        'id': str(uuid4()),
        'created_at': now,
        'updated_at': now,
        **normalize_contest(data)
    }
    items.append(rec)
    save_contests(items)
    return rec


def update_contest(contest_id: str, data: dict) -> Optional[dict]:
    """Update an existing contest"""
    items = load_contests()
    now = datetime.now(timezone.utc).isoformat()

    for i, rec in enumerate(items):
        if rec.get('id') == contest_id:
            rec.update(data)
            rec['updated_at'] = now
            items[i] = normalize_contest(rec)
            save_contests(items)
            return items[i]

    return None


def delete_contest(contest_id: str) -> bool:
    """Delete a contest"""
    items = load_contests()
    original_len = len(items)
    items = [it for it in items if it.get('id') != contest_id]

    if len(items) == original_len:
        return False

    save_contests(items)
    return True
