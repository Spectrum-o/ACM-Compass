"""
Git utilities for ACM Compass
Handles version control operations by cloning a separate data repository
"""
import json
import shutil
from pathlib import Path
from subprocess import run as _run, PIPE
from datetime import datetime
from typing import Optional

from .data_manager import BASE_DIR

# Data directory is now a cloned git repository
DATA_DIR = BASE_DIR / "data"

# Git configuration cache file
GIT_CONFIG_FILE = BASE_DIR / ".git_config.json"


def _sh(cmd: str, cwd: Path = BASE_DIR) -> dict:
    """Execute shell command and return result"""
    p = _run(cmd, shell=True, cwd=str(cwd), stdout=PIPE, stderr=PIPE, text=True)
    return {
        "returncode": p.returncode,
        "stdout": p.stdout,
        "stderr": p.stderr,
        "cmd": cmd
    }


def load_git_config() -> dict:
    """Load git configuration from cache file"""
    if GIT_CONFIG_FILE.exists():
        try:
            data = json.loads(GIT_CONFIG_FILE.read_text(encoding="utf-8"))
            return data
        except Exception:
            pass
    return {"repo_url": "", "branch": "main", "cloned": False}


def save_git_config(repo_url: str, branch: str = "main", cloned: bool = True) -> None:
    """Save git configuration to cache file"""
    config = {
        "repo_url": repo_url.strip(),
        "branch": branch.strip(),
        "cloned": cloned,
        "last_updated": datetime.now().isoformat()
    }
    GIT_CONFIG_FILE.write_text(json.dumps(config, ensure_ascii=False, indent=2), encoding="utf-8")


def is_data_git_repo() -> bool:
    """Check if data directory is an independent git repository (not parent repo)

    Important: We must verify that data/ has its own .git directory,
    not just that it's inside a parent git repository.
    """
    if not DATA_DIR.exists():
        return False

    # Check if data/ has its own .git directory (independent repo)
    data_git_dir = DATA_DIR / ".git"
    if not data_git_dir.exists():
        return False

    # Verify it's a valid git repository
    r = _sh("git rev-parse --git-dir", cwd=DATA_DIR)
    if r["returncode"] != 0:
        return False

    # The git-dir should be ".git" (relative) for an independent repo in data/
    # If it returns something like "../.git" or an absolute path outside data/,
    # then data/ is not an independent repo
    git_dir = r["stdout"].strip()
    if git_dir == ".git":
        return True

    # Check if git_dir resolves to data/.git
    resolved = (DATA_DIR / git_dir).resolve()
    return resolved == data_git_dir.resolve()


def get_remote_url() -> Optional[str]:
    """Get the remote URL of data repository"""
    if not is_data_git_repo():
        return None
    r = _sh("git remote get-url origin", cwd=DATA_DIR)
    if r["returncode"] == 0:
        return r["stdout"].strip()
    return None


def get_current_branch() -> Optional[str]:
    """Get current git branch name in data directory"""
    if not is_data_git_repo():
        return None
    r = _sh("git rev-parse --abbrev-ref HEAD", cwd=DATA_DIR)
    return r["stdout"].strip() if r["returncode"] == 0 else None


def backup_existing_data() -> str:
    """Backup existing data directory"""
    if not DATA_DIR.exists():
        return ""

    # Find a unique backup name
    backup_base = BASE_DIR / "data.backup"
    backup_dir = backup_base
    counter = 1
    while backup_dir.exists():
        backup_dir = BASE_DIR / f"data.backup.{counter}"
        counter += 1

    # Move existing data to backup
    shutil.move(str(DATA_DIR), str(backup_dir))
    return f"✓ 已将现有 data/ 备份到 {backup_dir.name}\n"


