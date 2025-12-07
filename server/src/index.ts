/**
 * ACM Compass - Express Server
 * TypeScript backend for the React frontend
 */
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import {
  filterProblems,
  loadProblems,
  createProblem,
  updateProblem,
  deleteProblem,
  readSolution,
  writeSolution,
  deleteSolution,
  filterContests,
  loadContests,
  createContest,
  updateContest,
  deleteContest,
} from './data.js';
import {
  loadGitConfig,
  getRepoStatus,
  cloneDataRepo,
  gitPull,
  gitPush,
  backupAndReclone,
} from './git.js';
import type { ProblemInput, ContestInput, ContestProblem, UnsolvedStage } from './types.js';

const app = express();
const PORT = 7860;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from web/dist in production only
const webDistPath = path.join(process.cwd(), '..', 'web', 'dist');
if (fs.existsSync(webDistPath)) {
  app.use(express.static(webDistPath));
}

// Error handler wrapper
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// Print banner
function printBanner(): void {
  // ANSI color codes
  const CYAN = "\x1b[96m";
  const BLUE = "\x1b[94m";
  const MAGENTA = "\x1b[95m";
  const YELLOW = "\x1b[93m";
  const RESET = "\x1b[0m";
  const BOLD = "\x1b[1m";
  const DIM = "\x1b[2m";

  const banner = `
${DIM}${BLUE}                                                                          ${RESET}
${BOLD}${CYAN}     █████╗  ██████╗███╗   ███╗       ${MAGENTA} ██████╗ ██████╗ ███╗   ███╗██████╗  █████╗ ███████╗███████╗${RESET}
${BOLD}${CYAN}    ██╔══██╗██╔════╝████╗ ████║       ${MAGENTA}██╔════╝██╔═══██╗████╗ ████║██╔══██╗██╔══██╗██╔════╝██╔════╝${RESET}
${BOLD}${CYAN}    ███████║██║     ██╔████╔██║${YELLOW} █████╗${MAGENTA}██║     ██║   ██║██╔████╔██║██████╔╝███████║███████╗███████╗${RESET}
${BOLD}${CYAN}    ██╔══██║██║     ██║╚██╔╝██║${YELLOW} ╚════╝${MAGENTA}██║     ██║   ██║██║╚██╔╝██║██╔═══╝ ██╔══██║╚════██║╚════██║${RESET}
${BOLD}${CYAN}    ██║  ██║╚██████╗██║ ╚═╝ ██║       ${MAGENTA}╚██████╗╚██████╔╝██║ ╚═╝ ██║██║     ██║  ██║███████║███████║${RESET}
${BOLD}${CYAN}    ╚═╝  ╚═╝ ╚═════╝╚═╝     ╚═╝       ${MAGENTA} ╚═════╝ ╚═════╝ ╚═╝     ╚═╝╚═╝     ╚═╝  ╚═╝╚══════╝╚══════╝${RESET}
${DIM}${BLUE}                                                                          ${RESET}
${DIM}    ─────────────────────────────────────────────────────────────────────────────────${RESET}
${YELLOW}                    🧭 题目与比赛追踪系统 | Problem & Contest Tracker${RESET}
${DIM}    ─────────────────────────────────────────────────────────────────────────────────${RESET}
`;
  console.log(banner);
  console.log(`${CYAN}🚀 服务器启动: ${BOLD}http://127.0.0.1:${PORT}${RESET}`);
  console.log(`${BLUE}📂 数据目录: ./data${RESET}`);
  console.log(`${MAGENTA}📖 浏览器助手: ./bookmarklet.html${RESET}\n`);
}

// ----- Problem Routes -----

app.get('/api/problems', asyncHandler(async (req: Request, res: Response) => {
  const filter = req.query.filter as 'all' | 'solved' | 'unsolved' | undefined;
  const startDate = req.query.start_date as string | undefined;
  const endDate = req.query.end_date as string | undefined;
  const problems = filterProblems(filter, startDate, endDate);
  res.json(problems);
}));

app.get('/api/problems/:id', asyncHandler(async (req: Request, res: Response) => {
  const problems = loadProblems();
  const problem = problems.find((p) => p.id === req.params.id);
  if (!problem) {
    res.status(404).json({ error: 'Problem not found' });
    return;
  }
  res.json(problem);
}));

