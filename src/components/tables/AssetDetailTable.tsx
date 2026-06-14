import { useState } from "react";
import { type AssetRecord, type FeeRecord } from "@/lib/api";
import { getCategoryColor, CHART_COLORS, fmtPctShort } from "@/lib/chart-theme";
import { bigCategory, CATEGORY_ORDER } from "@/lib/config";
import { ChevronDown, ChevronUp, Search } from "lucide-react";

interface Props {
  assets: AssetRecord[];
  fees: FeeRecord[];
  navAvgWan: number;
}

// Column groups for logical ordering
const COLUMNS = [
  // 产品基本信息
  { key: "资产名称", label: "资产名称", group: "基本信息", align: "left" as const, wide: true },
  { key: "资产类别", label: "资产类别", group: "基本信息", align: "left" as const },
  { key: "持有天数", label: "持有天数", group: "基本信息", align: "right" as const },
  // 本期收益构成
  { key: "期初市值(万)", label: "期初市值", group: "收益构成", align: "right" as const },
  { key: "期末市值(万)", label: "期末市值", group: "收益构成", align: "right" as const },
  { key: "本期买卖收益(万)", label: "买卖收益", group: "收益构成", align: "right" as const },
  { key: "本期公允变动(万)", label: "公允变动", group: "收益构成", align: "right" as const },
  { key: "本期利息收入(万)", label: "利息收入", group: "收益构成", align: "right" as const },
  { key: "本期总收益(万)", label: "总收益", group: "收益构成", align: "right" as const },
  // 对产品贡献
  { key: "对产品NAV贡献率(%)", label: "NAV贡献率", group: "产品贡献", align: "right" as const },
  { key: "对产品年化贡献(%)", label: "年化贡献", group: "产品贡献", align: "right" as const },
  // 平均持仓规模
  { key: "avg_position_wan", label: "平均持仓(万)", group: "持仓规模", align: "right" as const },
  { key: "avg_position_pct", label: "平均仓位(%)", group: "持仓规模", align: "right" as const },
  // 资产HPR收益率
  { key: "HPR(%)", label: "HPR(绝对)", group: "HPR收益率", align: "right" as const },
  { key: "HPR年化(%)", label: "HPR年化", group: "HPR收益率", align: "right" as const },
  // 平均持仓收益率
  { key: "平均持仓年化(%)", label: "持仓年化", group: "持仓收益率", align: "right" as const },
  // 备注
  { key: "备注", label: "备注", group: "备注", align: "center" as const },
] as const;

const GROUP_COLORS: Record<string, string> = {
  "基本信息": "bg-slate-50 text-slate-500",
  "收益构成": "bg-blue-50/50 text-blue-500",
  "产品贡献": "bg-purple-50/50 text-purple-500",
  "持仓规模": "bg-amber-50/50 text-amber-600",
  "HPR收益率": "bg-green-50/50 text-green-600",
  "持仓收益率": "bg-teal-50/50 text-teal-600",
  "备注": "bg-slate-50 text-slate-400",
};

