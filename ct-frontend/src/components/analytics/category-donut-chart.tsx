"use client";

import { useEffect, useState } from "react";

import { getCategoryColor } from "@/lib/analytics-utils";
import { formatRupiah } from "@/lib/format";

interface DonutSegment {
  category: string;
  amount: number;
  archived?: boolean;
}

interface CategoryDonutChartProps {
  segments: DonutSegment[];
  size?: number;
  selectedCategory?: string | null;
  onSelect?: (category: string | null) => void;
  colorMap?: Record<string, string>;
}

export function CategoryDonutChart({
  segments,
  size = 200,
  selectedCategory,
  onSelect,
  colorMap,
}: CategoryDonutChartProps) {
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

  const total = segments.reduce((s, seg) => s + seg.amount, 0);
  if (total === 0) return null;

  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 8;
  const innerR = outerR * 0.62;

  let angle = -90;
  const paths = segments.map((seg) => {
    const pct = seg.amount / total;
    const sweep = pct * 360;
    const startAngle = angle;
    angle += sweep;
    const endAngle = angle;

    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;

    const x1o = cx + outerR * Math.cos(startRad);
    const y1o = cy + outerR * Math.sin(startRad);
    const x2o = cx + outerR * Math.cos(endRad);
    const y2o = cy + outerR * Math.sin(endRad);
    const x1i = cx + innerR * Math.cos(endRad);
    const y1i = cy + innerR * Math.sin(endRad);
    const x2i = cx + innerR * Math.cos(startRad);
    const y2i = cy + innerR * Math.sin(startRad);

    const largeArc = sweep > 180 ? 1 : 0;
    const d = [
      `M ${x1o} ${y1o}`,
      `A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2o} ${y2o}`,
      `L ${x1i} ${y1i}`,
      `A ${innerR} ${innerR} 0 ${largeArc} 0 ${x2i} ${y2i}`,
      "Z",
    ].join(" ");

    return { ...seg, d, pct, color: getCategoryColor(seg.category, colorMap) };
  });

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-6">
      <div className="relative shrink-0 transition-transform duration-300 hover:scale-[1.02]">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {paths.map((p, i) => (
            <path
              key={p.category}
              d={p.d}
              fill={p.color}
              opacity={
                selectedCategory && selectedCategory !== p.category
                  ? 0.35
                  : mounted
                    ? 1
                    : 0
              }
              className="cursor-pointer transition-all duration-500 hover:opacity-90"
              style={{ transitionDelay: `${i * 60}ms` }}
              onClick={() =>
                onSelect?.(selectedCategory === p.category ? null : p.category)
              }
            >
              <title>
                {p.category}: {formatRupiah(p.amount)} ({Math.round(p.pct * 100)}%)
              </title>
            </path>
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs text-muted-foreground">Total</span>
          <span className="text-sm font-bold">{formatRupiah(total)}</span>
        </div>
      </div>
      <div className="flex w-full flex-col gap-2">
        {paths.map((p) => (
          <button
            key={p.category}
            type="button"
            onClick={() =>
              onSelect?.(selectedCategory === p.category ? null : p.category)
            }
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-all hover:bg-muted/50 hover:pl-3"
          >
            <span
              className="size-3 shrink-0 rounded-full"
              style={{ backgroundColor: p.color }}
            />
            <span className="flex-1 font-medium">
              {p.category}
              {p.archived && (
                <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">
                  (arsip)
                </span>
              )}
            </span>
            <span className="text-muted-foreground">
              {Math.round(p.pct * 100)}%
            </span>
            <span className="font-semibold">{formatRupiah(p.amount)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
