const API_BASE = "/api";

export interface FileInfo {
  file_id: string;
  filename: string;
  file_type: "valuation" | "cashflow" | "unknown";
  snap_date?: string;
  date_min?: string;
  date_max?: string;
  cf_date_start?: string;
  cf_date_end?: string;
  product_codes: string[];
  row_count: number;
}

export interface TaskStatus {
  task_id: string;
  status: "pending" | "running" | "done" | "failed";
  progress?: number;
  product_codes?: string[];
  start_date?: string;
  end_date?: string;
  created_at?: string;
  error?: string;
}

export interface AttributionResult {
  product_nav: {
    nav_init: number;
    nav_end: number;
    total_return: number;
    ret_abs: number;
    ret_ann: number;
    nav_avg_wan: number;
    ret_ann_vs_avg: number;
    days: number;
  };
  assets: AssetRecord[];
  fees: FeeRecord[];
  reconcile: ReconcileData;
  metadata: {
    prod: string;
    prod_name: string;
    date_start: string;
    date_end: string;
    days: number;
  };
}

export interface AssetRecord {
  资产名称: string;
  资产类别: string;
  "期初市值(万)": number;
  "期末市值(万)": number;
  "本期买卖收益(万)": number;
  "本期公允变动(万)": number;
  "本期利息收入(万)": number;
  "本期总收益(万)": number;
  "对产品NAV贡献率(%)": number;
  "对产品年化贡献(%)": number;
  持有天数: number;
  "HPR(%)": number;
  "HPR年化(%)": number;
  "平均持仓年化(%)": number;
  收益计算方式: string;
  尾仓标注: string;
}

export interface FeeRecord {
  费用类别: string;
  名称: string;
  "本期费用(万)": number;
  "费用年化拖累_日均(%)": number;
}

export interface ReconcileData {
  asset_total_ret_wan: number;
  fee_net_wan: number;
  sum_wan: number;
  nav_method_wan: number;
  gap_wan: number;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function uploadFile(file: File): Promise<FileInfo> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/upload`, { method: "POST", body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Upload failed");
  }
  return res.json();
}

export async function submitAnalysis(data: {
  product_codes: string[];
  start_date: string;
  end_date: string;
  valuation_file_ids: string[];
  cashflow_file_id: string;
}): Promise<{ task_id: string }> {
  return request("/analyze", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getTaskStatus(taskId: string): Promise<TaskStatus> {
  return request(`/tasks/${taskId}`);
}

export async function getResults(taskId: string): Promise<AttributionResult> {
  return request(`/results/${taskId}`);
}

export async function getExportUrl(taskId: string): Promise<string> {
  return `${API_BASE}/export/${taskId}`;
}
