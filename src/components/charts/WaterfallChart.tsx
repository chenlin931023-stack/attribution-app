import { type AssetRecord, type FeeRecord } from "@/lib/api";
import { getCategoryColor, CHART_COLORS, CHART_FONT } from "@/lib/chart-theme";
import { bigCategory, CATEGORY_ORDER } from "@/lib/config";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList,
} from "recharts";

interface Props {
  assets: AssetRecord[];
  fees: FeeRecord[];
  navAvgWan: number;
  days: number;
  retAnnAvg: number;
}

interface WFItem {
  name: string;
  value: number;
  start: number;
  end: number;
  color: string;
}

export default function WaterfallChart({ assets, fees, navAvgWan, days, retAnnAvg }: Props) {
  // Group by big category
  const catContrib: Record<string, number> = {};
  for (const a of assets) {
    const bc = bigCategory(a["资产类别"]);
    const c = a["对产品年化贡献(%)"] ?? 0;
    catContrib[bc] = (catContrib[bc] || 0) + c;
  }
  const feeContrib = fees.reduce((s, f) => s + (f["费用年化拖累_日均(%)"] ?? 0), 0);

  const catOrder = CATEGORY_ORDER.filter((c) => c in catContrib || c === "产品费用");
  const wfItems: WFItem[] = [];
  let running = 0;

  for (const cat in catContrib) {
    const v = catContrib[cat];
    wfItems.push({
      name: cat,
      value: v,
      start: v >= 0 ? running : running + v,
      end: running + v,
      color: v >= 0 ? getCategoryColor(cat) : CHART_COLORS.waterfall.negative,
    });
    running += v;
  }

  // Fee
  wfItems.push({
    name: "产品费用",
    value: feeContrib,
    start: feeContrib >= 0 ? running : running + feeContrib,
    end: running + feeContrib,
    color: CHART_COLORS.waterfall.fee,
  });
  running += feeContrib;

  // Net
  wfItems.push({
    name: `产品年化(${days}天)`,
    value: retAnnAvg,
    start: 0,
    end: retAnnAvg,
    color: CHART_COLORS.waterfall.total,
  });

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload as WFItem;
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-2 shadow text-xs">
        <p className="font-semibold text-slate-800">{d.name}</p>
        <p className={d.value >= 0 ? "text-brand-600" : "text-red-500"}>
          贡献: {d.value >= 0 ? "+" : ""}{d.value.toFixed(4)}%
        </p>
        <p className="text-slate-400">累计: {d.end.toFixed(4)}%</p>
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={wfItems} margin={{ top: 20, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: CHART_COLORS.text }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 11, fill: CHART_COLORS.text }} tickLine={false} axisLine={false}
          label={{ value: "%", position: "insideLeft", style: { fontSize: 11, fill: CHART_COLORS.text } }} />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="end" radius={[4, 4, 0, 0]} barSize={36}>
          {wfItems.map((entry, idx) => (
            <Cell key={idx} fill={entry.color} />
          ))}
          <LabelList
            dataKey="end"
            position="top"
            formatter={(v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(4)}%`}
            style={{ fontSize: 10, fill: CHART_COLORS.textDark, fontFamily: CHART_FONT.family }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
