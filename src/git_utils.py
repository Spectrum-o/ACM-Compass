"""
Git utilities for ACM Compass
Handles version control operations
"""
from pathlib import Path
from subprocess import run as _run, PIPE
from datetime import datetime
from typing import Optional

from .data_manager import BASE_DIR


def _sh(cmd: str, cwd: Path = BASE_DIR) -> dict:
    """Execute shell command and return result"""
    p = _run(cmd, shell=True, cwd=str(cwd), stdout=PIPE, stderr=PIPE, text=True)
    return {
        "returncode": p.returncode,
        "stdout": p.stdout,
        "stderr": p.stderr,
        "cmd": cmd
    }


def is_git_repo() -> bool:
    """Check if current directory is a git repository"""
    r = _sh("git rev-parse --is-inside-work-tree")
    return r["returncode"] == 0 and r["stdout"].strip() == "true"


def get_current_branch() -> Optional[str]:
    """Get current git branch name"""
    r = _sh("git rev-parse --abbrev-ref HEAD")
    return r["stdout"].strip() if r["returncode"] == 0 else None


def git_pull(remote: str = "origin", branch: str = "main") -> str:
    """Execute git pull and return formatted output"""
    if not is_git_repo():
        return "❌ 当前目录不是 git 仓库\n请先在项目根目录 git init 并设置远程"

    result = _sh(f"git pull {remote} {branch}")
    output = f"=== git pull {remote} {branch} ===\n"
    output += f"Return code: {result['returncode']}\n\n"
    output += f"stdout:\n{result['stdout']}\n\n"
    output += f"stderr:\n{result['stderr']}\n"

    if result['returncode'] == 0:
        output += "\n✓ 成功拉取远程更新"
    else:
        output += "\n❌ 拉取失败"

    return output


def git_push(message: Optional[str] = None) -> str:
    """Execute git add, commit, and push. Return formatted output"""
    if not is_git_repo():
        return "❌ 当前目录不是 git 仓库\n请先在项目根目录 git init 并设置远程"

    if not message or not message.strip():
        message = f"update data ({datetime.now().strftime('%Y-%m-%d %H:%M:%S')})"

    output = ""

    # git add
    output += "=== git add -A ===\n"
    result = _sh("git add -A")
    output += f"Return code: {result['returncode']}\n"
    if result['returncode'] != 0:
        output += f"stderr: {result['stderr']}\n"
        output += "\n❌ git add 失败"
        return output

    # Check if there are changes
    diff = _sh("git diff --cached --name-only")
    if not diff['stdout'].strip():
        return "ℹ️ 没有需要提交的更改"

    output += f"\nChanged files:\n{diff['stdout']}\n"

    # git commit
    output += "\n=== git commit ===\n"
    msg_escaped = message.replace('"', '\\"')
    result = _sh(f'git commit -m "{msg_escaped}"')
    output += f"Return code: {result['returncode']}\n"
    output += f"stdout: {result['stdout']}\n"
    if result['returncode'] != 0:
        output += f"stderr: {result['stderr']}\n"
        output += "\n❌ git commit 失败"
        return output

    # git push
    output += "\n=== git push ===\n"
    result = _sh("git push")
    output += f"Return code: {result['returncode']}\n"
    output += f"stdout: {result['stdout']}\n"

    if result['returncode'] == 0:
        output += "\n✓ 成功推送到远程"
        return output

    # Try with upstream
    branch = get_current_branch() or "main"
    output += f"\nTrying: git push -u origin {branch}\n"
    result = _sh(f"git push -u origin {branch}")
    output += f"Return code: {result['returncode']}\n"
    output += f"stdout: {result['stdout']}\n"
    output += f"stderr: {result['stderr']}\n"

    if result['returncode'] == 0:
        output += "\n✓ 成功推送到远程（设置上游分支）"
    else:
        output += "\n❌ 推送失败"

    return output
