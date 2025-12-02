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
import type { ProblemInput, ContestInput, ContestProblem } from './types.js';

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

// 存储待导入的比赛数据
let pendingImportData: ImportContestBody | null = null;

app.post('/api/import_contest', asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as ImportContestBody;
  let contestData: ImportContestBody;

  if (body.data && Array.isArray(body.data) && body.data.length > 0) {
    contestData = body.data[0];
  } else {
    contestData = body;
  }

  // 存储待导入数据
  pendingImportData = contestData;

  res.json({
    data: [{
      success: true,
      message: `✓ 已提取比赛数据，请检查后点击保存`,
      ...contestData,
    }],
  });
}));

// 获取待导入的比赛数据
app.get('/api/pending_import', asyncHandler(async (_req: Request, res: Response) => {
  if (pendingImportData) {
    const data = pendingImportData;
    pendingImportData = null; // 获取后清空
    res.json({ data });
  } else {
    res.json({ data: null });
  }
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