def clone_data_repo(repo_url: str, branch: str = "main") -> str:
    """Clone remote repository as data directory"""
    output = ""

    # Validate repo URL
    if not repo_url or not repo_url.strip():
        return "❌ 请提供有效的仓库地址"

    # Check if data directory already exists
    if DATA_DIR.exists():
        if is_data_git_repo():
            # Already an independent git repo, check if it's the same remote
            current_remote = get_remote_url()
            if current_remote == repo_url.strip():
                output += f"ℹ️  data/ 已经是该仓库的克隆\n"
                output += f"🔗 远程地址: {current_remote}\n"
                save_git_config(repo_url, branch, True)
                return output
            else:
                output += "⚠️  data/ 已存在且连接到不同的远程仓库\n"
                output += f"当前远程: {current_remote}\n"
                output += f"请求远程: {repo_url}\n\n"
                output += "请选择：\n"
                output += "1. 手动删除 data/ 目录后重试\n"
                output += "2. 或使用下面的「备份并重新克隆」功能\n"
                return output
        else:
            # Directory exists but not an independent git repo
            # Check if it's tracked by parent repo
            parent_check = _sh("git rev-parse --is-inside-work-tree", cwd=DATA_DIR)
            if parent_check["returncode"] == 0 and parent_check["stdout"].strip() == "true":
                output += "⚠️  data/ 目录被父仓库跟踪，需要备份后克隆独立仓库\n"
            else:
                output += "⚠️  data/ 目录已存在但不是 Git 仓库\n"
            output += backup_existing_data()

    # Clone the repository
    output += f"=== 克隆远程仓库 ===\n"
    output += f"仓库地址: {repo_url}\n"
    output += f"分支: {branch}\n\n"

    # Clone with specific branch
    result = _sh(f'git clone --branch "{branch}" "{repo_url}" data', cwd=BASE_DIR)

    if result['returncode'] != 0:
        # Try without branch specification (might be first clone)
        output += "尝试默认分支克隆...\n"
        result = _sh(f'git clone "{repo_url}" data', cwd=BASE_DIR)

        if result['returncode'] != 0:
            output += f"stderr: {result['stderr']}\n"
            output += "\n❌ 克隆失败\n"
            output += "请检查：\n"
            output += "1. 仓库地址是否正确\n"
            output += "2. 是否有访问权限\n"
            output += "3. 网络连接是否正常\n"
            return output

    output += result['stdout']
    output += "\n✓ 成功克隆远程仓库到 data/ 目录\n"

    # Save configuration
    save_git_config(repo_url, branch, True)
    output += "✓ 配置已保存\n"

    return output


def ensure_data_repo(repo_url: str, branch: str = "main") -> tuple:
    """Ensure data directory is a cloned repository. Returns (success, message)"""
    # Check if already cloned as independent repo
    if is_data_git_repo():
        current_remote = get_remote_url()
        if current_remote == repo_url.strip():
            return True, ""
        else:
            return False, f"⚠️  data/ 连接到不同的仓库: {current_remote}"

    # Need to clone
    if DATA_DIR.exists():
        # Check if tracked by parent repo
        parent_check = _sh("git rev-parse --is-inside-work-tree", cwd=DATA_DIR)
        if parent_check["returncode"] == 0 and parent_check["stdout"].strip() == "true":
            return False, "⚠️  data/ 被父仓库跟踪，请先使用「克隆 Data 仓库」创建独立仓库"
        return False, "⚠️  data/ 存在但不是 Git 仓库，请先使用「克隆 Data 仓库」"

    return False, "⚠️  data/ 不存在，请先使用「克隆 Data 仓库」"


def git_pull(repo_url: str, branch: str = "main") -> str:
    """Execute git pull in data directory"""
    output = ""

    # Ensure repository is cloned
    success, msg = ensure_data_repo(repo_url, branch)
    if not success:
        output += msg + "\n"
        return output

    # Pull from remote
    output += f"=== git pull origin {branch} ===\n"
    # Use quotes to protect branch name from shell interpretation
    result = _sh(f'git pull origin "{branch}"', cwd=DATA_DIR)
    output += f"Return code: {result['returncode']}\n\n"
    output += result['stdout']

    if result['stderr']:
        output += f"\n{result['stderr']}"

    if result['returncode'] == 0:
        output += "\n✓ 成功拉取远程更新"
    else:
        output += "\n❌ 拉取失败"

    return output


