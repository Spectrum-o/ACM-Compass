/**
 * Data management utilities for ACM Compass
 * Handles all file I/O operations for problems, contests, and solutions
 */
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { Problem, ProblemInput, Contest, ContestInput, ContestProblem, UnsolvedStage } from './types.js';
import { LETTERS } from './types.js';

// Paths
const BASE_DIR = path.resolve(process.cwd());
const DATA_DIR = path.join(BASE_DIR, 'data');
const PROBLEMS_FILE = path.join(DATA_DIR, 'problems.json');
const CONTESTS_FILE = path.join(DATA_DIR, 'contests.json');
const SOLUTIONS_DIR = path.join(DATA_DIR, 'solutions');

// Ensure directories and files exist
function ensureDataStructure(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(SOLUTIONS_DIR)) {
    fs.mkdirSync(SOLUTIONS_DIR, { recursive: true });
  }
  if (!fs.existsSync(PROBLEMS_FILE)) {
    fs.writeFileSync(PROBLEMS_FILE, '[]', 'utf-8');
  }
  if (!fs.existsSync(CONTESTS_FILE)) {
    fs.writeFileSync(CONTESTS_FILE, '[]', 'utf-8');
  }
}

ensureDataStructure();

// ----- Problem Management -----

const VALID_UNSOLVED_STAGES: UnsolvedStage[] = ['未看题', '已看题无思路', '知道做法未实现'];

function normalizeRecord(rec: Record<string, unknown>): Record<string, unknown> {
  const result = { ...rec };
  delete result.has_solution;

  const owner = result.owner;
  delete result.owner;

  if (!('solved' in result)) {
    const status = String(result.status || '').toLowerCase();
    result.solved = status === 'done';
  }

  if (!('unsolved_stage' in result)) {
    result.unsolved_stage = null;
  } else {
    const stage = result.unsolved_stage as string;
    if (!VALID_UNSOLVED_STAGES.includes(stage as UnsolvedStage)) {
      result.unsolved_stage = null;
    }
  }

  let customLabel = result.unsolved_custom_label;
  if (customLabel != null) {
    customLabel = String(customLabel).trim() || null;
  }
  result.unsolved_custom_label = result.solved ? null : customLabel;

  if (!('tags' in result) || result.tags == null) {
    result.tags = [];
  }

  if ('pass_count' in result && result.pass_count != null) {
    try {
      result.pass_count = parseInt(String(result.pass_count), 10);
    } catch {
      result.pass_count = null;
    }
  }

  let assignee = result.assignee;
  if (assignee == null && owner) {
    assignee = owner;
  }
  if (assignee != null) {
    assignee = String(assignee).trim() || null;
  }
  result.assignee = assignee;

  if (result.solved) {
    result.unsolved_stage = null;
    result.unsolved_custom_label = null;
  }

  return result;
}

export function loadProblems(): Problem[] {
  try {
    const data = fs.readFileSync(PROBLEMS_FILE, 'utf-8');
    const items = JSON.parse(data) as Record<string, unknown>[];

    return items.map((rec) => {
      const normalized = normalizeRecord(rec) as unknown as Problem;
      normalized.has_solution = solutionExists(normalized.id);
      return normalized;
    });
  } catch {
    fs.writeFileSync(PROBLEMS_FILE, '[]', 'utf-8');
    return [];
  }
}

export function saveProblems(items: Problem[]): void {
  const sanitized = items.map((rec) => {
    const copy = { ...rec } as Record<string, unknown>;
    delete copy.has_solution;
    return copy;
  });
  fs.writeFileSync(PROBLEMS_FILE, JSON.stringify(sanitized, null, 2), 'utf-8');
}

export function createProblem(data: ProblemInput): Problem {
  const items = loadProblems();
  const now = new Date().toISOString();

  const rec: Problem = {
    id: uuidv4(),
    created_at: now,
    updated_at: now,
    ...data,
    has_solution: false,
  };

  items.push(rec);
  saveProblems(items);
  return rec;
}

export function updateProblem(problemId: string, data: Partial<ProblemInput>): Problem | null {
  const items = loadProblems();
  const now = new Date().toISOString();

  const index = items.findIndex((it) => it.id === problemId);
  if (index === -1) return null;

  items[index] = {
    ...items[index],
    ...data,
    updated_at: now,
  };

  saveProblems(items);
  items[index].has_solution = solutionExists(problemId);
  return items[index];
}

