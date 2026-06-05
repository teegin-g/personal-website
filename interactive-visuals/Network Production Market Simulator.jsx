import React, { useMemo, useState } from "react";
import * as d3 from "d3";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Activity,
  BarChart3,
  Bug,
  Database,
  Network,
  RotateCcw,
  Rocket,
  SlidersHorizontal,
  TrendingUp,
  Users,
} from "lucide-react";

const DEFAULTS = {
  userPrice: 12.0,
  userNetworkSpend: 0.62,
  userAdoptionSpend: 0.55,
  seed: 42,
  nCompetitors: 38,
  marketSize: 100000,
  periods: 60,
  demandSensitivity: 2.2,
  shareAdjustment: 0.16,
  baseAlpha: 1.15,
  networkReturns: 0.58,
  dataLearning: 0.18,
  congestionPenalty: 0.45,
  churnDrag: 0.18,
};

const VISUALS = [
  { key: "share", label: "Share over time" },
  { key: "network", label: "Network production" },
  { key: "profit", label: "Profit over time" },
  { key: "utility", label: "Utility decomposition" },
  { key: "structure", label: "Market structure" },
];

const TIME_FILTERS = [
  { key: "default", label: "Default" },
  { key: "all", label: "All firms" },
  { key: "top10", label: "Top 10" },
  { key: "bottom10", label: "Bottom 10" },
  { key: "topBottom10", label: "Top + bottom 10" },
  { key: "top20", label: "Top 20" },
];

function mulberry32(seed) {
  return function random() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normalRandom(random, mean, sd) {
  const u1 = Math.max(random(), 1e-12);
  const u2 = Math.max(random(), 1e-12);
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + sd * z;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function formatPct(value, digits = 1) {
  if (!Number.isFinite(value)) return "--";
  return `${(value * 100).toFixed(digits)}%`;
}

function formatMoney(value, digits = 0) {
  if (!Number.isFinite(value)) return "--";
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits })}`;
}

function formatCompact(value) {
  return d3.format("~s")(value).replace("G", "B");
}

function safeSum(values, accessor = (d) => d) {
  return values.reduce((total, value) => total + accessor(value), 0);
}

function softmax(values) {
  const max = Math.max(...values);
  const exp = values.map((v) => Math.exp(v - max));
  const total = d3.sum(exp) || 1;
  return exp.map((x) => x / total);
}

function Tooltip({ x, y, children, className = "" }) {
  const left = x > 285 ? x - 260 : x + 12;
  const top = y > 210 ? y - 180 : y + 18;

  return (
    <div
      className={`pointer-events-none absolute z-30 min-w-[165px] rounded-2xl border border-slate-200 bg-white/95 px-3 py-2 text-xs text-slate-700 shadow-xl backdrop-blur ${className}`}
      style={{ left, top }}
    >
      {children}
    </div>
  );
}

function Slider({ label, value, min, max, step, onChange, suffix = "", prefix = "", hint, comparisonLabel, comparisonValue }) {
  const displayValue = `${prefix}${Number(value).toLocaleString(undefined, { maximumFractionDigits: step < 1 ? 2 : 0 })}${suffix}`;

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-slate-800">{label}</div>
          {hint && <div className="text-xs text-slate-500">{hint}</div>}
        </div>

        {comparisonLabel ? (
          <div className="grid min-w-[150px] grid-cols-2 overflow-hidden rounded-2xl border border-slate-200 bg-white text-center shadow-sm">
            <div className="border-r border-slate-200 px-2 py-1.5">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">User</div>
              <div className="text-sm font-semibold tabular-nums text-slate-900">{displayValue}</div>
            </div>
            <div className="px-2 py-1.5">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Market Avg.</div>
              <div className="text-sm font-semibold tabular-nums text-slate-700">{comparisonValue}</div>
            </div>
          </div>
        ) : (
          <div className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold tabular-nums text-slate-800">
            {displayValue}
          </div>
        )}
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-slate-900"
      />
    </div>
  );
}

function NumberCell({ value, onChange, min, max, step = 1, prefix = "" }) {
  return (
    <div className="flex items-center overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm focus-within:border-slate-400">
      {prefix && <span className="border-r border-slate-100 px-2 text-xs font-semibold text-slate-400">{prefix}</span>}
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full bg-transparent px-2 py-2 text-right text-xs font-semibold tabular-nums text-slate-800 outline-none"
      />
    </div>
  );
}

function DebugTabButton({ active, children, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
        active ? "bg-slate-950 text-white shadow-sm" : "bg-white text-slate-600 hover:bg-slate-100"
      }`}
    >
      {children}
    </button>
  );
}

function MetricCard({ icon: Icon, label, value, sublabel }) {
  return (
    <Card className="rounded-2xl border-slate-200 bg-white/85 shadow-sm backdrop-blur">
      <CardContent className="p-4">
        <div className="mb-3 flex items-center gap-2 text-slate-500">
          <Icon className="h-4 w-4" />
          <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
        </div>
        <div className="text-2xl font-semibold tracking-tight text-slate-950">{value}</div>
        <div className="mt-1 text-xs text-slate-500">{sublabel}</div>
      </CardContent>
    </Card>
  );
}

function AxisLabel({ children, className = "" }) {
  return <div className={`text-[11px] font-medium text-slate-500 ${className}`}>{children}</div>;
}

function buildFirms(params) {
  const random = mulberry32(params.seed);
  const competitors = Array.from({ length: params.nCompetitors }, (_, idx) => ({
    id: `firm-${idx + 1}`,
    label: `Firm ${idx + 1}`,
    isUser: false,
    price: clamp(normalRandom(random, 12.2, 0.75), 8.5, 16.5),
    quality: clamp(normalRandom(random, 8.2, 0.55), 5.8, 10.5),
    unitCost: clamp(normalRandom(random, 5.8, 0.75), 3.5, 9.0),
    fixedCost: clamp(normalRandom(random, 900, 240), 250, 2400),
    friction: clamp(normalRandom(random, 0.38, 0.16), 0.05, 1.25),
    initialWeight: clamp(normalRandom(random, 1, 0.32), 0.18, 2.4),
    networkSpend: clamp(normalRandom(random, 0.5, 0.22), 0.05, 1.35),
    adoptionSpend: clamp(normalRandom(random, 0.48, 0.22), 0.05, 1.35),
    ecosystemBase: clamp(normalRandom(random, 1.0, 0.26), 0.3, 1.8),
    matchingBase: clamp(normalRandom(random, 1.0, 0.25), 0.3, 1.8),
    trustBase: clamp(normalRandom(random, 1.0, 0.25), 0.3, 1.8),
    interopBase: clamp(normalRandom(random, 0.9, 0.28), 0.2, 1.8),
    onboardingBase: clamp(normalRandom(random, 1.0, 0.25), 0.3, 1.8),
    seedingBase: clamp(normalRandom(random, 0.9, 0.28), 0.25, 1.8),
    viralityBase: clamp(normalRandom(random, 0.85, 0.3), 0.2, 1.8),
    capacityShare: clamp(normalRandom(random, 0.14, 0.05), 0.035, 0.32),
  }));

  const user = {
    id: "user",
    label: "Your firm",
    isUser: true,
    price: params.userPrice,
    quality: 8.25,
    unitCost: 5.75,
    fixedCost: 950,
    friction: 0.34,
    initialWeight: 1,
    networkSpend: params.userNetworkSpend,
    adoptionSpend: params.userAdoptionSpend,
    ecosystemBase: 1.0,
    matchingBase: 1.0,
    trustBase: 1.0,
    interopBase: 0.95,
    onboardingBase: 1.0,
    seedingBase: 0.95,
    viralityBase: 0.85,
    capacityShare: 0.16,
  };

  return [user, ...competitors];
}

