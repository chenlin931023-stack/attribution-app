// 前端资产类别与费用配置
// 与 backend/app/config.py 保持同步

export const FEE_CATEGORIES = [
  "托管费",
  "销售手续费",
  "固定管理费",
  "费用预提待付",
];

export const INVEST_CATEGORIES = [
  "债券类资产管理计划",
  "债券类公募基金",
  "股票类公募基金",
  "混合类公募基金",
  "混合类资产管理计划",
  "公司债券",
  "托管账户",
];

export function bigCategory(cat: string): string {
  if (cat === "托管账户") return "货币存款";
  if (cat === "公司债券") return "公司债券";
  if (cat.includes("公募基金")) return cat;
  if (cat.includes("债券")) return "债券类资管";
  if (cat.includes("混合")) return "混合类资管";
  return cat;
}

export const CATEGORY_ORDER = [
  "债券类资产管理计划",
  "债券类公募基金",
  "公司债券",
  "货币存款",
  "股票类公募基金",
  "混合类公募基金",
  "混合类资产管理计划",
  "证券清算款",
];

export const FILE_TYPE_LABELS: Record<string, string> = {
  valuation: "估值表",
  cashflow: "现金流",
  unknown: "未知",
};