export function deleteProblem(problemId: string): boolean {
  const items = loadProblems();
  const originalLen = items.length;
  const filtered = items.filter((it) => it.id !== problemId);

  if (filtered.length === originalLen) return false;

  saveProblems(filtered);
  deleteSolution(problemId);
  return true;
}

export function filterProblems(
  filter?: 'all' | 'solved' | 'unsolved',
  startDate?: string,
  endDate?: string
): Problem[] {
  let items = loadProblems();

  // Filter by status
  if (filter === 'solved') {
    items = items.filter((it) => it.solved);
  } else if (filter === 'unsolved') {
    items = items.filter((it) => !it.solved);
  }

  // Filter by date range
  if (startDate || endDate) {
    items = items.filter((it) => {
      if (!it.created_at) return false;
      const itemDate = new Date(it.created_at);
      if (startDate && itemDate < new Date(startDate)) return false;
      if (endDate && itemDate > new Date(endDate + 'T23:59:59')) return false;
      return true;
    });
  }

  return items;
}

// ----- Solution Management -----

function solutionPath(problemId: string): string {
  return path.join(SOLUTIONS_DIR, `${problemId}.md`);
}

export function solutionExists(problemId: string): boolean {
  return fs.existsSync(solutionPath(problemId));
}

export function readSolution(problemId: string): string | null {
  const p = solutionPath(problemId);
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p, 'utf-8');
}

export function writeSolution(problemId: string, markdown: string): void {
  fs.writeFileSync(solutionPath(problemId), markdown, 'utf-8');
}

export function deleteSolution(problemId: string): void {
  const p = solutionPath(problemId);
  if (fs.existsSync(p)) {
    fs.unlinkSync(p);
  }
}

// ----- Contest Management -----

function normalizeContest(rec: Record<string, unknown>): Contest {
  const result = { ...rec } as unknown as Contest;

  try {
    result.total_problems = Math.max(1, Math.min(26, parseInt(String(result.total_problems || 1), 10)));
  } catch {
    result.total_problems = 1;
  }

  const probs = (result.problems || []) as ContestProblem[];
  const out: ContestProblem[] = [];

  for (let i = 0; i < result.total_problems; i++) {
    const base: ContestProblem = {
      letter: LETTERS[i],
      pass_count: 0,
      attempt_count: 0,
      my_status: 'unsubmitted',
    };

    if (i < probs.length && probs[i]) {
      const p = probs[i];
      base.pass_count = parseInt(String(p.pass_count || 0), 10) || 0;
      base.attempt_count = parseInt(String(p.attempt_count || 0), 10) || 0;
      base.my_status = ['ac', 'attempted', 'unsubmitted'].includes(p.my_status)
        ? p.my_status
        : 'unsubmitted';
    }
    out.push(base);
  }

  result.problems = out;
  return result;
}

export function loadContests(): Contest[] {
  try {
    const data = fs.readFileSync(CONTESTS_FILE, 'utf-8');
    const items = JSON.parse(data) as Record<string, unknown>[];
    return items.map(normalizeContest);
  } catch {
    fs.writeFileSync(CONTESTS_FILE, '[]', 'utf-8');
    return [];
  }
}

export function saveContests(items: Contest[]): void {
  fs.writeFileSync(CONTESTS_FILE, JSON.stringify(items, null, 2), 'utf-8');
}

export function createContest(data: ContestInput): Contest {
  const items = loadContests();
  const now = new Date().toISOString();

  const rec: Contest = normalizeContest({
    id: uuidv4(),
    created_at: now,
    updated_at: now,
    ...data,
  });

  items.push(rec);
  saveContests(items);
  return rec;
}

export function updateContest(contestId: string, data: Partial<ContestInput>): Contest | null {
  const items = loadContests();
  const now = new Date().toISOString();

  const index = items.findIndex((it) => it.id === contestId);
  if (index === -1) return null;

  items[index] = normalizeContest({
    ...items[index],
    ...data,
    updated_at: now,
  });

  saveContests(items);
  return items[index];
}

export function deleteContest(contestId: string): boolean {
  const items = loadContests();
  const originalLen = items.length;
  const filtered = items.filter((it) => it.id !== contestId);

  if (filtered.length === originalLen) return false;

  saveContests(filtered);
  return true;
}

export function filterContests(startDate?: string, endDate?: string): Contest[] {
  let items = loadContests();

  if (startDate || endDate) {
    items = items.filter((it) => {
      if (!it.created_at) return false;
      const itemDate = new Date(it.created_at);
      if (startDate && itemDate < new Date(startDate)) return false;
      if (endDate && itemDate > new Date(endDate + 'T23:59:59')) return false;
      return true;
    });
  }

  return items;
}