function computeFirmRow(firm, share, dataStock, params) {
  const ecosystem = firm.ecosystemBase + 1.55 * Math.pow(firm.networkSpend, 0.74);
  const matching = firm.matchingBase + 1.25 * Math.pow(firm.networkSpend, 0.62);
  const trust = firm.trustBase + 0.95 * Math.pow(firm.networkSpend, 0.68);
  const interop = firm.interopBase + 0.75 * Math.pow(firm.networkSpend, 0.8);
  const onboarding = firm.onboardingBase + 1.35 * Math.pow(firm.adoptionSpend, 0.7);
  const seeding = firm.seedingBase + 1.65 * Math.pow(firm.adoptionSpend, 0.76);
  const virality = firm.viralityBase + 0.72 * Math.pow(firm.adoptionSpend, 0.64);

  const alpha = params.baseAlpha * (0.58 + 0.17 * ecosystem + 0.15 * matching + 0.13 * trust + 0.08 * interop);
  const reach = 0.54 + 0.17 * onboarding + 0.22 * seeding + 0.18 * virality;
  const rawNetwork = Math.pow(Math.max(share, 1 / params.marketSize), params.networkReturns);
  const networkMultiplier = 0.62 + 0.16 * ecosystem + 0.15 * matching + 0.11 * trust + 0.08 * interop;
  const dataMultiplier = 1 + params.dataLearning * Math.log1p(Math.max(dataStock, 0));
  const congestion = params.congestionPenalty * Math.max(0, share - firm.capacityShare) ** 2 * 100;
  const effectiveNetwork = Math.max(0.0001, rawNetwork * networkMultiplier * dataMultiplier - congestion);
  const quantity = share * params.marketSize;
  const revenue = firm.price * quantity;
  const networkCost = 4200 * Math.pow(firm.networkSpend, 1.45);
  const adoptionCost = 3600 * Math.pow(firm.adoptionSpend, 1.35);
  const cost = firm.fixedCost + firm.unitCost * quantity + networkCost + adoptionCost;
  const profit = revenue - cost;
  const margin = revenue > 0 ? profit / revenue : -1;
  const standaloneUtility = firm.quality - firm.price - firm.friction;
  const networkUtility = alpha * Math.log1p(8 * effectiveNetwork);
  const utility = standaloneUtility + networkUtility;

  return {
    ...firm,
    share,
    quantity,
    revenue,
    cost,
    networkCost,
    adoptionCost,
    profit,
    margin,
    ecosystem,
    matching,
    trust,
    interop,
    onboarding,
    seeding,
    virality,
    alpha,
    reach,
    rawNetwork,
    networkMultiplier,
    dataMultiplier,
    congestion,
    effectiveNetwork,
    standaloneUtility,
    networkUtility,
    utility,
    alive: true,
  };
}

function simulateMarket(firms, params) {
  const initialTotal = d3.sum(firms, (firm) => firm.initialWeight) || 1;
  let shares = firms.map((firm) => firm.initialWeight / initialTotal);
  let dataStocks = firms.map((firm) => Math.max(1, firm.initialWeight * 25));
  const history = [];

  for (let t = 0; t <= params.periods; t++) {
    const rows = firms.map((firm, i) => computeFirmRow(firm, shares[i], dataStocks[i], params));
    const user = rows.find((row) => row.isUser) ?? rows[0];
    const ranked = [...rows].sort((a, b) => b.share - a.share);
    const topRival = ranked.find((row) => !row.isUser);
    const topFiveShare = d3.sum(ranked.slice(0, 5), (row) => row.share);
    const tailShare = Math.max(0, 1 - user.share - (topRival?.share ?? 0));
    const hhi = d3.sum(rows, (row) => row.share * row.share);

    history.push({
      t,
      rows,
      hhi,
      topFiveShare,
      tailShare,
      userShare: user.share,
      userProfit: user.profit,
      userUtility: user.utility,
      userMargin: user.margin,
      topRivalShare: topRival?.share ?? 0,
      topRival,
    });

    if (t === params.periods) break;

    const targetShares = softmax(rows.map((row) => params.demandSensitivity * row.utility));
    const nextShares = rows.map((row, i) => {
      const gap = targetShares[i] - shares[i];
      const inertia = gap < 0 ? 1 - params.churnDrag : 1;
      return Math.max(0, shares[i] + params.shareAdjustment * row.reach * gap * inertia);
    });

    const total = d3.sum(nextShares) || 1;
    shares = nextShares.map((share) => share / total);
    dataStocks = dataStocks.map((stock, i) => 0.92 * stock + 0.08 * Math.sqrt(Math.max(shares[i] * params.marketSize, 0)));
  }

  return history;
}

function getMetricValue(row, metricKey) {
  if (!row) return 0;
  if (metricKey === "profit") return row.profit ?? 0;
  if (metricKey === "utility") return row.utility ?? 0;
  if (metricKey === "networkUtility") return row.networkUtility ?? 0;
  if (metricKey === "effectiveNetwork") return row.effectiveNetwork ?? 0;
  return row.share ?? 0;
}

