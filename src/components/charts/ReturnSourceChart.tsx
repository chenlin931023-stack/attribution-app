import { type AssetRecord, type FeeRecord } from "@/lib/api";
import { getCategoryColor, CHART_COLORS, CHART_FONT } from "@/lib/chart-theme";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";

interface Props {
  assets: AssetRecord[];
  fees: FeeRecord[];
}

export default function ReturnSourceChart({ assets, fees }: Props) {
  // Pie: group by category
  const catMap: Record<string, number> = {};
  for (const a of assets) {
    const ret = a["本期总收益(万)"];
    if (ret > 0) {
      const cat = a["资产类别"];
      catMap[cat] = (catMap[cat] || 0) + ret;
    }
  }
  const pieData = Object.entries(catMap)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }));

  // Bar: return components
  const buySell = assets.reduce((s, a) => s + a["本期买卖收益(万)"], 0);
  const fairVal = assets.reduce((s, a) => s + a["本期公允变动(万)"], 0);
  const interest = assets.reduce((s, a) => s + a["本期利息收入(万)"], 0);
  const feeTotal = fees.reduce((s, f) => s + f["本期费用(万)"], 0);

  const compData = [
    { name: "买卖损益", value: Math.round(buySell * 100) / 100, color: CHART_COLORS.component["买卖损益"] },
    { name: "公允价值变动", value: Math.round(fairVal * 100) / 100, color: CHART_COLORS.component["公允价值变动"] },
    { name: "利息收入", value: Math.round(interest * 100) / 100, color: CHART_COLORS.component["利息收入"] },
    { name: "产品费用", value: Math.round(feeTotal * 100) / 100, color: CHART_COLORS.component["产品费用"] },
  ];

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-2 shadow text-xs">
        <span className="text-slate-600">{d.name}: </span>
        <span className={d.value >= 0 ? "text-brand-600 font-semibold" : "text-red-500 font-semibold"}>
          {d.value >= 0 ? "+" : ""}{d.value.toFixed(2)} 万
        </span>
      </div>
    );
  };

  return (
    <div className="flex gap-6">
      {/* Pie */}
      <div className="flex-1">
        <h4 className="text-xs font-medium text-slate-500 mb-2 text-center">正收益来源（按大类）</h4>
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={100}
              dataKey="value"
              paddingAngle={2}
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
              labelLine={{ stroke: CHART_COLORS.text, strokeWidth: 0.5 }}
            >
              {pieData.map((entry, idx) => (
                <Cell key={idx} fill={getCategoryColor(entry.name)} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Bar */}
      <div className="flex-1">
        <h4 className="text-xs font-medium text-slate-500 mb-2 text-center">收益构成分解</h4>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={compData}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: CHART_COLORS.text }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11, fill: CHART_COLORS.text }} tickLine={false} axisLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={40}>
              {compData.map((entry, idx) => (
                <Cell key={idx} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
