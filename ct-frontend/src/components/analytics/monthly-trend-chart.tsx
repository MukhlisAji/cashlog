"use client";

import { useEffect, useRef, useState } from "react";

import { formatMonthLabel, formatRupiah } from "@/lib/format";
import { formatRupiahShort } from "@/lib/analytics-utils";

interface MonthlyTrendChartProps {
  data: { month: string; amount: number }[];
  activeMonth: string;
}

export function MonthlyTrendChart({ data, activeMonth }: MonthlyTrendChartProps) {
  const pathRef = useRef<SVGPathElement>(null);
  const [lineReady, setLineReady] = useState(false);
  const [lineLength, setLineLength] = useState(0);

  const width = 540;
  const height = 180;
  // Extra left padding because rupiah labels like "Rp 1,2jt" need more room
  // than padX=40 could provide — otherwise the leading "Rp" gets visually
  // clipped against the card boundary.
  const padX = 56;
  const padY = 24;
  const chartW = width - padX * 2;
  const chartH = height - padY * 2;

  const maxAmount = Math.max(...data.map((d) => d.amount), 1);
  const points = data.map((d, i) => {
    const x = padX + (i / Math.max(data.length - 1, 1)) * chartW;
    const y = padY + chartH - (d.amount / maxAmount) * chartH;
    return { ...d, x, y };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1]!.x} ${padY + chartH} L ${points[0]!.x} ${padY + chartH} Z`;

  useEffect(() => {
    if (data.length === 0) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setLineReady(true);
      return;
    }
    const len = pathRef.current?.getTotalLength() ?? 0;
    setLineLength(len);
    const frame = requestAnimationFrame(() => setLineReady(true));
    return () => cancelAnimationFrame(frame);
  }, [linePath, data.length]);

  if (data.length === 0) return null;

  return (
    <div className="w-full overflow-x-auto px-2">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full min-w-[360px]"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22c55e" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
          const y = padY + chartH * (1 - pct);
          return (
            <g key={pct}>
              <line
                x1={padX}
                y1={y}
                x2={width - padX}
                y2={y}
                stroke="currentColor"
                strokeOpacity={0.08}
              />
              <text
                x={padX - 8}
                y={y + 4}
                textAnchor="end"
                className="fill-muted-foreground text-[10px]"
              >
                {formatRupiahShort(maxAmount * pct)}
              </text>
            </g>
          );
        })}

        <path
          d={areaPath}
          fill="url(#trendGradient)"
          className="transition-opacity duration-700 ease-out"
          style={{ opacity: lineReady ? 1 : 0 }}
        />
        <path
          ref={pathRef}
          d={linePath}
          fill="none"
          stroke="#22c55e"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={lineLength || undefined}
          strokeDashoffset={lineReady ? 0 : lineLength}
          className="transition-[stroke-dashoffset] duration-1000 ease-out"
        />

        {points.map((p) => (
          <g key={p.month} className="group cursor-default">
            <circle
              cx={p.x}
              cy={p.y}
              r={p.month === activeMonth ? 6 : 4}
              fill={p.month === activeMonth ? "#22c55e" : "white"}
              stroke="#22c55e"
              strokeWidth={2}
              className="transition-all duration-300 group-hover:r-[7]"
              style={{
                opacity: lineReady ? 1 : 0,
                transitionDelay: lineReady ? "200ms" : "0ms",
              }}
            />
            <text
              x={p.x}
              y={height - 4}
              textAnchor="middle"
              className="fill-muted-foreground text-[9px]"
            >
              {formatMonthLabel(p.month).split(" ")[0]?.slice(0, 3)}
            </text>
            <title>
              {formatMonthLabel(p.month)}: {formatRupiah(p.amount)}
            </title>
          </g>
        ))}
      </svg>
    </div>
  );
}