export default function AssetDetailTable({ assets, fees, navAvgWan }: Props) {
  const [search, setSearch] = useState("");
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<string>("本期总收益(万)");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Group by big category
  const groups: Record<string, AssetRecord[]> = {};
  for (const a of assets) {
    const bc = bigCategory(a["资产类别"]);
    if (!groups[bc]) groups[bc] = [];
    groups[bc].push(a);
  }
  if (fees.length > 0) {
    const feeItems = fees.map((f) => ({
      资产名称: f["费用类别"],
      资产类别: "产品费用" as any,
      "期初市值(万)": 0,
      "期末市值(万)": 0,
      "本期买卖收益(万)": 0,
      "本期公允变动(万)": 0,
      "本期利息收入(万)": 0,
      "本期总收益(万)": f["本期费用(万)"],
      "对产品NAV贡献率(%)": 0 as any,
      "对产品年化贡献(%)": f["费用年化拖累_日均(%)"] ?? 0,
      持有天数: 0 as any,
      "HPR(%)": 0 as any,
      "HPR年化(%)": 0 as any,
      "平均持仓年化(%)": 0 as any,
      收益计算方式: "逐日计提",
      尾仓标注: "",
    } as AssetRecord));
    groups["产品费用"] = feeItems;
  }

  const catOrder = CATEGORY_ORDER.filter((c) => c in groups);
  const remaining = Object.keys(groups).filter((c) => !catOrder.includes(c));
  const sortedCats = [...catOrder, ...remaining];

  const toggleCat = (cat: string) => {
    const next = new Set(expandedCats);
    if (next.has(cat)) next.delete(cat);
    else next.add(cat);
    setExpandedCats(next);
  };

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const filteredAndSorted = (list: AssetRecord[]) => {
    let result = [...list];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((a) => a["资产名称"].toLowerCase().includes(q));
    }
    result.sort((a, b) => {
      const va = (a as any)[sortKey] ?? 0;
      const vb = (b as any)[sortKey] ?? 0;
      return sortDir === "desc" ? vb - va : va - vb;
    });
    return result;
  };

  // Get cell value for display
  const getCellValue = (a: AssetRecord, colKey: string): { text: string; className: string } => {
    if (colKey === "资产名称") {
      const name = a["资产名称"];
      return { text: name, className: "text-slate-700 break-all leading-tight" };
    }
    if (colKey === "资产类别") {
      return { text: a["资产类别"], className: "text-slate-400 text-[10px]" };
    }
    if (colKey === "备注") {
      return { text: a["尾仓标注"] || a["收益计算方式"] || "", className: "text-slate-400 text-[10px]" };
    }
    if (colKey === "avg_position_wan") {
      const v = (a["期初市值(万)"] + a["期末市值(万)"]) / 2;
      return { text: v.toFixed(1), className: "text-right text-slate-500" };
    }
    if (colKey === "avg_position_pct") {
      const avgPos = (a["期初市值(万)"] + a["期末市值(万)"]) / 2;
      const pct = navAvgWan > 0 ? (avgPos / navAvgWan) * 100 : 0;
      return { text: pct.toFixed(2) + "%", className: "text-right text-slate-500" };
    }

    const v = (a as any)[colKey];
    if (v == null) return { text: "-", className: "text-right text-slate-300" };

    const num = Number(v);
    if (isNaN(num)) return { text: String(v), className: "text-right" };

    // 格式化规则：天数0位 / 收益率百分比2位 / 规模量1位
    if (colKey === "持有天数") return { text: Math.round(num).toString(), className: "text-right text-slate-500" };
    // 百分比/率/贡献 — 2位小数（必须在"持仓"判断之前，避免"平均持仓年化(%)"被误拦截）
    if (colKey.includes("%") || colKey.includes("率") || colKey.includes("贡献")) {
      return {
        text: (num >= 0 ? "+" : "") + num.toFixed(2) + "%",
        className: `text-right ${num >= 0 ? "text-brand-600" : "text-red-500"}`,
      };
    }
    // 规模/量 — 1位小数
    if (colKey.includes("市值") || colKey === "avg_position_wan") {
      return { text: num.toFixed(1), className: "text-right text-slate-500" };
    }
    // 收益/变动/利息金额 — 1位小数，带正负号
    if (colKey.includes("收益") || colKey.includes("变动") || colKey.includes("利息")) {
      return {
        text: (num >= 0 ? "+" : "") + num.toFixed(1),
        className: `text-right font-medium ${num >= 0 ? "text-brand-600" : "text-red-500"}`,
      };
    }
    return { text: num.toFixed(1), className: "text-right" };
  };

  // Group header color
  const catRet = (list: AssetRecord[]) => {
    const r = list.reduce((s, a) => s + a["本期总收益(万)"], 0);
    return r;
  };

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[1100px]">
      {/* Search & Sort */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-slate-100">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索资产名称..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-slate-200
                       focus:outline-none focus:ring-1 focus:ring-brand-200 focus:border-brand-400"
          />
        </div>
        <span className="text-xs text-slate-400">{assets.length + fees.length} 条记录</span>
      </div>

      {/* Column group headers */}
      <div className="flex text-[10px] font-semibold border-b border-slate-100">
        <div className="w-7 shrink-0"></div>
        {(() => {
          const groupSpans: { group: string; span: number }[] = [];
          let current = "";
          let count = 0;
          for (const col of COLUMNS) {
            if (col.group !== current) {
              if (current) groupSpans.push({ group: current, span: count });
              current = col.group;
              count = 1;
            } else {
              count++;
            }
          }
          if (current) groupSpans.push({ group: current, span: count });

          return groupSpans.map((g) => (
            <div
              key={g.group}
              className={`flex-1 px-1 py-1 text-center ${GROUP_COLORS[g.group] || ""}`}
              style={{ flex: `${g.span} 0 0` }}
            >
              {g.group}
            </div>
          ));
        })()}
      </div>

      {/* Column headers */}
      <div className="flex text-[11px] font-medium text-slate-400 border-b border-slate-100 bg-slate-50/50">
        <div className="w-7 shrink-0"></div>
        {COLUMNS.map((col) => (
          <span
            key={col.key}
            onClick={() => col.key !== "资产名称" && col.key !== "资产类别" && col.key !== "备注" && toggleSort(col.key)}
            className={`px-1 py-1.5 ${'wide' in col && col.wide ? 'w-48 min-w-[120px]' : 'flex-1 min-w-[50px]'} ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"} ${
              col.key !== "资产名称" && col.key !== "资产类别" && col.key !== "备注" ? "cursor-pointer hover:text-slate-600" : ""
            }`}
          >
            {col.label}
            {sortKey === col.key ? (sortDir === "desc" ? " ↓" : " ↑") : ""}
          </span>
        ))}
      </div>

      {/* Grouped rows */}
      {sortedCats.map((cat) => {
        const list = filteredAndSorted(groups[cat] || []);
        if (list.length === 0 && search) return null;
        const expanded = expandedCats.has(cat) || list.length <= 3;
        const catColor = getCategoryColor(cat);
        const ret = catRet(list);

        return (
          <div key={cat}>
            {/* Category header */}
            <button
              onClick={() => toggleCat(cat)}
              className="w-full flex items-center text-xs bg-slate-50 hover:bg-slate-100 transition-colors border-b border-slate-100"
            >
              <span className="w-7 shrink-0 flex items-center justify-center">
                {expanded ? <ChevronUp className="w-3 h-3 text-slate-400" /> : <ChevronDown className="w-3 h-3 text-slate-400" />}
              </span>
              <span className="flex-1 py-1.5 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: catColor }} />
                <span className="font-semibold text-slate-700">{cat}</span>
                <span className={`font-semibold ${ret >= 0 ? "text-brand-600" : "text-red-500"}`}>
                  {ret >= 0 ? "+" : ""}{ret.toFixed(1)}万
                </span>
                <span className="text-slate-400">{list.length}项</span>
              </span>
            </button>

            {/* Rows */}
            {expanded &&
              list.map((a, i) => (
                <div
                  key={i}
                  className="flex items-center text-xs border-b border-slate-50 hover:bg-brand-50/30 transition-colors"
                >
                  <div className="w-7 shrink-0"></div>
                  {COLUMNS.map((col) => {
                    const { text, className } = getCellValue(a, col.key);
                    return (
                      <span
                        key={col.key}
                        className={`px-1 py-1.5 ${'wide' in col && col.wide ? 'w-48 min-w-[120px]' : 'flex-1 min-w-[50px]'} ${className}`}
                        title={col.key === "资产名称" ? a["资产名称"] : undefined}
                      >
                        {text}
                      </span>
                    );
                  })}
                </div>
              ))}
          </div>
        );
      })}
      </div>
    </div>
  );
}
