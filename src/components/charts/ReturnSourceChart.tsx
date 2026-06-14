import { useState } from "react";
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

const PIE_PALETTE_POS = [
  "#4472C4", "#2E75B6", "#5B9BD5", "#70AD47", "#548235",
  "#00B0F0", "#7030A0", "#FFC000",
];

const PIE_PALETTE_NEG = [
  "#C00000", "#E06666", "#CC3300", "#FF6347", "#B22222",
];

// Calculate label positions and resolve overlaps by spreading them vertically
const computeLabels = (cx: number, cy: number, outerRadius: number, data: { name: string; percent: number; midAngle: number }[]) => {
  const RADIAN = Math.PI / 180;
  const labelRadius = outerRadius + 16;
  const LINE_HEIGHT = 14;
  const MIN_GAP = 4;

  // Step 1: compute ideal positions
  type LabelInfo = {
    name: string;
    percent: number;
    midAngle: number;
    idealX: number;
    idealY: number;
    x: number;
    y: number;
    textAnchor: string;
  };

  const labels: LabelInfo[] = data.map((d) => {
    const midAngle = d.midAngle;
    const x = cx + labelRadius * Math.cos(-midAngle * RADIAN);
    const y = cy + labelRadius * Math.sin(-midAngle * RADIAN);
    return {
      name: d.name,
      percent: d.percent,
      midAngle,
      idealX: x,
      idealY: y,
      x,
      y,
      textAnchor: (x > cx ? "start" : "end") as "start" | "end",
    };
  });

  // Step 2: separate left and right sides, resolve overlaps per side
  const resolveSide = (items: LabelInfo[]) => {
    if (items.length <= 1) return;
    // sort by idealY
    items.sort((a, b) => a.idealY - b.idealY);
    // push down overlapping labels
    for (let i = 1; i < items.length; i++) {
      const prev = items[i - 1];
      const curr = items[i];
      const minTop = prev.y + LINE_HEIGHT + MIN_GAP;
      if (curr.y < minTop) {
        curr.y = minTop;
      }
    }
    // push up if any went too far below center
    for (let i = items.length - 2; i >= 0; i--) {
      const next = items[i + 1];
      const curr = items[i];
      const maxBottom = next.y - LINE_HEIGHT - MIN_GAP;
      if (curr.y > maxBottom) {
        curr.y = maxBottom;
      }
    }
  };

  const rightSide = labels.filter((l) => l.textAnchor === "start");
  const leftSide = labels.filter((l) => l.textAnchor === "end");
  resolveSide(rightSide);
  resolveSide(leftSide);

  return labels;
};

// Custom label renderer using pre-computed positions
const renderPieLabel = (props: any) => {
  const { cx, cy, outerRadius, percent, name, midAngle, index } = props;

  const labels = props.allLabels as ReturnType<typeof computeLabels> | undefined;
  const label = labels?.[index];
  const rawValues = props.rawValues as number[] | undefined;

  if (!label) return null;

  const RADIAN = Math.PI / 180;
  const edgeX = cx + outerRadius * Math.cos(-midAngle * RADIAN);
  const edgeY = cy + outerRadius * Math.sin(-midAngle * RADIAN);

  const rawVal = rawValues?.[index];
  const valStr = rawVal != null
    ? `${rawVal >= 0 ? '+' : ''}${rawVal.toFixed(2)}万`
    : `${(percent * 100).toFixed(1)}%`;

  return (
    <g>
      <line
        x1={edgeX}
        y1={edgeY}
        x2={label.x + (label.textAnchor === "start" ? -4 : 4)}
        y2={label.y}
        stroke={CHART_COLORS.text}
        strokeWidth={0.5}
      />
      <text
        x={label.x}
        y={label.y}
        textAnchor={label.textAnchor as "start" | "end"}
        dominantBaseline="central"
        fill={CHART_COLORS.textDark}
        fontSize={11}
        fontFamily={CHART_FONT.family}
      >
        <tspan>{label.name}</tspan>
        <tspan fill={rawVal != null && rawVal < 0 ? "#C00000" : CHART_COLORS.text}> {valStr}</tspan>
      </text>
    </g>
  );
};

