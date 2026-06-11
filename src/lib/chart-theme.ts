// 图表主题配置 — 集中管理所有图表配色、字体、样式
// 白色主题 + 蓝色系

export const CHART_COLORS = {
  // 资产大类 → 颜色
  category: {
    债券类资产管理计划: "#4472C4",
    债券类公募基金: "#4472C4",
    公司债券: "#4472C4",
    托管账户: "#70AD47",
    货币存款: "#70AD47",
    股票类公募基金: "#C00000",
    混合类公募基金: "#ED7D31",
    混合类资产管理计划: "#ED7D31",
    证券清算款: "#94A3B8",
    产品费用: "#94A3B8",
    其他: "#94A3B8",
  } as Record<string, string>,

  // 收益构成
  component: {
    买卖损益: "#4472C4",
    公允价值变动: "#2E75B6",
    利息收入: "#70AD47",
    产品费用: "#94A3B8",
  } as Record<string, string>,

  // 瀑布图
  waterfall: {
    positive: "#4472C4",
    negative: "#C00000",
    total: "#1F4E79",
    fee: "#94A3B8",
  },

  // 通用
  text: "#64748B",
  textDark: "#1E293B",
  grid: "#E2E8F0",
  background: "#F8FAFC",

  // 正负色
  positive: "#2E75B6",
  negative: "#C00000",
};

export const CHART_FONT = {
  family:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif',
  fontSize: 12,
  titleSize: 14,
  labelSize: 11,
};

export function getCategoryColor(cat: string): string {
  for (const [key, color] of Object.entries(CHART_COLORS.category)) {
    if (cat === key) return color;
  }
  // Fuzzy match
  for (const [key, color] of Object.entries(CHART_COLORS.category)) {
    if (cat.includes(key) || key.includes(cat)) return color;
  }
  return CHART_COLORS.category["其他"];
}

export function fmtWan(v: number): string {
  if (v >= 10000) return `${(v / 10000).toFixed(2)}亿`;
  return `${v.toFixed(0)}万`;
}

export function fmtPct(v: number | null | undefined): string {
  if (v == null) return "-";
  return `${v >= 0 ? "+" : ""}${v.toFixed(4)}%`;
}

export function fmtPctShort(v: number | null | undefined): string {
  if (v == null) return "-";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}
