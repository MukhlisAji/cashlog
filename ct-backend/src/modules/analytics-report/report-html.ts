import { BRAND_NAME } from "../../config/brand.js";
import { reportWordmarkDataUri } from "../../lib/brand-assets.js";
import type { AnalyticsData } from "../sheets/sheet-data.service.js";
import { formatMonthLabel, formatRupiah } from "../whatsapp/wa-sheet-queries.js";
import type { ComputedInsights } from "./analytics-insights.js";
import { getCategoryColor } from "./analytics-colors.js";

export type ReportKind = "monthly" | "midmonth" | "weekly";

export interface ReportHtmlInput {
  data: AnalyticsData;
  insights: ComputedInsights;
  colorMap: Record<string, string>;
  kind: ReportKind;
  generatedAt: string;
}

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function rp(amount: number): string {
  return `Rp ${formatRupiah(amount)}`;
}

function healthColor(score: number): string {
  if (score >= 80) return "#22c55e";
  if (score >= 60) return "#f59e0b";
  return "#ef4444";
}

function healthGradient(score: number): string {
  if (score >= 80) return "linear-gradient(135deg, rgba(34,197,94,0.15), rgba(34,197,94,0.03))";
  if (score >= 60) return "linear-gradient(135deg, rgba(245,158,11,0.15), rgba(245,158,11,0.03))";
  return "linear-gradient(135deg, rgba(239,68,68,0.15), rgba(239,68,68,0.03))";
}

function svgHealthRing(score: number, label: string): string {
  const size = 120;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (score / 100) * circumference;
  const color = healthColor(score);

  return `
    <svg width="${size}" height="${size}" style="transform: rotate(-90deg)">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#e5e7eb" stroke-width="${stroke}" />
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}"
        stroke-linecap="round" stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" />
    </svg>
    <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center">
      <span style="font-size:28px;font-weight:700;color:${color}">${score}</span>
      <span style="font-size:11px;color:#6b7280">${esc(label)}</span>
    </div>
  `;
}

function svgDonut(
  segments: { category: string; amount: number }[],
  colorMap: Record<string, string>,
): string {
  const total = segments.reduce((s, x) => s + x.amount, 0);
  if (total === 0) {
    return `<svg width="200" height="200"><circle cx="100" cy="100" r="70" fill="#f3f4f6"/></svg>`;
  }

  const size = 200;
  const cx = 100;
  const cy = 100;
  const outer = 78;
  const inner = 52;
  let startAngle = -Math.PI / 2;
  const paths: string[] = [];

  for (const seg of segments) {
    const angle = (seg.amount / total) * Math.PI * 2;
    const endAngle = startAngle + angle;
    const color = getCategoryColor(seg.category, colorMap);

    const x1 = cx + outer * Math.cos(startAngle);
    const y1 = cy + outer * Math.sin(startAngle);
    const x2 = cx + outer * Math.cos(endAngle);
    const y2 = cy + outer * Math.sin(endAngle);
    const x3 = cx + inner * Math.cos(endAngle);
    const y3 = cy + inner * Math.sin(endAngle);
    const x4 = cx + inner * Math.cos(startAngle);
    const y4 = cy + inner * Math.sin(startAngle);
    const large = angle > Math.PI ? 1 : 0;

    paths.push(
      `<path d="M ${x1} ${y1} A ${outer} ${outer} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${inner} ${inner} 0 ${large} 0 ${x4} ${y4} Z" fill="${color}" />`,
    );
    startAngle = endAngle;
  }

  const legend = segments
    .slice(0, 8)
    .map((seg) => {
      const pct = Math.round((seg.amount / total) * 100);
      const color = getCategoryColor(seg.category, colorMap);
      return `<div class="legend-row">
        <span class="legend-dot" style="background:${color}"></span>
        <span class="legend-label">${esc(seg.category)}</span>
        <span class="legend-value">${pct}% · ${rp(seg.amount)}</span>
      </div>`;
    })
    .join("");

  return `
    <div class="donut-wrap">
      <svg width="${size}" height="${size}" viewBox="0 0 200 200">${paths.join("")}</svg>
      <div class="donut-center">
        <div class="donut-total">${rp(total)}</div>
        <div class="donut-sub">Total</div>
      </div>
    </div>
    <div class="legend">${legend}</div>
  `;
}