export default function ReturnSourceChart({ assets, fees }: Props) {
  const [activePieIndex, setActivePieIndex] = useState<number | null>(null);

  // Pie: group by category (net return, including negative)
  const catMap: Record<string, number> = {};
  for (const a of assets) {
    const cat = a["资产类别"];
    catMap[cat] = (catMap[cat] || 0) + a["本期总收益(万)"];
  }
  // Use absolute values for pie sizing, but keep sign info for coloring
  const pieData = Object.entries(catMap)
    .filter(([, value]) => value !== 0)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({
      name,
      value: Math.round(Math.abs(value) * 100) / 100,
      rawValue: Math.round(value * 100) / 100,
      isPositive: value >= 0,
    }));

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
    const rawVal = d.rawValue ?? d.value;
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-2 shadow text-xs">
        <span className="text-slate-600">{d.name}: </span>
        <span className={rawVal >= 0 ? "text-brand-600 font-semibold" : "text-red-500 font-semibold"}>
          {rawVal >= 0 ? "+" : ""}{rawVal.toFixed(2)} 万
        </span>
      </div>
    );
  };

  // Pre-compute label positions for anti-overlap
  const totalValue = pieData.reduce((s, d) => s + d.value, 0);
  const pieDataWithAngle = pieData.map((d, i) => {
    const percent = d.value / totalValue;
    // Calculate midAngle based on cumulative angles
    let cumPercent = 0;
    for (let j = 0; j < i; j++) cumPercent += pieData[j].value / totalValue;
    const startAngle = cumPercent * 360;
    const endAngle = (cumPercent + percent) * 360;
    const midAngle = (startAngle + endAngle) / 2;
    return { ...d, percent, midAngle };
  });

  // Approximate cx/cy/outerRadius for label computation
  // ResponsiveContainer will set actual size, we use reasonable defaults
  const labelCx = 352;
  const labelCy = 144;
  const labelOuterRadius = 95;
  const allLabels = computeLabels(labelCx, labelCy, labelOuterRadius, pieDataWithAngle);

  // Custom legend for pie chart
  const renderLegend = (props: any) => {
    const { payload } = props;
    return (
      <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center mt-2">
        {payload.map((entry: any, idx: number) => {
          const item = pieData[idx];
          if (!item) return null;
          const valStr = `${item.rawValue >= 0 ? '+' : ''}${item.rawValue.toFixed(2)}万`;
          return (
            <div key={idx} className="flex items-center gap-1.5 text-xs">
              <span
                className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-slate-600">{item.name}</span>
              <span className={item.isPositive ? "text-slate-400" : "text-red-500"}>{valStr}</span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Pie */}
      <div className="flex-1 min-w-0">
        <h4 className="text-xs font-medium text-slate-500 mb-2 text-center">收益来源（按大类净收益）</h4>
        <ResponsiveContainer width="100%" height={340}>
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="45%"
              innerRadius={55}
              outerRadius={95}
              dataKey="value"
              paddingAngle={2}
              label={(props: any) => renderPieLabel({ ...props, allLabels, rawValues: pieData.map(d => d.rawValue) })}
              labelLine={false}
              minAngle={3}
              onClick={(_: any, index: number) => setActivePieIndex(activePieIndex === index ? null : index)}
            >
              {pieData.map((d, idx) => {
                const RADIAN = Math.PI / 180;
                const midAngle = pieDataWithAngle[idx]?.midAngle ?? 0;
                const explodeX = 10 * Math.cos(-midAngle * RADIAN);
                const explodeY = 10 * Math.sin(-midAngle * RADIAN);
                const isActive = activePieIndex === idx;
                const isDimmed = activePieIndex !== null && !isActive;
                // Positive = blue shades, Negative = red shades
                const fillColor = d.isPositive
                  ? PIE_PALETTE_POS[idx % PIE_PALETTE_POS.length]
                  : PIE_PALETTE_NEG[idx % PIE_PALETTE_NEG.length];

                return (
                  <Cell
                    key={idx}
                    fill={fillColor}
                    style={{
                      transform: isActive ? `translate(${explodeX}px, ${explodeY}px) scale(1.05)` : 'translate(0, 0) scale(1)',
                      transition: 'transform 0.3s ease, opacity 0.3s ease',
                      opacity: isDimmed ? 0.45 : 1,
                      cursor: 'pointer',
                      outline: 'none',
                      transformOrigin: 'center center',
                    }}
                  />
                );
              })}
            </Pie>
            <Legend content={renderLegend} />
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Bar */}
      <div className="flex-1 min-w-0">
        <h4 className="text-xs font-medium text-slate-500 mb-2 text-center">收益构成分解</h4>
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={compData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: CHART_COLORS.text, fontFamily: CHART_FONT.family }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: CHART_COLORS.text, fontFamily: CHART_FONT.family }}
              tickLine={false}
              axisLine={false}
              width={60}
            />
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