app.post('/api/problems', asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as ProblemInput;
  const problem = createProblem(data);
  res.status(201).json(problem);
}));

app.put('/api/problems/:id', asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as Partial<ProblemInput>;
  const problem = updateProblem(req.params.id, data);
  if (!problem) {
    res.status(404).json({ error: 'Problem not found' });
    return;
  }
  res.json(problem);
}));

app.delete('/api/problems/:id', asyncHandler(async (req: Request, res: Response) => {
  const success = deleteProblem(req.params.id);
  if (!success) {
    res.status(404).json({ error: 'Problem not found' });
    return;
  }
  res.status(204).send();
}));

// Solution routes
app.get('/api/problems/:id/solution', asyncHandler(async (req: Request, res: Response) => {
  const content = readSolution(req.params.id);
  res.json({ content });
}));

app.put('/api/problems/:id/solution', asyncHandler(async (req: Request, res: Response) => {
  const { content } = req.body as { content: string };
  writeSolution(req.params.id, content);
  res.json({ success: true });
}));

app.delete('/api/problems/:id/solution', asyncHandler(async (req: Request, res: Response) => {
  deleteSolution(req.params.id);
  res.status(204).send();
}));

// ----- Contest Routes -----

app.get('/api/contests', asyncHandler(async (req: Request, res: Response) => {
  const startDate = req.query.start_date as string | undefined;
  const endDate = req.query.end_date as string | undefined;
  const contests = filterContests(startDate, endDate);
  res.json(contests);
}));

app.get('/api/contests/:id', asyncHandler(async (req: Request, res: Response) => {
  const contests = loadContests();
  const contest = contests.find((c) => c.id === req.params.id);
  if (!contest) {
    res.status(404).json({ error: 'Contest not found' });
    return;
  }
  res.json(contest);
}));

app.post('/api/contests', asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as ContestInput;
  const contest = createContest(data);
  res.status(201).json(contest);
}));

app.put('/api/contests/:id', asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as Partial<ContestInput>;
  const contest = updateContest(req.params.id, data);
  if (!contest) {
    res.status(404).json({ error: 'Contest not found' });
    return;
  }
  res.json(contest);
}));

app.delete('/api/contests/:id', asyncHandler(async (req: Request, res: Response) => {
  const success = deleteContest(req.params.id);
  if (!success) {
    res.status(404).json({ error: 'Contest not found' });
    return;
  }
  res.status(204).send();
}));

// Import contest from bookmarklet
interface ImportContestBody {
  data?: Array<{
    name: string;
    total_problems: number;
    problems: ContestProblem[];
    user_rank?: string | null;
  }>;
  name?: string;
  total_problems?: number;
  problems?: ContestProblem[];
  user_rank?: string | null;
}

// 存储待导入的比赛数据（不在获取时清空，改为确认导入时清空）
let pendingContestData: ImportContestBody | null = null;

// 存储待导入的题目数据（用于 Dashboard + Standings 两步导入）
interface PendingProblemsData {
  contestId: string;
  source: string;
  problems: Array<{
    letter: string;
    title: string;
    link: string | null;
    source: string;
    tags: string[];
    solved: boolean;
    unsolved_stage: UnsolvedStage | null;
    unsolved_custom_label: string | null;
    pass_count: number | null;
    attempt_count: number | null;
    notes: string | null;
  }>;
}
let pendingProblemsData: PendingProblemsData | null = null;

// 缓存 Dashboard 提取的题目信息
app.post('/api/import_problems', asyncHandler(async (req: Request, res: Response) => {
  const { contestId, source, problems } = req.body as PendingProblemsData;

  if (!contestId || !problems || problems.length === 0) {
    res.status(400).json({ success: false, message: '缺少比赛 ID 或题目数据' });
    return;
  }

  // 缓存数据
  pendingProblemsData = { contestId, source, problems };

  console.log(`📥 缓存题目数据: 比赛 ID=${contestId}, ${problems.length} 道题目`);

  res.json({
    success: true,
    message: `已缓存 ${problems.length} 道题目，请跳转到 Standings 页面继续`,
    contestId,
    problemCount: problems.length,
  });
}));

