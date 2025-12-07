import axios from 'axios';
import type { Problem, ProblemInput, Contest, ContestInput, GitConfig, ImportContestData, ApiResponse } from '@/types';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Problem APIs
export const problemApi = {
  list: async (filter?: 'all' | 'solved' | 'unsolved', startDate?: string, endDate?: string): Promise<Problem[]> => {
    const params = new URLSearchParams();
    if (filter) params.append('filter', filter);
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    const response = await api.get<Problem[]>(`/problems?${params.toString()}`);
    return response.data;
  },

  get: async (id: string): Promise<Problem> => {
    const response = await api.get<Problem>(`/problems/${id}`);
    return response.data;
  },

  create: async (data: ProblemInput): Promise<Problem> => {
    const response = await api.post<Problem>('/problems', data);
    return response.data;
  },

  update: async (id: string, data: Partial<ProblemInput>): Promise<Problem> => {
    const response = await api.put<Problem>(`/problems/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/problems/${id}`);
  },

  getSolution: async (id: string): Promise<string | null> => {
    const response = await api.get<{ content: string | null }>(`/problems/${id}/solution`);
    return response.data.content;
  },

  saveSolution: async (id: string, content: string): Promise<void> => {
    await api.put(`/problems/${id}/solution`, { content });
  },

  deleteSolution: async (id: string): Promise<void> => {
    await api.delete(`/problems/${id}/solution`);
  },
};

// Contest APIs
export const contestApi = {
  list: async (startDate?: string, endDate?: string): Promise<Contest[]> => {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    const response = await api.get<Contest[]>(`/contests?${params.toString()}`);
    return response.data;
  },

  get: async (id: string): Promise<Contest> => {
    const response = await api.get<Contest>(`/contests/${id}`);
    return response.data;
  },

  create: async (data: ContestInput): Promise<Contest> => {
    const response = await api.post<Contest>('/contests', data);
    return response.data;
  },

  update: async (id: string, data: Partial<ContestInput>): Promise<Contest> => {
    const response = await api.put<Contest>(`/contests/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/contests/${id}`);
  },

  import: async (data: ImportContestData): Promise<ApiResponse<Contest>> => {
    const response = await api.post<ApiResponse<Contest>>('/import_contest', { data: [data] });
    return response.data;
  },

  // 获取待导入的比赛数据
  getPendingImport: async (): Promise<ImportContestData | null> => {
    const response = await api.get<{ data: ImportContestData | null }>('/pending_import');
    return response.data.data;
  },

  // 确认导入比赛和题目数据
  confirmImport: async (): Promise<{
    success: boolean;
    message: string;
    results?: {
      contest?: { success: boolean; message: string; id?: string };
      problems?: { success: boolean; message: string; successCount?: number; failCount?: number };
    };
  }> => {
    const response = await api.post('/confirm_import_contest');
    return response.data;
  },

  // 清除待导入的比赛数据
  clearPendingImport: async (): Promise<void> => {
    await api.delete('/pending_import');
  },
};

// Git APIs
export const gitApi = {
  getConfig: async (): Promise<GitConfig> => {
    const response = await api.get<GitConfig>('/git/config');
    return response.data;
  },

  getStatus: async (): Promise<string> => {
    const response = await api.get<{ status: string }>('/git/status');
    return response.data.status;
  },

  clone: async (repoUrl: string, branch: string): Promise<string> => {
    const response = await api.post<{ output: string }>('/git/clone', { repo_url: repoUrl, branch });
    return response.data.output;
  },

  pull: async (repoUrl: string, branch: string): Promise<string> => {
    const response = await api.post<{ output: string }>('/git/pull', { repo_url: repoUrl, branch });
    return response.data.output;
  },

  push: async (repoUrl: string, branch: string, message?: string): Promise<string> => {
    const response = await api.post<{ output: string }>('/git/push', { repo_url: repoUrl, branch, message });
    return response.data.output;
  },

  backupAndReclone: async (repoUrl: string, branch: string): Promise<string> => {
    const response = await api.post<{ output: string }>('/git/backup-reclone', { repo_url: repoUrl, branch });
    return response.data.output;
  },
};

export default api;
