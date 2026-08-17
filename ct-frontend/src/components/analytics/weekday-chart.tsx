"use client";

import { useEffect, useState } from "react";

import { formatRupiah } from "@/lib/format";
import { formatRupiahShort } from "@/lib/analytics-utils";
import { cn } from "@/lib/utils";

interface WeekdayChartProps {
  data: { day: string; amount: number; count: number }[];
  compact?: boolean;
}

const WEEKEND_DAYS = new Set(["Sab", "Min"]);

export function WeekdayChart({ data, compact = false }: WeekdayChartProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setMounted(true);
      return;
    }
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const max = Math.max(...data.map((d) => d.amount), 1);
  const total = data.reduce((s, d) => s + d.amount, 0);
  const weekdayTotal = data
    .filter((d) => !WEEKEND_DAYS.has(d.day))
    .reduce((s, d) => s + d.amount, 0);
  const weekendTotal = total - weekdayTotal;
  const busiest = [...data].sort((a, b) => b.amount - a.amount)[0];

  const width = 480;
  const height = compact ? 150 : 200;
  const padLeft = 44;
  const padRight = 8;
  const padTop = compact ? 22 : 28;
  const padBottom = compact ? 28 : 36;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;
  const barGap = 6;
  const barW = (chartW - barGap * (data.length - 1)) / data.length;

  const yTicks = compact ? [0, 0.5, 1] : [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className={cn("flex flex-col", compact ? "gap-2" : "gap-3")}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Grafik pengeluaran per hari dalam seminggu"
      >
        {yTicks.map((pct) => {
          const y = padTop + chartH * (1 - pct);
          return (
            <g key={pct}>
              <line
                x1={padLeft}
                y1={y}
                x2={width - padRight}
                y2={y}
                stroke="currentColor"
                strokeOpacity={0.08}
              />
              <text
                x={padLeft - 4}
                y={y + 3}
                textAnchor="end"
                className="fill-muted-foreground text-[8px]"
              >
                {pct === 0 ? "0" : formatRupiahShort(max * pct)}
              </text>
            </g>
          );
        })}

        {data.map((d, i) => {
          const fullBarH = d.amount > 0 ? Math.max(3, (d.amount / max) * chartH) : 0;
          const barH = mounted ? fullBarH : 0;
          const x = padLeft + i * (barW + barGap);
          const y = padTop + chartH - barH;
          const isWeekend = WEEKEND_DAYS.has(d.day);
          const fill = isWeekend ? "#f59e0b" : "#22c55e";

          return (
            <g key={d.day} className="group cursor-default">
              {d.amount > 0 && (
                <>
                  <text
                    x={x + barW / 2}
                    y={y - (compact ? 10 : 14)}
                    textAnchor="middle"
                    className="fill-foreground text-[7px] font-semibold"
                  >
                    {formatRupiahShort(d.amount)}
                  </text>
                  {!compact && (
                    <text
                      x={x + barW / 2}
                      y={y - 5}
                      textAnchor="middle"
                      className="fill-muted-foreground text-[6px]"
                    >
                      {d.count}x
                    </text>
                  )}
                </>
              )}
              {d.amount === 0 && (
                <text
                  x={x + barW / 2}
                  y={padTop + chartH - 4}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[7px]"
                >
                  —
                </text>
              )}
              <rect
                x={x}
                y={y}
                width={barW}
                height={barH}
                rx={2}
                fill={fill}
                opacity={isWeekend ? 0.85 : 0.75}
                className="transition-[height,y] duration-700 ease-out group-hover:opacity-100"
                style={{ transitionDelay: `${i * 50}ms` }}
              >
                <title>
                  {d.day}: {formatRupiah(d.amount)} ({d.count} transaksi)
                </title>
              </rect>
              <text
                x={x + barW / 2}
                y={height - 8}
                textAnchor="middle"
                className={
                  isWeekend
                    ? "fill-amber-600 text-[9px] font-semibold"
                    : "fill-muted-foreground text-[9px]"
                }
              >
                {d.day}
              </text>
            </g>
          );
        })}

        <line
          x1={padLeft}
          y1={padTop + chartH}
          x2={width - padRight}
          y2={padTop + chartH}
          stroke="currentColor"
          strokeOpacity={0.15}
        />
      </svg>

      <div className="grid grid-cols-3 gap-1.5 text-center">
        <div className="rounded-md border bg-muted/30 px-1.5 py-1.5 transition-colors hover:bg-muted/50">
          <p className="text-[9px] text-muted-foreground">Sen–Jum</p>
          <p className="text-[11px] font-semibold">{formatRupiahShort(weekdayTotal)}</p>
        </div>
        <div className="rounded-md border border-amber-500/20 bg-amber-500/5 px-1.5 py-1.5 transition-colors hover:bg-amber-500/10">
          <p className="text-[9px] text-amber-700 dark:text-amber-400">Sab–Min</p>
          <p className="text-[11px] font-semibold">{formatRupiahShort(weekendTotal)}</p>
        </div>
        <div className="rounded-md border bg-muted/30 px-1.5 py-1.5 transition-colors hover:bg-muted/50">
          <p className="text-[9px] text-muted-foreground">Tersibuk</p>
          <p className="text-[11px] font-semibold">{busiest?.day ?? "—"}</p>
        </div>
      </div>

      <div className="flex items-center justify-center gap-3 text-[9px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="size-2 rounded-sm bg-emerald-500/75" />
          Kerja
        </span>
        <span className="flex items-center gap-1">
          <span className="size-2 rounded-sm bg-amber-500/85" />
          Weekend
        </span>
      </div>
    </div>
  );
}