function svgBars(
  items: { label: string; value: number; color?: string }[],
  maxValue?: number,
): string {
  const max = maxValue ?? Math.max(...items.map((i) => i.value), 1);
  const bars = items
    .map((item) => {
      const pct = Math.round((item.value / max) * 100);
      const color = item.color ?? "#22c55e";
      return `<div class="bar-row">
        <div class="bar-label">${esc(item.label)}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${color}"></div></div>
        <div class="bar-value">${rp(item.value)}</div>
      </div>`;
    })
    .join("");
  return `<div class="bars">${bars}</div>`;
}

function monthShort(month: string): string {
  const [, m] = month.split("-");
  const names = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  return names[Number(m) - 1] ?? m;
}

function recIcon(type: ComputedInsights["recommendations"][0]["type"]): string {
  switch (type) {
    case "warning":
      return "⚠️";
    case "success":
      return "✅";
    case "info":
      return "ℹ️";
    default:
      return "💡";
  }
}

function recBorder(type: ComputedInsights["recommendations"][0]["type"]): string {
  switch (type) {
    case "warning":
      return "#f59e0b";
    case "success":
      return "#22c55e";
    case "info":
      return "#3b82f6";
    default:
      return "#8b5cf6";
  }
}

export function buildAnalyticsReportHtml(input: ReportHtmlInput): string {
  const { data, insights, colorMap, kind, generatedAt } = input;
  const monthLabel = formatMonthLabel(data.activeMonth);
  const reportTitle =
    kind === "monthly"
      ? `Laporan Bulanan — ${monthLabel}`
      : kind === "weekly"
        ? `Laporan Mingguan — ${monthLabel}`
        : `Laporan Progress — ${monthLabel}`;

  const subtitle =
    kind === "monthly"
      ? "Ringkasan pengeluaran bulan penuh"
      : kind === "weekly"
        ? "Ringkasan pengeluaran minggu ini (Senin pagi)"
        : "Progress pengeluaran pertengahan bulan";

  const momTrend =
    insights.momChangePct !== null
      ? `<span class="trend ${insights.momChangePct >= 0 ? "up" : "down"}">${insights.momChangePct >= 0 ? "↑" : "↓"} ${Math.abs(insights.momChangePct)}% vs bulan lalu</span>`
      : "";

  const dailyBars = data.dailyTotals.slice(-14).map((d) => ({
    label: d.date.slice(8, 10),
    value: d.amount,
    color: "#22c55e",
  }));

  const weekdayBars = insights.weekdayPattern.map((d) => ({
    label: d.day,
    value: d.amount,
    color: "#3b82f6",
  }));

  const trendBars = insights.monthlyTrend.map((m) => ({
    label: monthShort(m.month),
    value: m.amount,
    color: m.month === data.activeMonth ? "#22c55e" : "#94a3b8",
  }));

  const budgetRows = data.budgets
    .map((b) => {
      const actual = data.categoryTotals.find((c) => c.category === b.category)?.amount ?? 0;
      const pct = b.amount > 0 ? Math.min(Math.round((actual / b.amount) * 100), 999) : 0;
      const color = pct > 100 ? "#ef4444" : pct > 85 ? "#f59e0b" : "#22c55e";
      const catColor = getCategoryColor(b.category, colorMap);
      return `<div class="budget-row">
        <div class="budget-head">
          <span><span class="legend-dot" style="background:${catColor}"></span> ${esc(b.category)}</span>
          <span>${rp(actual)} / ${rp(b.amount)} (${pct}%)</span>
        </div>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.min(pct, 100)}%;background:${color}"></div></div>
      </div>`;
    })
    .join("");

  const topItemsRows = insights.topItems
    .map(
      (item, i) => `<tr>
        <td>${i + 1}</td>
        <td>${esc(item.item)}</td>
        <td>${esc(item.category)}</td>
        <td>${item.count}×</td>
        <td class="num">${rp(item.amount)}</td>
      </tr>`,
    )
    .join("");

  const recs = insights.recommendations
    .map(
      (r) => `<div class="rec" style="border-left-color:${recBorder(r.type)}">
        <div class="rec-title">${recIcon(r.type)} ${esc(r.title)}</div>
        <div class="rec-desc">${esc(r.description)}</div>
      </div>`,
    )
    .join("");

  const wordmark = reportWordmarkDataUri();
  const brandMark = wordmark
    ? `<img class="logo" src="${wordmark}" alt="${esc(BRAND_NAME)}" />`
    : `<div class="logo-fallback">${esc(BRAND_NAME)}</div>`;

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #111827;
      background: #fff;
      font-size: 12px;
      line-height: 1.45;
    }
    .page { padding: 28px 32px; max-width: 820px; margin: 0 auto; }
    .brand { display: flex; align-items: center; gap: 14px; margin-bottom: 6px; }
    .logo {
      height: 40px; width: auto; max-width: 200px;
      object-fit: contain; object-position: left center;
      display: block; flex-shrink: 0;
    }
    .logo-fallback {
      font-weight: 800; font-size: 18px; color: #16a34a; letter-spacing: -0.02em;
    }
    h1 { font-size: 22px; font-weight: 700; }
    .subtitle { color: #6b7280; margin-top: 4px; font-size: 13px; }
    .meta { color: #9ca3af; font-size: 11px; margin-top: 6px; }
    .pro-badge {
      display: inline-block; background: rgba(245,158,11,0.15);
      color: #b45309; font-size: 10px; font-weight: 600;
      padding: 2px 8px; border-radius: 999px; margin-left: 8px;
    }
    .hero {
      margin-top: 20px; border-radius: 14px; padding: 18px 20px;
      border: 1px solid rgba(34,197,94,0.35);
      background: ${healthGradient(insights.healthScore)};
      display: flex; align-items: center; justify-content: space-between; gap: 16px;
    }
    .hero-left { display: flex; align-items: center; gap: 16px; }
    .ring-wrap { position: relative; width: 120px; height: 120px; flex-shrink: 0; }
    .hero-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; text-align: center; }
    .hero-stats .val { font-size: 20px; font-weight: 700; }
    .hero-stats .lbl { font-size: 10px; color: #6b7280; margin-top: 2px; }
    .kpi-grid {
      display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 14px;
    }
    .kpi {
      border: 1px solid #e5e7eb; border-radius: 12px; padding: 12px;
      background: #fafafa;
    }
    .kpi .title { font-size: 10px; color: #6b7280; }
    .kpi .value { font-size: 16px; font-weight: 700; margin-top: 4px; }
    .kpi .sub { font-size: 10px; color: #9ca3af; margin-top: 2px; }
    .trend { font-size: 10px; font-weight: 600; }
    .trend.up { color: #ef4444; }
    .trend.down { color: #22c55e; }
    .section { margin-top: 18px; }
    .section-title {
      font-size: 13px; font-weight: 700; margin-bottom: 8px;
      display: flex; align-items: center; gap: 6px;
    }
    .section-title .dot { width: 8px; height: 8px; border-radius: 50%; background: #22c55e; }
    .card {
      border: 1px solid #e5e7eb; border-radius: 12px; padding: 14px; background: #fff;
    }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .donut-wrap { position: relative; width: 200px; margin: 0 auto; }
    .donut-center {
      position: absolute; inset: 0; display: flex; flex-direction: column;
      align-items: center; justify-content: center; text-align: center;
    }
    .donut-total { font-size: 13px; font-weight: 700; }
    .donut-sub { font-size: 10px; color: #6b7280; }
    .legend { margin-top: 10px; }
    .legend-row {
      display: flex; align-items: center; gap: 8px; margin-bottom: 5px; font-size: 11px;
    }
    .legend-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .legend-label { flex: 1; }
    .legend-value { color: #6b7280; font-size: 10px; }
    .bars { display: flex; flex-direction: column; gap: 6px; }
    .bar-row { display: grid; grid-template-columns: 28px 1fr 72px; gap: 8px; align-items: center; }
    .bar-label { font-size: 10px; color: #6b7280; text-align: right; }
    .bar-track { height: 8px; background: #f3f4f6; border-radius: 999px; overflow: hidden; }
    .bar-fill { height: 100%; border-radius: 999px; }
    .bar-value { font-size: 10px; text-align: right; }
    .budget-row { margin-bottom: 10px; }
    .budget-head {
      display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px;
    }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th, td { padding: 6px 8px; text-align: left; border-bottom: 1px solid #f3f4f6; }
    th { color: #6b7280; font-weight: 600; font-size: 10px; }
    td.num { text-align: right; font-weight: 600; }
    .rec {
      border-left: 3px solid #22c55e; padding: 8px 10px; margin-bottom: 8px;
      background: #fafafa; border-radius: 0 8px 8px 0;
    }
    .rec-title { font-weight: 600; font-size: 11px; }
    .rec-desc { color: #6b7280; font-size: 10px; margin-top: 2px; }
    .footer {
      margin-top: 24px; padding-top: 12px; border-top: 1px solid #e5e7eb;
      text-align: center; color: #9ca3af; font-size: 10px;
    }
    .page-break { page-break-before: always; padding-top: 28px; }
  </style>
</head>
<body>
  <div class="page">
    <div class="brand">
      ${brandMark}
      <div>
        <h1>${esc(reportTitle)} <span class="pro-badge">Pro</span></h1>
        <div class="subtitle">${esc(subtitle)}</div>
        <div class="meta">Dibuat ${esc(generatedAt)} WIB · cashlog.id</div>
      </div>
    </div>

    <div class="hero">
      <div class="hero-left">
        <div class="ring-wrap">${svgHealthRing(insights.healthScore, insights.healthLabel)}</div>
        <div>
          <div style="font-size:15px;font-weight:700">Skor Kesehatan Keuangan</div>
          <div style="font-size:11px;color:#6b7280;margin-top:4px;max-width:280px">
            Berdasarkan budget, tren pengeluaran, dan pola konsumsi keluarga di ${esc(monthLabel)}.
          </div>
        </div>
      </div>
      <div class="hero-stats">
        <div><div class="lbl">Budget terpakai</div><div class="val">${insights.budgetUsedPct}%</div></div>
        <div><div class="lbl">Proyeksi akhir bulan</div><div class="val">${rp(insights.projectedMonthEnd)}</div></div>
      </div>
    </div>

    <div class="kpi-grid">
      <div class="kpi">
        <div class="title">Total Pengeluaran</div>
        <div class="value">${rp(data.summary.totalExpense)}</div>
        <div class="sub">${esc(monthLabel)} ${momTrend}</div>
      </div>
      <div class="kpi">
        <div class="title">Burn Rate Harian</div>
        <div class="value">${rp(insights.dailyBurnRate)}</div>
        <div class="sub">Rata-rata per hari</div>
      </div>
      <div class="kpi">
        <div class="title">Rata-rata Transaksi</div>
        <div class="value">${rp(data.summary.averagePerTransaction)}</div>
        <div class="sub">${data.summary.transactionCount} transaksi</div>
      </div>
      <div class="kpi">
        <div class="title">Budget Bulanan</div>
        <div class="value">${rp(insights.budgetTotal)}</div>
        <div class="sub">${
          insights.budgetUsedPct <= 100
            ? `Sisa ${rp(insights.budgetTotal - data.summary.totalExpense)}`
            : `Over ${rp(data.summary.totalExpense - insights.budgetTotal)}`
        }</div>
      </div>
    </div>

    <div class="section">
      <div class="section-title"><span class="dot"></span> Rekomendasi Pakar Keuangan Keluarga</div>
      ${recs}
    </div>

    <div class="section grid-2">
      <div class="card">
        <div class="section-title"><span class="dot"></span> Komposisi Pengeluaran</div>
        ${svgDonut(data.categoryTotals, colorMap)}
      </div>
      <div class="card">
        <div class="section-title"><span class="dot"></span> Tren 6 Bulan</div>
        ${svgBars(trendBars)}
      </div>
    </div>

    <div class="section grid-2">
      <div class="card">
        <div class="section-title"><span class="dot"></span> Pengeluaran Harian (14 hari terakhir)</div>
        ${dailyBars.length > 0 ? svgBars(dailyBars) : "<p style='color:#9ca3af'>Belum ada data harian</p>"}
      </div>
      <div class="card">
        <div class="section-title"><span class="dot"></span> Pola Hari dalam Seminggu</div>
        ${svgBars(weekdayBars)}
      </div>
    </div>

    <div class="page-break section">
      <div class="section-title"><span class="dot"></span> Progress Budget per Kategori</div>
      <div class="card">
        ${budgetRows || "<p style='color:#9ca3af'>Belum ada budget yang diatur</p>"}
      </div>
    </div>

    <div class="section">
      <div class="section-title"><span class="dot"></span> Top Pengeluaran</div>
      <div class="card">
        <table>
          <thead><tr><th>#</th><th>Item</th><th>Kategori</th><th>Freq</th><th style="text-align:right">Total</th></tr></thead>
          <tbody>${topItemsRows || "<tr><td colspan='5' style='color:#9ca3af'>Belum ada transaksi</td></tr>"}</tbody>
        </table>
      </div>
    </div>

    <div class="footer">
      Laporan otomatis ${esc(BRAND_NAME)} Pro · Kirim via WhatsApp · ${esc(generatedAt)} WIB
    </div>
  </div>
</body>
</html>`;
}