def git_push(repo_url: str, message: Optional[str] = None, branch: str = "main") -> str:
    """Execute git add, commit, and push in data directory"""
    output = ""

    # Ensure repository is cloned
    success, msg = ensure_data_repo(repo_url, branch)
    if not success:
        output += msg + "\n"
        return output

    if not message or not message.strip():
        message = f"update data ({datetime.now().strftime('%Y-%m-%d %H:%M:%S')})"

    # git add
    output += "=== git add -A ===\n"
    result = _sh("git add -A", cwd=DATA_DIR)
    if result['returncode'] != 0:
        output += f"stderr: {result['stderr']}\n"
        output += "\n❌ git add 失败"
        return output

    # Check if there are changes
    diff = _sh("git diff --cached --name-only", cwd=DATA_DIR)
    if not diff['stdout'].strip():
        return "ℹ️ 没有需要提交的更改"

    output += f"Changed files:\n{diff['stdout']}\n"

    # git commit
    output += "\n=== git commit ===\n"
    msg_escaped = message.replace('"', '\\"')
    result = _sh(f'git commit -m "{msg_escaped}"', cwd=DATA_DIR)
    output += result['stdout']
    if result['returncode'] != 0:
        output += f"\nstderr: {result['stderr']}"
        output += "\n❌ git commit 失败"
        return output

    # git push
    output += f"\n=== git push origin {branch} ===\n"
    result = _sh(f'git push origin "{branch}"', cwd=DATA_DIR)
    output += result['stdout']

    if result['returncode'] == 0:
        output += "\n✓ 成功推送到远程"
    else:
        # Try with upstream
        output += f"\n尝试: git push -u origin {branch}\n"
        result = _sh(f'git push -u origin "{branch}"', cwd=DATA_DIR)
        output += result['stdout']

        if result['returncode'] == 0:
            output += "\n✓ 成功推送到远程（设置上游分支）"
        else:
            if result['stderr']:
                output += f"\nstderr: {result['stderr']}"
            output += "\n❌ 推送失败"

    return output


def get_repo_status() -> str:
    """Get current repository status information"""
    if not DATA_DIR.exists():
        return "📂 data/ 目录不存在\n\n请先克隆远程仓库"

    if not is_data_git_repo():
        # Check if data/ is tracked by parent repo
        parent_check = _sh("git rev-parse --is-inside-work-tree", cwd=DATA_DIR)
        if parent_check["returncode"] == 0 and parent_check["stdout"].strip() == "true":
            return ("⚠️ data/ 目录被父仓库跟踪\n\n"
                    "data/ 目录没有独立的 .git，它可能是父项目的一部分。\n"
                    "请使用「克隆 Data 仓库」功能来克隆独立的数据仓库。\n\n"
                    "注意：克隆前会自动备份现有的 data/ 目录。")
        return "📂 data/ 目录存在但不是 Git 仓库\n\n请使用「克隆 Data 仓库」功能"

    output = "📂 Data 仓库状态\n\n"

    # Get current branch
    branch = get_current_branch()
    if branch:
        output += f"🌿 当前分支: {branch}\n"

    # Get remote URL
    remote = get_remote_url()
    if remote:
        output += f"🔗 远程仓库: {remote}\n"
    else:
        output += "🔗 远程仓库: 未配置\n"

    # Get status
    status = _sh("git status --short", cwd=DATA_DIR)
    if status['stdout'].strip():
        output += f"\n📝 未提交的更改:\n{status['stdout']}"
    else:
        output += "\n✅ 工作目录干净"

    # Get last commit
    last_commit = _sh("git log -1 --oneline", cwd=DATA_DIR)
    if last_commit['returncode'] == 0 and last_commit['stdout']:
        output += f"\n\n📌 最新提交:\n{last_commit['stdout'].strip()}"

    return output


def backup_and_reclone(repo_url: str, branch: str = "main") -> str:
    """Backup existing data directory and clone fresh repository"""
    output = "=== 备份并重新克隆 ===\n\n"

    # Backup existing directory
    if DATA_DIR.exists():
        output += backup_existing_data()

    # Clone repository
    output += "\n"
    output += clone_data_repo(repo_url, branch)

    return output