function buildFirmTimeSeries(history, filterKey, metricKey = "share") {
  const finalRows = history[history.length - 1].rows;
  const ranked = [...finalRows].sort((a, b) => b.share - a.share);
  const userId = "user";

  let selectedIds;
  if (filterKey === "all") {
    selectedIds = new Set(finalRows.map((row) => row.id));
  } else if (filterKey === "top10") {
    selectedIds = new Set(ranked.slice(0, 10).map((row) => row.id));
    selectedIds.add(userId);
  } else if (filterKey === "bottom10") {
    selectedIds = new Set(ranked.slice(-10).map((row) => row.id));
    selectedIds.add(userId);
  } else if (filterKey === "topBottom10") {
    selectedIds = new Set([...ranked.slice(0, 10), ...ranked.slice(-10)].map((row) => row.id));
    selectedIds.add(userId);
  } else if (filterKey === "top20") {
    selectedIds = new Set(ranked.slice(0, 20).map((row) => row.id));
    selectedIds.add(userId);
  } else if (metricKey === "share") {
    return [
      {
        id: "user",
        label: "Your firm",
        isUser: true,
        width: 4,
        values: history.map((period) => ({ t: period.t, value: period.userShare, meta: period.rows.find((row) => row.id === "user") })),
      },
      {
        id: "top-rival",
        label: "Top competitor",
        isAggregate: true,
        width: 3,
        values: history.map((period) => ({ t: period.t, value: period.topRivalShare, meta: period.topRival })),
      },
      {
        id: "tail",
        label: "Long tail",
        isAggregate: true,
        width: 3,
        values: history.map((period) => ({ t: period.t, value: period.tailShare, meta: { label: "Long tail", share: period.tailShare } })),
      },
    ];
  } else {
    selectedIds = new Set([userId, ...ranked.filter((row) => !row.isUser).slice(0, 5).map((row) => row.id)]);
  }

  return finalRows
    .filter((firm) => selectedIds.has(firm.id))
    .sort((a, b) => (a.isUser ? -1 : b.isUser ? 1 : b.share - a.share))
    .map((firm) => ({
      id: firm.id,
      label: firm.label,
      isUser: firm.isUser,
      width: firm.isUser ? 4 : 1.6,
      values: history.map((period) => {
        const row = period.rows.find((item) => item.id === firm.id);
        return { t: period.t, value: getMetricValue(row, metricKey), meta: row };
      }),
    }));
}

