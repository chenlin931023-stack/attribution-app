import type { ReactNode } from "react";

interface OverviewItem {
  label: string;
  value: string;
  sub: string;
  icon: ReactNode;
  accent: string;
}

interface Props {
  items: OverviewItem[];
}

export default function OverviewCards({ items }: Props) {
  return (
    <div className="grid grid-cols-4 gap-4">
      {items.map((item, i) => (
        <div
          key={i}
          className="bg-white rounded-xl border border-slate-200 card-shadow p-4
                     hover:card-shadow-hover transition-shadow"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className={`${item.accent.replace("text-", "text-")}`}>{item.icon}</div>
            <span className="text-xs text-slate-400 font-medium">{item.label}</span>
          </div>
          <p className={`text-lg font-bold tracking-tight ${item.accent}`}>{item.value}</p>
          <p className="text-xs text-slate-400 mt-1 truncate">{item.sub}</p>
        </div>
      ))}
    </div>
  );
}