// 接收 Standings 统计信息并与缓存合并
app.post('/api/import_standings', asyncHandler(async (req: Request, res: Response) => {
  const { contestId, stats } = req.body as {
    contestId: string;
    stats: Record<string, { pass_count: number; attempt_count: number }>;
  };

  if (!contestId) {
    res.status(400).json({ success: false, message: '缺少比赛 ID' });
    return;
  }

  // 检查是否有缓存的题目数据
  if (!pendingProblemsData) {
    res.status(400).json({
      success: false,
      message: '未找到缓存的题目数据，请先在 Dashboard 页面提取题目',
    });
    return;
  }

  // 检查比赛 ID 是否一致
  if (pendingProblemsData.contestId !== contestId) {
    res.status(400).json({
      success: false,
      message: `比赛 ID 不匹配！缓存的是 ${pendingProblemsData.contestId}，当前是 ${contestId}`,
    });
    return;
  }

  // 合并统计信息
  let mergedCount = 0;
  pendingProblemsData.problems.forEach((problem) => {
    const stat = stats[problem.letter];
    if (stat) {
      problem.pass_count = stat.pass_count;
      problem.attempt_count = stat.attempt_count;
      mergedCount++;
    }
  });

  console.log(`📊 合并统计信息: ${mergedCount}/${pendingProblemsData.problems.length} 道题目`);

  res.json({
    success: true,
    message: `已合并 ${mergedCount} 道题目的统计信息，请点击「导入数据」完成导入`,
    contestId,
    mergedCount,
    totalCount: pendingProblemsData.problems.length,
  });
}));

// 获取待导入的题目数据
app.get('/api/pending_problems', asyncHandler(async (_req: Request, res: Response) => {
  if (pendingProblemsData) {
    res.json({ data: pendingProblemsData });
  } else {
    res.json({ data: null });
  }
}));

// 确认导入题目数据
app.post('/api/confirm_import_problems', asyncHandler(async (_req: Request, res: Response) => {
  if (!pendingProblemsData) {
    res.status(400).json({ success: false, message: '没有待导入的题目数据' });
    return;
  }

  const { problems, source } = pendingProblemsData;
  let successCount = 0;
  let failCount = 0;

  for (const problem of problems) {
    try {
      createProblem(problem);
      successCount++;
    } catch (error) {
      console.error(`导入题目失败: ${problem.title}`, error);
      failCount++;
    }
  }

  // 清空缓存
  const result = {
    success: true,
    message: `导入完成：成功 ${successCount}，失败 ${failCount}`,
    source,
    successCount,
    failCount,
  };

  pendingProblemsData = null;

  console.log(`✅ 题目导入完成: 成功 ${successCount}, 失败 ${failCount}`);

  res.json(result);
}));

// 清除待导入的题目数据
app.delete('/api/pending_problems', asyncHandler(async (_req: Request, res: Response) => {
  pendingProblemsData = null;
  res.json({ success: true, message: '已清除缓存的题目数据' });
}));

app.post('/api/import_contest', asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as ImportContestBody;
  let contestData: ImportContestBody;

  if (body.data && Array.isArray(body.data) && body.data.length > 0) {
    contestData = body.data[0];
  } else {
    contestData = body;
  }

  // 存储待导入数据（不立即保存）
  pendingContestData = contestData;

  console.log(`📥 缓存比赛数据: ${contestData.name}, ${contestData.total_problems} 道题目`);

  res.json({
    data: [{
      success: true,
      message: `✓ 已提取比赛数据，请检查后点击保存`,
      ...contestData,
    }],
  });
}));

// 获取待导入的比赛数据（不清空缓存）
app.get('/api/pending_import', asyncHandler(async (_req: Request, res: Response) => {
  if (pendingContestData) {
    res.json({ data: pendingContestData });
  } else {
    res.json({ data: null });
  }
}));

