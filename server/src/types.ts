// Constants
export const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// Problem types
export type UnsolvedStage = '未看题' | '已看题无思路' | '知道做法未实现';
export type ContestStatus = 'ac' | 'attempted' | 'unsubmitted';

// Problem interfaces
export interface ProblemInput {
  title: string;
  link?: string | null;
  source?: string | null;
  tags: string[];
  assignee?: string | null;
  solved: boolean;
  unsolved_stage?: UnsolvedStage | null;
  unsolved_custom_label?: string | null;
  pass_count?: number | null;
  notes?: string | null;
}

export interface Problem extends ProblemInput {
  id: string;
  created_at: string;
  updated_at: string;
  has_solution: boolean;
}

// Contest interfaces
export interface ContestProblem {
  letter: string;
  pass_count: number;
  attempt_count: number;
  my_status: ContestStatus;
}

export interface ContestInput {
  name: string;
  total_problems: number;
  problems: ContestProblem[];
  rank_str?: string | null;
  summary?: string | null;
}

export interface Contest extends ContestInput {
  id: string;
  created_at: string;
  updated_at: string;
}

// Git types
export interface GitConfig {
  repo_url: string;
  branch: string;
  cloned: boolean;
  last_updated?: string;
}