function HtmlLineChart({
  history,
  series,
  yLabel,
  valueFormat,
  metricLabel = "Value",
  heightClass = "h-[500px]",
  showMany = false,
  periodTableTooltip = false,
}) {
  const [hover, setHover] = useState(null);
  const allPoints = series.flatMap((s) => s.values.map((p) => p.value).filter(Number.isFinite));
  const xExtent = d3.extent(history, (d) => d.t);
  const yExtent = d3.extent(allPoints.length ? allPoints : [0, 1]);
  const yLow = yExtent?.[0] ?? 0;
  const yHigh = yExtent?.[1] ?? 1;
  const pad = Math.max(0.01, (yHigh - yLow) * 0.12);
  const xScale = d3.scaleLinear().domain(xExtent).range([0, 100]);
  const yScale = d3.scaleLinear().domain([Math.min(0, yLow - pad), yHigh + pad]).range([100, 0]).nice();
  const xTicks = xScale.ticks(6);
  const yTicks = yScale.ticks(5);

  const getColorClass = (s, index) => {
    if (s.isUser) return "bg-slate-950";
    if (s.id === "top-rival") return "bg-slate-500";
    if (s.id === "tail") return "bg-slate-300";
    if (s.id === "hhi") return "bg-slate-950";
    if (s.id === "top-five") return "bg-slate-500";
    return index % 2 === 0 ? "bg-slate-500" : "bg-slate-400";
  };

  const getOpacity = (s) => {
    if (s.isUser || s.id === "hhi") return 1;
    if (s.isAggregate) return 0.9;
    return showMany ? 0.38 : 0.65;
  };

  const setPeriodHover = (event) => {
    if (!periodTableTooltip) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const xPct = clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100);
    const rawT = xScale.invert(xPct);
    const nearest = history.reduce((best, period) => (Math.abs(period.t - rawT) < Math.abs(best.t - rawT) ? period : best), history[0]);
    const rows = series
      .map((s) => {
        const point = s.values.find((p) => p.t === nearest.t);
        const meta = point?.meta;
        return {
          id: s.id,
          label: s.label,
          isUser: s.isUser,
          value: point?.value ?? 0,
          share: meta?.share ?? point?.value ?? 0,
          utility: meta?.utility,
          profit: meta?.profit,
        };
      })
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

    setHover({
      tableMode: true,
      t: nearest.t,
      rows,
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
  };

  const segments = series.flatMap((s, seriesIndex) => {
    const values = s.values;
    return values.slice(0, -1).map((p, i) => {
      const next = values[i + 1];
      const x1 = xScale(p.t);
      const y1 = yScale(p.value);
      const x2 = xScale(next.t);
      const y2 = yScale(next.value);
      const dx = x2 - x1;
      const dy = y2 - y1;
      const length = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);
      return { s, seriesIndex, i, x1, y1, length, angle };
    });
  });

  return (
    <div className={`relative ${heightClass} min-h-[420px] rounded-2xl bg-white p-4`}>
      <div
        className="absolute inset-x-16 bottom-8 top-4"
        onMouseMove={setPeriodHover}
        onMouseLeave={() => setHover(null)}
      >
        {hover && hover.tableMode && (
          <Tooltip x={hover.x} y={hover.y} className="w-[360px]">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="font-semibold text-slate-950">Period {hover.t}</div>
              <div className="text-[11px] text-slate-500">rendered series</div>
            </div>
            <div className="max-h-[340px] overflow-y-auto rounded-xl border border-slate-100">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-2 py-1 font-semibold">Firm</th>
                    <th className="px-2 py-1 text-right font-semibold">{metricLabel}</th>
                    <th className="px-2 py-1 text-right font-semibold">Utility</th>
                    <th className="px-2 py-1 text-right font-semibold">Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {hover.rows.map((row) => (
                    <tr key={row.id} className={row.isUser ? "bg-slate-950 text-white" : "bg-white text-slate-700"}>
                      <td className="max-w-[130px] truncate px-2 py-1 font-medium">{row.label}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{valueFormat(row.value)}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{row.utility == null ? "--" : row.utility.toFixed(2)}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{row.profit == null ? "--" : formatMoney(row.profit, 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Tooltip>
        )}

        {hover && !hover.tableMode && (
          <Tooltip x={hover.x} y={hover.y}>
            <div className="font-semibold text-slate-950">{hover.label}</div>
            <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1">
              <span className="text-slate-500">Period</span><span className="text-right font-semibold">{hover.t}</span>
              <span className="text-slate-500">{metricLabel}</span><span className="text-right font-semibold">{hover.value}</span>
              {hover.meta?.share != null && <><span className="text-slate-500">Share</span><span className="text-right font-semibold">{formatPct(hover.meta.share, 2)}</span></>}
              {hover.meta?.utility != null && <><span className="text-slate-500">Utility</span><span className="text-right font-semibold">{hover.meta.utility.toFixed(2)}</span></>}
              {hover.meta?.profit != null && <><span className="text-slate-500">Profit</span><span className="text-right font-semibold">{formatMoney(hover.meta.profit, 0)}</span></>}
              {hover.meta?.effectiveNetwork != null && <><span className="text-slate-500">E</span><span className="text-right font-semibold">{hover.meta.effectiveNetwork.toFixed(3)}</span></>}
            </div>
          </Tooltip>
        )}

        {xTicks.map((tick) => (
          <div key={`x-${tick}`} className="absolute top-0 h-full border-l border-dashed border-slate-200" style={{ left: `${xScale(tick)}%` }}>
            <div className="absolute top-full mt-2 -translate-x-1/2 whitespace-nowrap text-[11px] text-slate-500">{tick}</div>
          </div>
        ))}
        {yTicks.map((tick) => (
          <div key={`y-${tick}`} className="absolute left-0 w-full border-t border-dashed border-slate-200" style={{ top: `${yScale(tick)}%` }}>
            <div className="absolute right-full mr-2 -translate-y-1/2 whitespace-nowrap text-[11px] text-slate-500">{valueFormat(tick)}</div>
          </div>
        ))}
        <div className="absolute inset-0 border-b border-l border-slate-400" />

        {segments.map((seg) => (
          <div
            key={`${seg.s.id}-${seg.i}`}
            className={`absolute origin-left rounded-full ${getColorClass(seg.s, seg.seriesIndex)}`}
            style={{
              left: `${seg.x1}%`,
              top: `${seg.y1}%`,
              width: `${seg.length}%`,
              height: `${seg.s.width ?? 2}px`,
              opacity: getOpacity(seg.s),
              transform: `rotate(${seg.angle}deg)`,
            }}
          />
        ))}

        {series.map((s, seriesIndex) => {
          const points = showMany && !s.isUser ? s.values.filter((_, i) => i % 3 === 0 || i === s.values.length - 1) : s.values;
          return points.map((p) => (
            <button
              key={`${s.id}-${p.t}`}
              className={`absolute rounded-full border border-white shadow-sm transition hover:z-20 hover:scale-150 focus:outline-none ${getColorClass(s, seriesIndex)}`}
              style={{
                left: `${xScale(p.t)}%`,
                top: `${yScale(p.value)}%`,
                width: s.isUser ? 9 : 7,
                height: s.isUser ? 9 : 7,
                transform: "translate(-50%, -50%)",
                opacity: s.isUser ? 1 : showMany ? 0.55 : 0.8,
              }}
              onMouseMove={(e) => {
                if (periodTableTooltip) return;
                const rect = e.currentTarget.parentElement.getBoundingClientRect();
                setHover({
                  label: s.label,
                  t: p.t,
                  value: valueFormat(p.value),
                  meta: p.meta,
                  x: e.clientX - rect.left,
                  y: e.clientY - rect.top,
                });
              }}
              onMouseLeave={() => periodTableTooltip ? null : setHover(null)}
              aria-label={`${s.label} at period ${p.t}`}
            />
          ));
        })}
      </div>
      <AxisLabel className="absolute bottom-0 left-1/2 -translate-x-1/2">Period</AxisLabel>
      <AxisLabel className="absolute left-1 top-1/2 -translate-y-1/2 -rotate-90">{yLabel}</AxisLabel>
    </div>
  );
}

function NetworkScatter({ rows }) {
  const [hover, setHover] = useState(null);
  const xExtent = d3.extent(rows, (row) => row.effectiveNetwork);
  const yExtent = d3.extent(rows, (row) => row.alpha);
  const xMin = Math.max(0, (xExtent[0] ?? 0) * 0.75);
  const xMax = Math.max(0.01, (xExtent[1] ?? 1) * 1.12);
  const yMin = Math.max(0, (yExtent[0] ?? 0) * 0.92);
  const yMax = Math.max(0.01, (yExtent[1] ?? 1) * 1.08);
  const xScale = d3.scaleLinear().domain([xMin, xMax]).range([0, 100]).nice();
  const yScale = d3.scaleLinear().domain([yMin, yMax]).range([100, 0]).nice();
  const rScale = d3.scaleSqrt().domain([0, d3.max(rows, (row) => row.share) || 1]).range([8, 42]);
  const xTicks = xScale.ticks(5);
  const yTicks = yScale.ticks(5);

  return (
    <div className="relative h-full min-h-[500px] rounded-2xl bg-white p-4">
      <div className="absolute inset-x-16 bottom-8 top-4">
        {hover && (
          <Tooltip x={hover.x} y={hover.y}>
            <div className="font-semibold text-slate-950">{hover.row.label}</div>
            <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1">
              <span className="text-slate-500">Share</span><span className="text-right font-semibold">{formatPct(hover.row.share, 2)}</span>
              <span className="text-slate-500">E</span><span className="text-right font-semibold">{hover.row.effectiveNetwork.toFixed(3)}</span>
              <span className="text-slate-500">alpha</span><span className="text-right font-semibold">{hover.row.alpha.toFixed(2)}</span>
              <span className="text-slate-500">Reach</span><span className="text-right font-semibold">{hover.row.reach.toFixed(2)}</span>
              <span className="text-slate-500">Network spend</span><span className="text-right font-semibold">{hover.row.networkSpend.toFixed(2)}</span>
              <span className="text-slate-500">Congestion</span><span className="text-right font-semibold">{hover.row.congestion.toFixed(3)}</span>
            </div>
          </Tooltip>
        )}

        {xTicks.map((tick) => (
          <div key={`x-${tick}`} className="absolute top-0 h-full border-l border-dashed border-slate-200" style={{ left: `${xScale(tick)}%` }}>
            <div className="absolute top-full mt-2 -translate-x-1/2 whitespace-nowrap text-[11px] text-slate-500">{tick.toFixed(2)}</div>
          </div>
        ))}
        {yTicks.map((tick) => (
          <div key={`y-${tick}`} className="absolute left-0 w-full border-t border-dashed border-slate-200" style={{ top: `${yScale(tick)}%` }}>
            <div className="absolute right-full mr-2 -translate-y-1/2 whitespace-nowrap text-[11px] text-slate-500">{tick.toFixed(1)}</div>
          </div>
        ))}
        <div className="absolute inset-0 border-b border-l border-slate-400" />

        {[...rows]
          .filter((row) => !row.isUser)
          .sort((a, b) => a.share - b.share)
          .map((row) => {
            const size = rScale(row.share);
            return (
              <button
                key={row.id}
                className="absolute rounded-full border border-slate-500 bg-slate-400/55 transition hover:z-20 hover:scale-125 hover:bg-slate-500/80 focus:outline-none"
                style={{
                  left: `${xScale(row.effectiveNetwork)}%`,
                  top: `${yScale(row.alpha)}%`,
                  width: size,
                  height: size,
                  transform: "translate(-50%, -50%)",
                }}
                onMouseMove={(e) => {
                  const rect = e.currentTarget.parentElement.getBoundingClientRect();
                  setHover({ row, x: e.clientX - rect.left, y: e.clientY - rect.top });
                }}
                onMouseLeave={() => setHover(null)}
                aria-label={row.label}
              />
            );
          })}

        {rows
          .filter((row) => row.isUser)
          .map((row) => {
            const size = Math.max(26, rScale(row.share) + 8);
            return (
              <button
                key={row.id}
                className="absolute z-10 rounded-full border-[3px] border-white bg-slate-950 shadow-lg transition hover:scale-125 focus:outline-none"
                style={{
                  left: `${xScale(row.effectiveNetwork)}%`,
                  top: `${yScale(row.alpha)}%`,
                  width: size,
                  height: size,
                  transform: "translate(-50%, -50%)",
                }}
                onMouseMove={(e) => {
                  const rect = e.currentTarget.parentElement.getBoundingClientRect();
                  setHover({ row, x: e.clientX - rect.left, y: e.clientY - rect.top });
                }}
                onMouseLeave={() => setHover(null)}
                aria-label="Your firm"
              >
                <span className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] font-semibold text-slate-950">You</span>
              </button>
            );
          })}
      </div>
      <AxisLabel className="absolute bottom-0 left-1/2 -translate-x-1/2">Effective network value, E</AxisLabel>
      <AxisLabel className="absolute left-1 top-1/2 -translate-y-1/2 -rotate-90">Network productivity, alpha</AxisLabel>
    </div>
  );
}

function UtilityDecomposition({ rows }) {
  const [hover, setHover] = useState(null);
  const sorted = [...rows].sort((a, b) => b.share - a.share);
  const display = [rows.find((row) => row.isUser), ...sorted.filter((row) => !row.isUser).slice(0, 8)].filter(Boolean);
  const utilityExtent = d3.extent(display.flatMap((row) => [row.standaloneUtility, row.networkUtility, row.utility]));
  const minUtility = Math.min(-5, utilityExtent[0] ?? -5);
  const maxUtility = Math.max(5, utilityExtent[1] ?? 5);
  const widthFor = (value) => clamp(((value - minUtility) / Math.max(0.1, maxUtility - minUtility)) * 100, 0, 100);

  return (
    <div className="relative space-y-3">
      {hover && (
        <Tooltip x={hover.x} y={hover.y}>
          <div className="font-semibold text-slate-950">{hover.row.label}</div>
          <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1">
            <span className="text-slate-500">Share</span><span className="text-right font-semibold">{formatPct(hover.row.share, 2)}</span>
            <span className="text-slate-500">Standalone</span><span className="text-right font-semibold">{hover.row.standaloneUtility.toFixed(2)}</span>
            <span className="text-slate-500">Network</span><span className="text-right font-semibold">{hover.row.networkUtility.toFixed(2)}</span>
            <span className="text-slate-500">Total utility</span><span className="text-right font-semibold">{hover.row.utility.toFixed(2)}</span>
            <span className="text-slate-500">Price</span><span className="text-right font-semibold">{formatMoney(hover.row.price, 2)}</span>
            <span className="text-slate-500">Profit</span><span className="text-right font-semibold">{formatMoney(hover.row.profit, 0)}</span>
          </div>
        </Tooltip>
      )}

      {display.map((row) => (
        <div
          key={row.id}
          className={`rounded-2xl p-3 transition ${row.isUser ? "bg-slate-950 text-white" : "bg-slate-50 text-slate-800 hover:bg-slate-100"}`}
          onMouseMove={(e) => {
            const rect = e.currentTarget.parentElement.getBoundingClientRect();
            setHover({ row, x: e.clientX - rect.left, y: e.clientY - rect.top });
          }}
          onMouseLeave={() => setHover(null)}
        >
          <div className="mb-2 flex items-center justify-between gap-3 text-xs">
            <span className="font-semibold">{row.label}</span>
            <span className="tabular-nums">{row.utility.toFixed(2)} utility</span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <div className={row.isUser ? "mb-1 text-slate-300" : "mb-1 text-slate-500"}>Standalone</div>
              <div className="h-2 overflow-hidden rounded-full bg-white/60">
                <motion.div
                  layout
                  initial={false}
                  animate={{ width: `${widthFor(row.standaloneUtility)}%` }}
                  className="h-full rounded-full bg-slate-500"
                />
              </div>
            </div>
            <div>
              <div className={row.isUser ? "mb-1 text-slate-300" : "mb-1 text-slate-500"}>Network</div>
              <div className="h-2 overflow-hidden rounded-full bg-white/60">
                <motion.div
                  layout
                  initial={false}
                  animate={{ width: `${widthFor(row.networkUtility)}%` }}
                  className="h-full rounded-full bg-slate-400"
                />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function VisualCard({ slotName, selected, onSelect, children }) {
  return (
    <Card className="min-h-[640px] rounded-3xl border-slate-200 bg-white/90 shadow-sm backdrop-blur">
      <CardContent className="flex h-full flex-col p-5">
        <div className="mb-3 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{slotName}</div>
            <h2 className="text-xl font-semibold">{VISUALS.find((v) => v.key === selected)?.label}</h2>
          </div>
          <select
            value={selected}
            onChange={(e) => onSelect(e.target.value)}
            className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm outline-none focus:border-slate-400"
          >
            {VISUALS.map((v) => (
              <option key={v.key} value={v.key}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1">{children}</div>
      </CardContent>
    </Card>
  );
}

function FirmParameterTable({ finalRows }) {
  const displayRows = [...finalRows].sort((a, b) => (a.isUser ? -1 : b.isUser ? 1 : b.share - a.share));

  return (
    <Card className="rounded-3xl border-slate-200 bg-white/90 shadow-sm backdrop-blur">
      <CardContent className="p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Debug firm table</h2>
            <p className="text-sm text-slate-500">Generated parameters, network production stocks, and final simulated outcomes for every firm.</p>
          </div>
          <Database className="h-5 w-5 text-slate-400" />
        </div>
        <div className="max-h-[420px] overflow-auto rounded-2xl border border-slate-200">
          <table className="w-full min-w-[1280px] text-left text-xs">
            <thead className="sticky top-0 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-3 py-2 font-semibold">Firm</th>
                <th className="px-3 py-2 font-semibold">Type</th>
                <th className="px-3 py-2 font-semibold">Price</th>
                <th className="px-3 py-2 font-semibold">Quality</th>
                <th className="px-3 py-2 font-semibold">c</th>
                <th className="px-3 py-2 font-semibold">F</th>
                <th className="px-3 py-2 font-semibold">Network spend</th>
                <th className="px-3 py-2 font-semibold">Adoption spend</th>
                <th className="px-3 py-2 font-semibold">alpha</th>
                <th className="px-3 py-2 font-semibold">E</th>
                <th className="px-3 py-2 font-semibold">Reach</th>
                <th className="px-3 py-2 font-semibold">Utility</th>
                <th className="px-3 py-2 font-semibold">Final share</th>
                <th className="px-3 py-2 font-semibold">Profit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayRows.map((row) => (
                <tr key={row.id} className={row.isUser ? "bg-slate-950 text-white" : "bg-white text-slate-700"}>
                  <td className="px-3 py-2 font-semibold">{row.label}</td>
                  <td className="px-3 py-2">{row.isUser ? "User" : "Competitor"}</td>
                  <td className="px-3 py-2 tabular-nums">{formatMoney(row.price, 2)}</td>
                  <td className="px-3 py-2 tabular-nums">{row.quality.toFixed(2)}</td>
                  <td className="px-3 py-2 tabular-nums">{formatMoney(row.unitCost, 2)}</td>
                  <td className="px-3 py-2 tabular-nums">{formatMoney(row.fixedCost, 0)}</td>
                  <td className="px-3 py-2 tabular-nums">{row.networkSpend.toFixed(2)}</td>
                  <td className="px-3 py-2 tabular-nums">{row.adoptionSpend.toFixed(2)}</td>
                  <td className="px-3 py-2 tabular-nums">{row.alpha.toFixed(2)}</td>
                  <td className="px-3 py-2 tabular-nums">{row.effectiveNetwork.toFixed(3)}</td>
                  <td className="px-3 py-2 tabular-nums">{row.reach.toFixed(2)}</td>
                  <td className="px-3 py-2 tabular-nums">{row.utility.toFixed(2)}</td>
                  <td className="px-3 py-2 tabular-nums">{formatPct(row.share, 2)}</td>
                  <td className="px-3 py-2 tabular-nums">{formatMoney(row.profit, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export default function NetworkProductionMarketSimulator() {
  const [userPrice, setUserPrice] = useState(DEFAULTS.userPrice);
  const [userNetworkSpend, setUserNetworkSpend] = useState(DEFAULTS.userNetworkSpend);
  const [userAdoptionSpend, setUserAdoptionSpend] = useState(DEFAULTS.userAdoptionSpend);
  const [seed, setSeed] = useState(DEFAULTS.seed);
  const [nCompetitors, setNCompetitors] = useState(DEFAULTS.nCompetitors);
  const [marketSize, setMarketSize] = useState(DEFAULTS.marketSize);
  const [periods, setPeriods] = useState(DEFAULTS.periods);
  const [demandSensitivity, setDemandSensitivity] = useState(DEFAULTS.demandSensitivity);
  const [shareAdjustment, setShareAdjustment] = useState(DEFAULTS.shareAdjustment);
  const [baseAlpha, setBaseAlpha] = useState(DEFAULTS.baseAlpha);
  const [networkReturns, setNetworkReturns] = useState(DEFAULTS.networkReturns);
  const [dataLearning, setDataLearning] = useState(DEFAULTS.dataLearning);
  const [congestionPenalty, setCongestionPenalty] = useState(DEFAULTS.congestionPenalty);
  const [churnDrag, setChurnDrag] = useState(DEFAULTS.churnDrag);
  const [debugMode, setDebugMode] = useState(false);
  const [debugTab, setDebugTab] = useState("simulation");
  const [leftVisual, setLeftVisual] = useState("share");
  const [rightVisual, setRightVisual] = useState("network");
  const [timeFilter, setTimeFilter] = useState("default");

  const params = useMemo(() => ({
    userPrice,
    userNetworkSpend,
    userAdoptionSpend,
    seed,
    nCompetitors,
    marketSize,
    periods,
    demandSensitivity,
    shareAdjustment,
    baseAlpha,
    networkReturns,
    dataLearning,
    congestionPenalty,
    churnDrag,
  }), [userPrice, userNetworkSpend, userAdoptionSpend, seed, nCompetitors, marketSize, periods, demandSensitivity, shareAdjustment, baseAlpha, networkReturns, dataLearning, congestionPenalty, churnDrag]);

  const firms = useMemo(() => buildFirms(params), [params]);
  const competitors = useMemo(() => firms.filter((firm) => !firm.isUser), [firms]);
  const marketAverages = useMemo(() => ({
    price: d3.mean(competitors, (firm) => firm.price) ?? 12,
    networkSpend: d3.mean(competitors, (firm) => firm.networkSpend) ?? 0.5,
    adoptionSpend: d3.mean(competitors, (firm) => firm.adoptionSpend) ?? 0.5,
  }), [competitors]);

  const dynamicHistory = useMemo(() => simulateMarket(firms, params), [firms, params]);
  const finalPeriod = dynamicHistory[dynamicHistory.length - 1];
  const initialPeriod = dynamicHistory[0];
  const userFinal = finalPeriod.rows.find((row) => row.isUser) ?? finalPeriod.rows[0];
  const userInitial = initialPeriod.rows.find((row) => row.isUser) ?? initialPeriod.rows[0];
  const userRank = [...finalPeriod.rows].sort((a, b) => b.share - a.share).findIndex((row) => row.isUser) + 1;
  const topCompetitor = [...finalPeriod.rows].filter((row) => !row.isUser).sort((a, b) => b.share - a.share)[0];

  const timeSeries = useMemo(() => buildFirmTimeSeries(dynamicHistory, timeFilter, "share"), [dynamicHistory, timeFilter]);
  const profitSeries = useMemo(() => buildFirmTimeSeries(dynamicHistory, timeFilter, "profit"), [dynamicHistory, timeFilter]);
  const hhiSeries = useMemo(() => [
    {
      id: "hhi",
      label: "HHI",
      isUser: true,
      width: 4,
      values: dynamicHistory.map((period) => ({ t: period.t, value: period.hhi, meta: { label: "HHI" } })),
    },
    {
      id: "top-five",
      label: "Top five share",
      isAggregate: true,
      width: 3,
      values: dynamicHistory.map((period) => ({ t: period.t, value: period.topFiveShare, meta: { label: "Top five" } })),
    },
  ], [dynamicHistory]);

  const reset = () => {
    setUserPrice(DEFAULTS.userPrice);
    setUserNetworkSpend(DEFAULTS.userNetworkSpend);
    setUserAdoptionSpend(DEFAULTS.userAdoptionSpend);
    setSeed(DEFAULTS.seed);
    setNCompetitors(DEFAULTS.nCompetitors);
    setMarketSize(DEFAULTS.marketSize);
    setPeriods(DEFAULTS.periods);
    setDemandSensitivity(DEFAULTS.demandSensitivity);
    setShareAdjustment(DEFAULTS.shareAdjustment);
    setBaseAlpha(DEFAULTS.baseAlpha);
    setNetworkReturns(DEFAULTS.networkReturns);
    setDataLearning(DEFAULTS.dataLearning);
    setCongestionPenalty(DEFAULTS.congestionPenalty);
    setChurnDrag(DEFAULTS.churnDrag);
    setDebugMode(false);
    setDebugTab("simulation");
    setLeftVisual("share");
    setRightVisual("network");
    setTimeFilter("default");
  };

  const randomizeMarket = () => setSeed((s) => s + 1);

  const renderTimeFilter = () => (
    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
      <span className="font-semibold text-slate-500">Lines</span>
      <select
        value={timeFilter}
        onChange={(e) => setTimeFilter(e.target.value)}
        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm outline-none focus:border-slate-400"
      >
        {TIME_FILTERS.map((option) => (
          <option key={option.key} value={option.key}>{option.label}</option>
        ))}
      </select>
    </div>
  );

  const renderVisual = (visualKey) => {
    switch (visualKey) {
      case "network":
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="rounded-2xl bg-slate-50 p-3">
                <div className="text-xs text-slate-500">User alpha</div>
                <div className="text-lg font-semibold text-slate-950">{userFinal.alpha.toFixed(2)}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3">
                <div className="text-xs text-slate-500">User E</div>
                <div className="text-lg font-semibold text-slate-950">{userFinal.effectiveNetwork.toFixed(3)}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3">
                <div className="text-xs text-slate-500">Top rival E</div>
                <div className="text-lg font-semibold text-slate-950">{topCompetitor?.effectiveNetwork.toFixed(3) ?? "--"}</div>
              </div>
            </div>
            <div className="h-[500px]">
              <NetworkScatter rows={finalPeriod.rows} />
            </div>
          </div>
        );
      case "profit":
        return (
          <div className="space-y-4">
            <div className="flex flex-col justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3 xl:flex-row xl:items-center">
              <div>
                <div className="text-xs text-slate-500">User delta profit</div>
                <div className={`text-lg font-semibold ${userFinal.profit >= userInitial.profit ? "text-emerald-700" : "text-rose-700"}`}>
                  {userFinal.profit >= userInitial.profit ? "+" : ""}{formatMoney(userFinal.profit - userInitial.profit, 0)}
                </div>
              </div>
              {renderTimeFilter()}
            </div>
            <HtmlLineChart
              history={dynamicHistory}
              series={profitSeries}
              yLabel="Profit"
              valueFormat={(v) => formatMoney(v, 0)}
              metricLabel="Profit"
              showMany={timeFilter !== "default"}
            />
          </div>
        );
      case "utility":
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="rounded-2xl bg-slate-50 p-3">
                <div className="text-xs text-slate-500">Standalone</div>
                <div className="text-lg font-semibold text-slate-950">{userFinal.standaloneUtility.toFixed(2)}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3">
                <div className="text-xs text-slate-500">Network</div>
                <div className="text-lg font-semibold text-slate-950">{userFinal.networkUtility.toFixed(2)}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3">
                <div className="text-xs text-slate-500">Total</div>
                <div className="text-lg font-semibold text-slate-950">{userFinal.utility.toFixed(2)}</div>
              </div>
            </div>
            <UtilityDecomposition rows={finalPeriod.rows} />
          </div>
        );
      case "structure":
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="rounded-2xl bg-slate-50 p-3">
                <div className="text-xs text-slate-500">Initial HHI</div>
                <div className="text-lg font-semibold text-slate-950">{initialPeriod.hhi.toFixed(3)}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3">
                <div className="text-xs text-slate-500">Final HHI</div>
                <div className="text-lg font-semibold text-slate-950">{finalPeriod.hhi.toFixed(3)}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3">
                <div className="text-xs text-slate-500">Top five</div>
                <div className="text-lg font-semibold text-slate-950">{formatPct(finalPeriod.topFiveShare, 1)}</div>
              </div>
            </div>
            <HtmlLineChart
              history={dynamicHistory}
              series={hhiSeries}
              yLabel="Concentration"
              valueFormat={(v) => v < 1 ? v.toFixed(3) : formatPct(v, 0)}
              metricLabel="Value"
              showMany={false}
            />
          </div>
        );
      case "share":
      default:
        return (
          <div className="space-y-4">
            <div className="flex flex-col justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3 xl:flex-row xl:items-center">
              <div>
                <div className="text-xs text-slate-500">User delta share</div>
                <div className={`text-lg font-semibold ${finalPeriod.userShare >= initialPeriod.userShare ? "text-emerald-700" : "text-rose-700"}`}>
                  {finalPeriod.userShare >= initialPeriod.userShare ? "+" : ""}{formatPct(finalPeriod.userShare - initialPeriod.userShare, 1)}
                </div>
              </div>
              {renderTimeFilter()}
            </div>
            <HtmlLineChart
              history={dynamicHistory}
              series={timeSeries}
              yLabel="Market share"
              valueFormat={(v) => formatPct(v, 1)}
              metricLabel="Share"
              showMany={timeFilter !== "default"}
              periodTableTooltip
            />
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 p-5 text-slate-950 md:p-8">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm">
              <Network className="h-3.5 w-3.5" />
              Network production simulator
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950 md:text-5xl">
              Network capital, adoption speed, and tipping
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 md:text-base">
              Adjust your firm&apos;s price, network production, and adoption acceleration. Competitor capabilities are hidden draws from the same market. Use the visual workbench to compare any two views side by side.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="rounded-full" onClick={() => setDebugMode((v) => !v)}>
              <Bug className="mr-2 h-4 w-4" /> {debugMode ? "Hide debug" : "Debug mode"}
            </Button>
            <Button variant="outline" className="rounded-full" onClick={randomizeMarket}>
              New hidden market
            </Button>
            <Button className="rounded-full bg-slate-950 text-white hover:bg-slate-800" onClick={reset}>
              <RotateCcw className="mr-2 h-4 w-4" /> Reset
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
          <Card className="rounded-3xl border-slate-200 bg-white/90 shadow-sm backdrop-blur">
            <CardContent className="space-y-6 p-5">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-5 w-5 text-slate-600" />
                <h2 className="text-lg font-semibold">Controls</h2>
              </div>

              <Slider
                label="Your price, P0"
                value={userPrice}
                min={8.5}
                max={16.5}
                step={0.1}
                prefix="$"
                onChange={setUserPrice}
                hint="Lower price raises standalone utility but reduces margin."
                comparisonLabel="Market avg P"
                comparisonValue={formatMoney(marketAverages.price, 2)}
              />
              <Slider
                label="Network production spend"
                value={userNetworkSpend}
                min={0.05}
                max={1.35}
                step={0.01}
                onChange={setUserNetworkSpend}
                hint="Builds ecosystem, matching, trust, interoperability, and alpha."
                comparisonLabel="Market avg"
                comparisonValue={marketAverages.networkSpend.toFixed(2)}
              />
              <Slider
                label="Adoption acceleration spend"
                value={userAdoptionSpend}
                min={0.05}
                max={1.35}
                step={0.01}
                onChange={setUserAdoptionSpend}
                hint="Improves onboarding, seeding, referrals, and speed to critical mass."
                comparisonLabel="Market avg"
                comparisonValue={marketAverages.adoptionSpend.toFixed(2)}
              />

              {debugMode && (
                <div className="space-y-5 rounded-3xl border border-amber-200 bg-amber-50/70 p-4">
                  <div className="flex items-center gap-2 text-amber-900">
                    <Bug className="h-4 w-4" />
                    <div className="text-sm font-semibold">Debug controls</div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 rounded-full bg-white/70 p-1">
                    <DebugTabButton active={debugTab === "simulation"} onClick={() => setDebugTab("simulation")}>
                      Simulation settings
                    </DebugTabButton>
                    <DebugTabButton active={debugTab === "market"} onClick={() => setDebugTab("market")}>
                      Market settings
                    </DebugTabButton>
                  </div>

                  {debugTab === "simulation" ? (
                    <div className="space-y-4">
                      <Slider
                        label="Generated competitors"
                        value={nCompetitors}
                        min={5}
                        max={140}
                        step={1}
                        onChange={setNCompetitors}
                        hint="Number of non-user firms drawn at simulation start."
                      />
                      <Slider
                        label="Periods"
                        value={periods}
                        min={15}
                        max={120}
                        step={1}
                        onChange={setPeriods}
                        hint="Length of simulated market evolution."
                      />
                      <Slider
                        label="Demand sensitivity, lambda"
                        value={demandSensitivity}
                        min={0.4}
                        max={5.5}
                        step={0.05}
                        onChange={setDemandSensitivity}
                        hint="How sharply users move toward higher-utility firms."
                      />
                      <Slider
                        label="Share adjustment speed, gamma"
                        value={shareAdjustment}
                        min={0.02}
                        max={0.6}
                        step={0.01}
                        onChange={setShareAdjustment}
                        hint="Fraction of the gap to utility-implied target share closed each period."
                      />
                    </div>
                  ) : (
                    <div className="space-y-5">
                      <Slider
                        label="Market size, S"
                        value={marketSize}
                        min={45000}
                        max={250000}
                        step={2500}
                        onChange={setMarketSize}
                        hint="Total demand allocated across firms."
                      />
                      <Slider
                        label="Base network effect, alpha-bar"
                        value={baseAlpha}
                        min={0.2}
                        max={2.4}
                        step={0.05}
                        onChange={setBaseAlpha}
                        hint="Economy-wide strength of network utility."
                      />
                      <Slider
                        label="Network returns, rho"
                        value={networkReturns}
                        min={0.2}
                        max={1.3}
                        step={0.02}
                        onChange={setNetworkReturns}
                        hint="Curvature converting installed base into raw network value."
                      />
                      <Slider
                        label="Data learning"
                        value={dataLearning}
                        min={0}
                        max={0.6}
                        step={0.01}
                        onChange={setDataLearning}
                        hint="How much accumulated usage improves network effectiveness."
                      />
                      <Slider
                        label="Congestion penalty"
                        value={congestionPenalty}
                        min={0}
                        max={1.5}
                        step={0.01}
                        onChange={setCongestionPenalty}
                        hint="Penalty when share exceeds firm capacity."
                      />
                      <Slider
                        label="Churn drag"
                        value={churnDrag}
                        min={0}
                        max={0.7}
                        step={0.01}
                        onChange={setChurnDrag}
                        hint="Installed-base inertia that slows share losses."
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="rounded-2xl bg-slate-50 p-4 text-xs leading-5 text-slate-600">
                <div className="mb-1 font-semibold text-slate-800">Hidden market assumptions</div>
                Competitors draw price, quality, cost, network production skill, adoption skill, and capacity from hidden distributions. Users have fixed utility rules; firms change realized utility by producing network capital and accelerating adoption.
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-2">
              <VisualCard slotName="Left panel" selected={leftVisual} onSelect={setLeftVisual}>
                {renderVisual(leftVisual)}
              </VisualCard>

              <VisualCard slotName="Right panel" selected={rightVisual} onSelect={setRightVisual}>
                {renderVisual(rightVisual)}
              </VisualCard>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <MetricCard
                icon={TrendingUp}
                label="Final user share"
                value={formatPct(userFinal.share, 1)}
                sublabel={`Initial: ${formatPct(userInitial.share, 1)} • Rank ${userRank} of ${finalPeriod.rows.length}`}
              />
              <MetricCard
                icon={Rocket}
                label="Adoption reach"
                value={userFinal.reach.toFixed(2)}
                sublabel={`Market avg: ${(d3.mean(finalPeriod.rows.filter((row) => !row.isUser), (row) => row.reach) ?? 0).toFixed(2)}`}
              />
              <MetricCard
                icon={BarChart3}
                label="Market HHI"
                value={finalPeriod.hhi.toFixed(3)}
                sublabel={`Top five: ${formatPct(finalPeriod.topFiveShare, 1)}`}
              />
              <MetricCard
                icon={Users}
                label="Network utility"
                value={userFinal.networkUtility.toFixed(2)}
                sublabel={`E=${userFinal.effectiveNetwork.toFixed(3)}, alpha=${userFinal.alpha.toFixed(2)}`}
              />
            </div>

            {debugMode && <FirmParameterTable finalRows={finalPeriod.rows} />}

            <Card className="rounded-3xl border-slate-200 bg-slate-950 text-white shadow-sm">
              <CardContent className="grid gap-5 p-5 md:grid-cols-3">
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-400">User utility</div>
                  <div className="mt-2 font-mono text-sm text-slate-100">U_j = q_j - p_j - f_j + alpha_j log(1 + 8E_j)</div>
                  <p className="mt-2 text-sm leading-6 text-slate-300">The demand rule is fixed. Firm choices change the network value users experience.</p>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-400">Network production</div>
                  <div className="mt-2 font-mono text-sm text-slate-100">E_j = n_j^rho x M_j x D_j - G_j</div>
                  <p className="mt-2 text-sm leading-6 text-slate-300">Network spend raises ecosystem depth, matching, trust, interoperability, and alpha.</p>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-400">Dynamic update</div>
                  <div className="mt-2 font-mono text-sm text-slate-100">s_j,t+1 = s_j,t + gamma reach_j(target_j - s_j,t)</div>
                  <p className="mt-2 text-sm leading-6 text-slate-300">Adoption spend affects reach, which controls how quickly a firm moves toward its utility-implied share.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
