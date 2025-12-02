/**
 * Git utilities for ACM Compass
 * Handles version control operations for the data repository
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import type { GitConfig } from './types.js';

const BASE_DIR = path.resolve(process.cwd());
const DATA_DIR = path.join(BASE_DIR, 'data');
const GIT_CONFIG_FILE = path.join(BASE_DIR, '.git_config.json');

interface ShellResult {
  returncode: number;
  stdout: string;
  stderr: string;
  cmd: string;
}

function sh(cmd: string, cwd: string = BASE_DIR): ShellResult {
  try {
    const stdout = execSync(cmd, {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { returncode: 0, stdout, stderr: '', cmd };
  } catch (error: unknown) {
    const e = error as { status?: number; stdout?: string; stderr?: string };
    return {
      returncode: e.status || 1,
      stdout: e.stdout || '',
      stderr: e.stderr || '',
      cmd,
    };
  }
}

export function loadGitConfig(): GitConfig {
  if (fs.existsSync(GIT_CONFIG_FILE)) {
    try {
      const data = fs.readFileSync(GIT_CONFIG_FILE, 'utf-8');
      return JSON.parse(data);
    } catch {
      // ignore
    }
  }
  return { repo_url: '', branch: 'main', cloned: false };
}

export function saveGitConfig(repoUrl: string, branch: string = 'main', cloned: boolean = true): void {
  const config: GitConfig = {
    repo_url: repoUrl.trim(),
    branch: branch.trim(),
    cloned,
    last_updated: new Date().toISOString(),
  };
  fs.writeFileSync(GIT_CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

export function isDataGitRepo(): boolean {
  if (!fs.existsSync(DATA_DIR)) return false;

  const dataGitDir = path.join(DATA_DIR, '.git');
  if (!fs.existsSync(dataGitDir)) return false;

  const r = sh('git rev-parse --git-dir', DATA_DIR);
  if (r.returncode !== 0) return false;

  const gitDir = r.stdout.trim();
  if (gitDir === '.git') return true;

  const resolved = path.resolve(DATA_DIR, gitDir);
  return resolved === path.resolve(dataGitDir);
}

export function getRemoteUrl(): string | null {
  if (!isDataGitRepo()) return null;
  const r = sh('git remote get-url origin', DATA_DIR);
  return r.returncode === 0 ? r.stdout.trim() : null;
}

export function getCurrentBranch(): string | null {
  if (!isDataGitRepo()) return null;
  const r = sh('git rev-parse --abbrev-ref HEAD', DATA_DIR);
  return r.returncode === 0 ? r.stdout.trim() : null;
}

function backupExistingData(): string {
  if (!fs.existsSync(DATA_DIR)) return '';

  let backupDir = path.join(BASE_DIR, 'data.backup');
  let counter = 1;
  while (fs.existsSync(backupDir)) {
    backupDir = path.join(BASE_DIR, `data.backup.${counter}`);
    counter++;
  }

  fs.renameSync(DATA_DIR, backupDir);
  return `✓ 已将现有 data/ 备份到 ${path.basename(backupDir)}\n`;
}

export function cloneDataRepo(repoUrl: string, branch: string = 'main'): string {
  let output = '';

  if (!repoUrl || !repoUrl.trim()) {
    return '❌ 请提供有效的仓库地址';
  }

  if (fs.existsSync(DATA_DIR)) {
    if (isDataGitRepo()) {
      const currentRemote = getRemoteUrl();
      if (currentRemote === repoUrl.trim()) {
        output += `ℹ️  data/ 已经是该仓库的克隆\n`;
        output += `🔗 远程地址: ${currentRemote}\n`;
        saveGitConfig(repoUrl, branch, true);
        return output;
      } else {
        output += '⚠️  data/ 已存在且连接到不同的远程仓库\n';
        output += `当前远程: ${currentRemote}\n`;
        output += `请求远程: ${repoUrl}\n\n`;
        output += '请选择：\n';
        output += '1. 手动删除 data/ 目录后重试\n';
        output += '2. 或使用「备份并重新克隆」功能\n';
        return output;
      }
    } else {
      const parentCheck = sh('git rev-parse --is-inside-work-tree', DATA_DIR);
      if (parentCheck.returncode === 0 && parentCheck.stdout.trim() === 'true') {
        output += '⚠️  data/ 目录被父仓库跟踪，需要备份后克隆独立仓库\n';
      } else {
        output += '⚠️  data/ 目录已存在但不是 Git 仓库\n';
      }
      output += backupExistingData();
    }
  }

  output += '=== 克隆远程仓库 ===\n';
  output += `仓库地址: ${repoUrl}\n`;
  output += `分支: ${branch}\n\n`;

  let result = sh(`git clone --branch "${branch}" "${repoUrl}" data`, BASE_DIR);

  if (result.returncode !== 0) {
    output += '尝试默认分支克隆...\n';
    result = sh(`git clone "${repoUrl}" data`, BASE_DIR);

    if (result.returncode !== 0) {
      output += `stderr: ${result.stderr}\n`;
      output += '\n❌ 克隆失败\n';
      output += '请检查：\n';
      output += '1. 仓库地址是否正确\n';
      output += '2. 是否有访问权限\n';
      output += '3. 网络连接是否正常\n';
      return output;
    }
  }

  output += result.stdout;
  output += '\n✓ 成功克隆远程仓库到 data/ 目录\n';

  saveGitConfig(repoUrl, branch, true);
  output += '✓ 配置已保存\n';

  return output;
}

export function gitPull(repoUrl: string, branch: string = 'main'): string {
  let output = '';

  if (!isDataGitRepo()) {
    return '⚠️  data/ 不是 Git 仓库，请先使用「克隆 Data 仓库」';
  }

  output += `=== git pull origin ${branch} ===\n`;
  const result = sh(`git pull origin "${branch}"`, DATA_DIR);
  output += `Return code: ${result.returncode}\n\n`;
  output += result.stdout;

  if (result.stderr) {
    output += `\n${result.stderr}`;
  }

  if (result.returncode === 0) {
    output += '\n✓ 成功拉取远程更新';
  } else {
    output += '\n❌ 拉取失败';
  }

  return output;
}

export function gitPush(repoUrl: string, message?: string, branch: string = 'main'): string {
  let output = '';

  if (!isDataGitRepo()) {
    return '⚠️  data/ 不是 Git 仓库，请先使用「克隆 Data 仓库」';
  }

  if (!message || !message.trim()) {
    message = `update data (${new Date().toISOString().slice(0, 19).replace('T', ' ')})`;
  }

  // git add
  output += '=== git add -A ===\n';
  let result = sh('git add -A', DATA_DIR);
  if (result.returncode !== 0) {
    output += `stderr: ${result.stderr}\n`;
    output += '\n❌ git add 失败';
    return output;
  }

  // Check for changes
  const diff = sh('git diff --cached --name-only', DATA_DIR);
  if (!diff.stdout.trim()) {
    return 'ℹ️ 没有需要提交的更改';
  }

  output += `Changed files:\n${diff.stdout}\n`;

  // git commit
  output += '\n=== git commit ===\n';
  const msgEscaped = message.replace(/"/g, '\\"');
  result = sh(`git commit -m "${msgEscaped}"`, DATA_DIR);
  output += result.stdout;
  if (result.returncode !== 0) {
    output += `\nstderr: ${result.stderr}`;
    output += '\n❌ git commit 失败';
    return output;
  }

  // git push
  output += `\n=== git push origin ${branch} ===\n`;
  result = sh(`git push origin "${branch}"`, DATA_DIR);
  output += result.stdout;

  if (result.returncode === 0) {
    output += '\n✓ 成功推送到远程';
  } else {
    output += `\n尝试: git push -u origin ${branch}\n`;
    result = sh(`git push -u origin "${branch}"`, DATA_DIR);
    output += result.stdout;

    if (result.returncode === 0) {
      output += '\n✓ 成功推送到远程（设置上游分支）';
    } else {
      if (result.stderr) {
        output += `\nstderr: ${result.stderr}`;
      }
      output += '\n❌ 推送失败';
    }
  }

  return output;
}

export function getRepoStatus(): string {
  if (!fs.existsSync(DATA_DIR)) {
    return '📂 data/ 目录不存在\n\n请先克隆远程仓库';
  }

  if (!isDataGitRepo()) {
    const parentCheck = sh('git rev-parse --is-inside-work-tree', DATA_DIR);
    if (parentCheck.returncode === 0 && parentCheck.stdout.trim() === 'true') {
      return (
        '⚠️ data/ 目录被父仓库跟踪\n\n' +
        'data/ 目录没有独立的 .git，它可能是父项目的一部分。\n' +
        '请使用「克隆 Data 仓库」功能来克隆独立的数据仓库。\n\n' +
        '注意：克隆前会自动备份现有的 data/ 目录。'
      );
    }
    return '📂 data/ 目录存在但不是 Git 仓库\n\n请使用「克隆 Data 仓库」功能';
  }

  let output = '📂 Data 仓库状态\n\n';

  const branch = getCurrentBranch();
  if (branch) {
    output += `🌿 当前分支: ${branch}\n`;
  }

  const remote = getRemoteUrl();
  if (remote) {
    output += `🔗 远程仓库: ${remote}\n`;
  } else {
    output += '🔗 远程仓库: 未配置\n';
  }

  const status = sh('git status --short', DATA_DIR);
  if (status.stdout.trim()) {
    output += `\n📝 未提交的更改:\n${status.stdout}`;
  } else {
    output += '\n✅ 工作目录干净';
  }

  const lastCommit = sh('git log -1 --oneline', DATA_DIR);
  if (lastCommit.returncode === 0 && lastCommit.stdout) {
    output += `\n\n📌 最新提交:\n${lastCommit.stdout.trim()}`;
  }

  return output;
}

export function backupAndReclone(repoUrl: string, branch: string = 'main'): string {
  let output = '=== 备份并重新克隆 ===\n\n';

  if (fs.existsSync(DATA_DIR)) {
    output += backupExistingData();
  }

  output += '\n';
  output += cloneDataRepo(repoUrl, branch);

  return output;
}
