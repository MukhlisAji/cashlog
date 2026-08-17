"use client";

import { formatRupiah } from "@/lib/format";
import { getCategoryColor } from "@/lib/analytics-utils";
import { ReportHoverRow } from "@/components/ui/report-motion";

interface TopExpensesListProps {
  items: { item: string; amount: number; count: number; category: string }[];
  colorMap?: Record<string, string>;
  limit?: number;
}

export function TopExpensesList({
  items,
  colorMap,
  limit = 5,
}: TopExpensesListProps) {
  const top = items.slice(0, limit);

  if (top.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Belum ada transaksi bulan ini
      </p>
    );
  }

  const max = top[0]?.amount ?? 1;

  return (
    <div className="flex flex-col gap-2">
      {top.map((item, i) => {
        const pct = Math.round((item.amount / max) * 100);
        const color = getCategoryColor(item.category, colorMap);
        return (
          <ReportHoverRow key={`${item.item}-${i}`} delay={60 + i * 50}>
            <div className="group flex flex-col gap-1 rounded-lg px-1 py-1.5">
              <div className="flex items-center gap-2">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold transition-colors group-hover:bg-primary/15 group-hover:text-primary">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{item.item}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {item.category} · {item.count}x
                  </p>
                </div>
                <p className="shrink-0 text-xs font-semibold tabular-nums">
                  {formatRupiah(item.amount)}
                </p>
              </div>
              <div className="ml-7 h-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out group-hover:brightness-110"
                  style={{ width: `${pct}%`, backgroundColor: color }}
                />
              </div>
            </div>
          </ReportHoverRow>
        );
      })}
    </div>
  );
}
