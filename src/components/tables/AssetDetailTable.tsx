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

  const formatVal = (v: any, key: string): string => {
    if (v == null) return "-";
    if (typeof v === "number") {
      if (key.includes("%") || key.includes("率")) return v.toFixed(4) + "%";
      if (key.includes("市值") || key.includes("收益") || key.includes("变动") || key.includes("利息"))
        return (v >= 0 ? "+" : "") + v.toFixed(2);
      if (key === "持有天数") return v.toString();
      return v.toFixed(2);
    }
    return String(v);
  };

  const colorFor = (key: string, v: any) => {
    if (typeof v !== "number") return "";
    if (key.includes("市值") || key.includes("持仓") || key === "持有天数") return "";
    if (key === "尾仓标注" || key === "收益计算方式") return "";
    return v >= 0 ? "text-brand-600" : "text-red-500";
  };

  return (
    <div>
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

      {/* Table headers */}
      <div className="grid grid-cols-[30px_1.5fr_repeat(9,1fr)_80px] gap-1 px-4 py-2 text-[11px] font-medium text-slate-400 border-b border-slate-100 bg-slate-50/50">
        <span></span>
        <span>资产名称</span>
        <span onClick={() => toggleSort("本期总收益(万)")} className="cursor-pointer hover:text-slate-600 text-right">
          总收益 {sortKey === "本期总收益(万)" ? (sortDir === "desc" ? "↓" : "↑") : ""}
        </span>
        <span onClick={() => toggleSort("HPR年化(%)")} className="cursor-pointer hover:text-slate-600 text-right">
          HPR年化
        </span>
        <span onClick={() => toggleSort("平均持仓年化(%)")} className="cursor-pointer hover:text-slate-600 text-right">
          持仓年化
        </span>
        <span onClick={() => toggleSort("对产品年化贡献(%)")} className="cursor-pointer hover:text-slate-600 text-right">
          年化贡献
        </span>
        <span className="text-right">期初</span>
        <span className="text-right">期末</span>
        <span className="text-right">买卖收益</span>
        <span className="text-right">公允变动</span>
        <span className="text-right">利息收入</span>
        <span className="text-center">备注</span>
      </div>

      {/* Grouped rows */}
      {sortedCats.map((cat) => {
        const list = filteredAndSorted(groups[cat] || []);
        if (list.length === 0 && search) return null;
        const expanded = expandedCats.has(cat) || list.length <= 3;
        const catColor = getCategoryColor(cat);
        const catRet = list.reduce((s, a) => s + a["本期总收益(万)"], 0);

        return (
          <div key={cat}>
            {/* Category header */}
            <button
              onClick={() => toggleCat(cat)}
              className="w-full grid grid-cols-[30px_1.5fr_repeat(9,1fr)_80px] gap-1 px-4 py-1.5
                         bg-slate-50 hover:bg-slate-100 transition-colors text-xs"
            >
              <span className="flex items-center">
                {expanded ? <ChevronUp className="w-3 h-3 text-slate-400" /> : <ChevronDown className="w-3 h-3 text-slate-400" />}
              </span>
              <span className="font-semibold text-slate-700 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: catColor }} />
                {cat}
              </span>
              <span className={`text-right font-semibold ${catRet >= 0 ? "text-brand-600" : "text-red-500"}`}>
                {catRet >= 0 ? "+" : ""}{catRet.toFixed(2)}
              </span>
              <span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span>
              <span className="text-slate-400 text-center">{list.length} 项</span>
            </button>

            {/* Rows */}
            {expanded &&
              list.map((a, i) => {
                const ret = a["本期总收益(万)"];
                return (
                  <div
                    key={i}
                    className="grid grid-cols-[30px_1.5fr_repeat(9,1fr)_80px] gap-1 px-4 py-1.5 text-xs
                               border-b border-slate-50 hover:bg-brand-50/30 transition-colors"
                  >
                    <span></span>
                    <span className="text-slate-700 truncate" title={a["资产名称"]}>
                      {a["资产名称"].length > 20 ? a["资产名称"].slice(0, 19) + "…" : a["资产名称"]}
                    </span>
                    <span className={`text-right font-medium ${ret >= 0 ? "text-brand-600" : "text-red-500"}`}>
                      {ret >= 0 ? "+" : ""}{ret.toFixed(2)}
                    </span>
                    <span className={`text-right ${(a["HPR年化(%)"] ?? 0) >= 0 ? "text-brand-600" : "text-red-500"}`}>
                      {a["HPR年化(%)"] != null ? (a["HPR年化(%)"] >= 0 ? "+" : "") + a["HPR年化(%)"]?.toFixed(2) + "%" : "-"}
                    </span>
                    <span className={`text-right ${(a["平均持仓年化(%)"] ?? 0) >= 0 ? "text-brand-600" : "text-red-500"}`}>
                      {a["平均持仓年化(%)"] != null ? (a["平均持仓年化(%)"] >= 0 ? "+" : "") + a["平均持仓年化(%)"]?.toFixed(2) + "%" : "-"}
                    </span>
                    <span className={`text-right ${(a["对产品年化贡献(%)"] ?? 0) >= 0 ? "text-brand-600" : "text-red-500"}`}>
                      {a["对产品年化贡献(%)"] != null ? (a["对产品年化贡献(%)"] >= 0 ? "+" : "") + a["对产品年化贡献(%)"]?.toFixed(4) + "%" : "-"}
                    </span>
                    <span className="text-right text-slate-500">{a["期初市值(万)"].toFixed(0)}</span>
                    <span className="text-right text-slate-500">{a["期末市值(万)"].toFixed(0)}</span>
                    <span className={`text-right ${a["本期买卖收益(万)"] >= 0 ? "text-brand-600" : "text-red-500"}`}>
                      {a["本期买卖收益(万)"] >= 0 ? "+" : ""}{a["本期买卖收益(万)"].toFixed(2)}
                    </span>
                    <span className={`text-right ${a["本期公允变动(万)"] >= 0 ? "text-brand-600" : "text-red-500"}`}>
                      {a["本期公允变动(万)"] >= 0 ? "+" : ""}{a["本期公允变动(万)"].toFixed(2)}
                    </span>
                    <span className={`text-right ${a["本期利息收入(万)"] >= 0 ? "text-brand-600" : "text-red-500"}`}>
                      {a["本期利息收入(万)"] >= 0 ? "+" : ""}{a["本期利息收入(万)"].toFixed(2)}
                    </span>
                    <span className="text-slate-400 text-center truncate text-[10px]">
                      {a["尾仓标注"] || a["收益计算方式"]}
                    </span>
                  </div>
                );
              })}
          </div>
        );
      })}
    </div>
  );
}
