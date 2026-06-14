import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2, Download, AlertTriangle, TrendingUp, Wallet, Percent, BarChart3, ChevronDown, ChevronRight } from "lucide-react";
import { getResults, type AttributionResult } from "@/lib/api";
import { fmtPctShort, fmtWan } from "@/lib/chart-theme";
import OverviewCards from "@/components/cards/OverviewCards";
import AssetBarChart from "@/components/charts/AssetBarChart";
import ReturnSourceChart from "@/components/charts/ReturnSourceChart";
import WaterfallChart from "@/components/charts/WaterfallChart";
import AssetDetailTable from "@/components/tables/AssetDetailTable";

function CollapsibleSection({ title, defaultOpen = true, children }: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-xl border border-slate-200 card-shadow overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-4 py-3 border-b border-slate-100 hover:bg-slate-50 transition-colors"
      >
        {open ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
      </button>
      {open && children}
    </div>
  );
}

export default function Dashboard() {
  const { taskId } = useParams<{ taskId: string }>();
  const [data, setData] = useState<AttributionResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeChart, setActiveChart] = useState<"bar" | "source" | "waterfall">("bar");

  useEffect(() => {
    if (!taskId) return;
    getResults(taskId)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [taskId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-3">
        <Loader2 className="w-6 h-6 text-brand-500 animate-spin" />
        <span className="text-sm text-slate-500">加载归因结果...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <AlertTriangle className="w-8 h-8 text-red-400" />
        <span className="text-sm text-red-600">{error || "数据加载失败"}</span>
      </div>
    );
  }

  const nav = data.product_nav;
  const meta = data.metadata;
  const assets = data.assets;
  const fees = data.fees;
  const recon = data.reconcile;
  const navAvgWan = nav.nav_avg_wan ?? 0;
  const retAnnAvg = nav.ret_ann_vs_avg ?? 0;

  return (
    <div className="px-6 py-6 space-y-6 pb-16">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight">
            {meta.prod} {meta.prod_name ? `— ${meta.prod_name}` : ""}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {meta.date_start} ~ {meta.date_end} · 共 {meta.days} 天
          </p>
        </div>
        <a
          href={`/api/export/${taskId}`}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                     bg-brand-50 text-brand-700 hover:bg-brand-100 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          导出Excel
        </a>
      </div>

      {/* Overview Cards */}
      <OverviewCards
        items={[
          {
            label: "净值法总收益",
            value: `${nav.total_return >= 0 ? "+" : ""}${(nav.total_return / 1e4).toFixed(2)} 万`,
            sub: `绝对收益率 ${(nav.ret_abs * 100).toFixed(4)}%`,
            icon: <Wallet className="w-4 h-4" />,
            accent: nav.total_return >= 0 ? "text-brand-600" : "text-red-500",
          },
          {
            label: "日均口径年化",
            value: `${retAnnAvg >= 0 ? "+" : ""}${retAnnAvg?.toFixed(4) ?? "-"}%`,
            sub: `HPR年化 ${((nav.ret_ann ?? 0) * 100).toFixed(4)}%`,
            icon: <TrendingUp className="w-4 h-4" />,
            accent: (retAnnAvg ?? 0) >= 0 ? "text-brand-600" : "text-red-500",
          },
          {
            label: "日均规模",
            value: fmtWan(navAvgWan),
            sub: `期初 ${(nav.nav_init / 1e8).toFixed(2)} 亿`,
            icon: <BarChart3 className="w-4 h-4" />,
            accent: "text-slate-700",
          },
          {
            label: "校验残差",
            value: `${recon.gap_wan.toFixed(2)} 万`,
            sub: `资产 ${recon.asset_total_ret_wan.toFixed(1)} + 费用 ${recon.fee_net_wan.toFixed(1)} vs 净值法 ${recon.nav_method_wan.toFixed(1)}`,
            icon: <Percent className="w-4 h-4" />,
            accent: Math.abs(recon.gap_wan) < 10 ? "text-green-600" : "text-amber-600",
          },
        ]}
      />

      {/* Chart Tabs */}
      <CollapsibleSection title="图表分析">
        <div className="flex border-b border-slate-100">
          {[
            { key: "bar", label: "资产收益贡献" },
            { key: "source", label: "收益来源分解" },
            { key: "waterfall", label: "年化归因瀑布" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveChart(tab.key as any)}
              className={`px-4 py-2.5 text-xs font-medium transition-colors border-b-2 -mb-px ${
                activeChart === tab.key
                  ? "border-brand-600 text-brand-700"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="p-4">
          {activeChart === "bar" && <AssetBarChart assets={assets} />}
          {activeChart === "source" && (
            <ReturnSourceChart assets={assets} fees={fees} />
          )}
          {activeChart === "waterfall" && (
            <WaterfallChart assets={assets} fees={fees} navAvgWan={navAvgWan} days={meta.days} retAnnAvg={retAnnAvg} />
          )}
        </div>
      </CollapsibleSection>

      {/* Asset & Fee Detail Table */}
      <CollapsibleSection title="资产及费用归因明细">
        <AssetDetailTable assets={assets} fees={fees} navAvgWan={navAvgWan} />
      </CollapsibleSection>
    </div>
  );
}