// 确认导入比赛数据（与题目一起导入）
app.post('/api/confirm_import_contest', asyncHandler(async (_req: Request, res: Response) => {
  const results: {
    contest?: { success: boolean; message: string; id?: string };
    problems?: { success: boolean; message: string; successCount?: number; failCount?: number };
  } = {};

  // 构建比赛题目状态映射 (letter -> my_status)
  const contestStatusMap: Record<string, 'ac' | 'attempted' | 'unsubmitted'> = {};
  if (pendingContestData?.problems) {
    for (const p of pendingContestData.problems) {
      contestStatusMap[p.letter] = p.my_status;
    }
  }

  // 1. 导入比赛数据
  if (pendingContestData) {
    try {
      const contestInput: ContestInput = {
        name: pendingContestData.name || '',
        total_problems: pendingContestData.total_problems || 0,
        problems: pendingContestData.problems || [],
        rank_str: pendingContestData.user_rank || null,
        summary: null,
      };
      const contest = createContest(contestInput);
      results.contest = {
        success: true,
        message: `比赛 "${contestInput.name}" 导入成功`,
        id: contest.id,
      };
      console.log(`✅ 比赛导入成功: ${contestInput.name}`);
    } catch (error) {
      results.contest = {
        success: false,
        message: `比赛导入失败: ${error}`,
      };
      console.error('比赛导入失败:', error);
    }
    pendingContestData = null;
  }

  // 2. 导入题目数据，同步比赛中的 my_status 到题目的 solved 状态
  if (pendingProblemsData) {
    const { problems } = pendingProblemsData;
    let successCount = 0;
    let failCount = 0;

    for (const problem of problems) {
      try {
        // 根据比赛中的 my_status 更新题目的 solved 和 unsolved_stage
        const contestStatus = contestStatusMap[problem.letter];
        if (contestStatus === 'ac') {
          // AC 的题目标记为已解决
          problem.solved = true;
          problem.unsolved_stage = null;
        } else if (contestStatus === 'attempted') {
          // 已尝试但未 AC 的题目，设置为"知道做法未实现"
          problem.solved = false;
          problem.unsolved_stage = '知道做法未实现';
        }
        // unsubmitted 保持原状态（未看题）

        createProblem(problem);
        successCount++;
      } catch (error) {
        console.error(`导入题目失败: ${problem.title}`, error);
        failCount++;
      }
    }

    results.problems = {
      success: failCount === 0,
      message: `题目导入完成：成功 ${successCount}，失败 ${failCount}`,
      successCount,
      failCount,
    };

    console.log(`✅ 题目导入完成: 成功 ${successCount}, 失败 ${failCount}`);
    pendingProblemsData = null;
  }

  // 返回结果
  if (!results.contest && !results.problems) {
    res.status(400).json({ success: false, message: '没有待导入的数据' });
    return;
  }

  res.json({
    success: true,
    message: '导入完成',
    results,
  });
}));

// 清除待导入的比赛数据
app.delete('/api/pending_import', asyncHandler(async (_req: Request, res: Response) => {
  pendingContestData = null;
  res.json({ success: true, message: '已清除缓存的比赛数据' });
}));

// ----- Git Routes -----

app.get('/api/git/config', asyncHandler(async (_req: Request, res: Response) => {
  const config = loadGitConfig();
  res.json(config);
}));

app.get('/api/git/status', asyncHandler(async (_req: Request, res: Response) => {
  const status = getRepoStatus();
  res.json({ status });
}));

app.post('/api/git/clone', asyncHandler(async (req: Request, res: Response) => {
  const { repo_url, branch } = req.body as { repo_url: string; branch: string };
  const output = cloneDataRepo(repo_url, branch);
  res.json({ output });
}));

app.post('/api/git/pull', asyncHandler(async (req: Request, res: Response) => {
  const { repo_url, branch } = req.body as { repo_url: string; branch: string };
  const output = gitPull(repo_url, branch);
  res.json({ output });
}));

app.post('/api/git/push', asyncHandler(async (req: Request, res: Response) => {
  const { repo_url, branch, message } = req.body as { repo_url: string; branch: string; message?: string };
  const output = gitPush(repo_url, message, branch);
  res.json({ output });
}));

app.post('/api/git/backup-reclone', asyncHandler(async (req: Request, res: Response) => {
  const { repo_url, branch } = req.body as { repo_url: string; branch: string };
  const output = backupAndReclone(repo_url, branch);
  res.json({ output });
}));

// SPA fallback - serve index.html for all non-API routes (production only)
app.get('*', (_req: Request, res: Response) => {
  const indexPath = path.join(process.cwd(), '..', 'web', 'dist', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({ error: 'Not found. In development mode, access frontend at http://localhost:3000' });
  }
});

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message });
});

// Start server
printBanner();
app.listen(PORT, '127.0.0.1', () => {
  console.log(`✅ Server running at http://127.0.0.1:${PORT}`);
});
