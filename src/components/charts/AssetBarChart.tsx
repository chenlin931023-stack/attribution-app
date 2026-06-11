import { type AssetRecord } from "@/lib/api";
import { getCategoryColor, CHART_COLORS, CHART_FONT, fmtPctShort } from "@/lib/chart-theme";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList,
} from "recharts";

interface Props {
  assets: AssetRecord[];
}

export default function AssetBarChart({ assets }: Props) {
  const data = [...assets]
    .sort((a, b) => b["本期总收益(万)"] - a["本期总收益(万)"])
    .map((a) => ({
      name: a["资产名称"].length > 16 ? a["资产名称"].slice(0, 15) + "…" : a["资产名称"],
      fullName: a["资产名称"],
      ret: a["本期总收益(万)"],
      cat: a["资产类别"],
      hprAnn: a["HPR年化(%)"],
      avgAnn: a["平均持仓年化(%)"],
      days: a["持有天数"],
      note: a["尾仓标注"],
    }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-lg text-xs">
        <p className="font-semibold text-slate-800 mb-1">{d.fullName}</p>
        <div className="space-y-0.5 text-slate-600">
          <p>总收益: <span className={d.ret >= 0 ? "text-brand-600" : "text-red-500"}>{d.ret.toFixed(2)} 万</span></p>
          <p>HPR年化: {d.hprAnn != null ? fmtPctShort(d.hprAnn) : "-"}</p>
          <p>持仓年化: {d.avgAnn != null ? fmtPctShort(d.avgAnn) : "-"}</p>
          <p>持有 {d.days} 天{d.note ? ` · ${d.note}` : ""}</p>
        </div>
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={Math.max(300, data.length * 30)}>
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 80, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11, fill: CHART_COLORS.text }} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11, fill: CHART_COLORS.textDark }} tickLine={false} axisLine={false} />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="ret" radius={[0, 4, 4, 0]} barSize={18}>
          {data.map((entry, idx) => (
            <Cell key={idx} fill={entry.ret >= 0 ? getCategoryColor(entry.cat) : CHART_COLORS.negative} />
          ))}
          <LabelList
            dataKey="ret"
            position="right"
            formatter={(v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}万`}
            style={{ fontSize: 10, fill: CHART_COLORS.text, fontFamily: CHART_FONT.family }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
