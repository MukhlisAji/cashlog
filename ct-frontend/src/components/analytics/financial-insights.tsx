"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Lightbulb,
} from "lucide-react";

import { ReportReveal } from "@/components/ui/report-motion";
import { cn } from "@/lib/utils";

interface Insight {
  type: "warning" | "tip" | "success" | "info";
  title: string;
  description: string;
}

const ICON_MAP = {
  warning: AlertTriangle,
  tip: Lightbulb,
  success: CheckCircle2,
  info: Info,
};

const STYLE_MAP = {
  warning: "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400",
  tip: "border-blue-500/30 bg-blue-500/5 text-blue-700 dark:text-blue-400",
  success: "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400",
  info: "border-violet-500/30 bg-violet-500/5 text-violet-700 dark:text-violet-400",
};

export function FinancialInsights({ insights }: { insights: Insight[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {insights.map((insight, i) => {
        const Icon = ICON_MAP[insight.type];
        return (
          <ReportReveal key={insight.title} delay={80 + i * 70}>
            <div
              className={cn(
                "group flex gap-3 rounded-xl border p-3 transition-all duration-300",
                "hover:-translate-y-0.5 hover:shadow-md hover:shadow-black/5",
                STYLE_MAP[insight.type],
              )}
            >
              <Icon className="mt-0.5 size-5 shrink-0 transition-transform duration-300 group-hover:scale-110" />
              <div>
                <p className="text-sm font-semibold">{insight.title}</p>
                <p className="mt-1 text-xs leading-relaxed opacity-90 transition-opacity group-hover:opacity-100">
                  {insight.description}
                </p>
              </div>
            </div>
          </ReportReveal>
        );
      })}
    </div>
  );
}
