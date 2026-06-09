import React, { useMemo, useState } from "react";
import * as d3 from "d3";
import { motion } from "framer-motion";
import { SimFrame } from "@/components/sim/SimFrame";
import { SimSlider } from "@/components/sim/SimSlider";
import { SimReadout, SimReadoutRow } from "@/components/sim/SimReadout";
import {
  SimButton,
  SimSelect,
  SimTabs,
  SimToggleButton,
} from "@/components/sim/SimControls";
import { CHART, CHART_COLOR, tint } from "@/components/sim/chart";
import { formatPct, formatMoney, formatCompact, deltaTone } from "@/lib/sim/format";

const TAIL_ALPHA = 0.4;
const deltaClass = (v) => (deltaTone(v) === "positive" ? "text-positive" : "text-danger");

const DEFAULTS = {
  userC: 7.6,
  userF: 1000,
  price: 13.0,
  marketSize: 100000,
  lambda: 1.15,
  eta: 5.0,
  shareAdjustment: 0.12,
  marginSignalCap: 0.2,
  seed: 42,
  nCompetitors: 55,
  cHat: 8.4,
  sigmaC: 1.1,
  fHat: 1350,
  sigmaF: 375,
};

const HIDDEN_MARKET = {
  cHat: 8.4,
  sigmaC: 1.1,
  fHat: 1350,
  sigmaF: 375,
  d: 0.00042,
  periods: 55,
  exitMargin: -0.04,
  exitLag: 4,
  minShare: 0.0015,
};

const VISUALS = [
  { key: "share", label: "Share snapshot" },
  { key: "cost", label: "Cost position" },
  { key: "time", label: "Share over time" },
  { key: "profit", label: "Profit over time" },
  { key: "marginTime", label: "Profit margin over time" },
  { key: "shakeout", label: "Shakeout" },
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

function averageCost(firm, q, d) {
  return firm.F / Math.max(q, 1e-6) + firm.c + d * q;
}

function totalCost(firm, q, d) {
  return firm.F + firm.c * q + d * q * q;
}

function softmax(values) {
  const max = Math.max(...values);
  const exp = values.map((v) => Math.exp(v - max));
  const sum = d3.sum(exp);
  return exp.map((x) => x / sum);
}

function computeStaticShares(firms, marketSize, d, lambda) {
  let shares = Array(firms.length).fill(1 / firms.length);

  for (let iter = 0; iter < 350; iter++) {
    const costs = firms.map((firm, i) => averageCost(firm, shares[i] * marketSize, d));
    const target = softmax(costs.map((ac) => -lambda * ac));
    shares = shares.map((s, i) => 0.86 * s + 0.14 * target[i]);
  }

  const sum = d3.sum(shares);
  return shares.map((s) => s / sum);
}

function simulateDynamics(firms, initialShares, params) {
  const {
    marketSize,
    price,
    d,
    eta,
    shareAdjustment,
    marginSignalCap,
    periods,
    exitMargin,
    exitLag,
    minShare,
  } = params;
  let shares = [...initialShares];
  let alive = firms.map(() => true);
  let badPeriods = firms.map(() => 0);
  const history = [];

  for (let t = 0; t <= periods; t++) {
    const rows = firms.map((firm, i) => {
      if (!alive[i]) {
        return { ...firm, alive: false, share: 0, q: 0, ac: null, profit: 0, margin: null };
      }

      const q = Math.max(1e-6, shares[i] * marketSize);
      const cost = totalCost(firm, q, d);
      const revenue = price * q;
      const profit = revenue - cost;
      const margin = revenue > 0 ? profit / revenue : -1;
      const ac = cost / q;
      return { ...firm, alive: true, share: shares[i], q, ac, profit, margin };
    });

    const aliveRows = rows.filter((r) => r.alive);
    const aliveShare = d3.sum(aliveRows, (r) => r.share);
    const weightedMargin = aliveShare > 0 ? d3.sum(aliveRows, (r) => r.share * r.margin) / aliveShare : 0;
    const hhi = d3.sum(shares, (s) => s * s);
    const activeCount = alive.filter(Boolean).length;
    const user = rows[0];

    const sortedAlive = [...rows]
      .filter((r) => r.alive && !r.isUser)
      .sort((a, b) => b.share - a.share);
    const topCompetitors = sortedAlive.slice(0, 5);
    const topCompetitorShare = topCompetitors[0]?.share ?? 0;
    const topFiveShare = d3.sum(topCompetitors, (r) => r.share);
    const tailShare = Math.max(0, 1 - user.share - topFiveShare);

    history.push({
      t,
      rows,
      hhi,
      activeCount,
      weightedMargin,
      userShare: user.share,
      userMargin: user.margin,
      userProfit: user.profit,
      topCompetitorShare,
      topFiveShare,
      tailShare,
    });

    if (t === periods) break;

    rows.forEach((r, i) => {
      if (!alive[i]) return;
      if (r.margin < exitMargin || r.share < minShare) badPeriods[i] += 1;
      else badPeriods[i] = 0;
      if (badPeriods[i] >= exitLag) {
        alive[i] = false;
        shares[i] = 0;
      }
    });

    const aliveAfterExit = alive.filter(Boolean).length;
    if (aliveAfterExit === 0) break;

    const growthWeights = rows.map((r, i) => {
      if (!alive[i]) return 0;
      const pressure = clamp(r.margin - weightedMargin, -marginSignalCap, marginSignalCap);
      return shares[i] * Math.exp(eta * pressure);
    });

    const total = d3.sum(growthWeights);
    const targetShares = total > 0 ? growthWeights.map((w) => w / total) : shares;
    shares = shares.map((s, i) => (alive[i] ? (1 - shareAdjustment) * s + shareAdjustment * targetShares[i] : 0));

    const adjustedTotal = d3.sum(shares);
    shares = adjustedTotal > 0 ? shares.map((s) => s / adjustedTotal) : shares;
  }

  return history;
}

function percentile(values, value, lowerIsBetter = true) {
  const sorted = [...values].sort((a, b) => a - b);
  const rank = d3.bisectLeft(sorted, value) / Math.max(1, sorted.length - 1);
  return lowerIsBetter ? 1 - rank : rank;
}

function Tooltip({ x, y, children, className = "" }) {
  const left = x > 260 ? x - 240 : x + 12;
  const top = y > 170 ? y - 150 : y + 18;

  return (
    <div
      className={`pointer-events-none absolute z-30 min-w-[150px] ${CHART.tooltipSurface} backdrop-blur ${className}`}
      style={{ left, top }}
    >
      {children}
    </div>
  );
}

function NumberCell({ value, onChange, min, max, step = 1, prefix = "" }) {
  return (
    <div className="flex items-center overflow-hidden rounded-xl border border-grid-line bg-surface focus-within:border-accent">
      {prefix && <span className="border-r border-grid-line px-2 text-xs font-semibold text-muted">{prefix}</span>}
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full bg-transparent px-2 py-2 text-right text-xs font-semibold tabular-nums text-ink outline-none"
      />
    </div>
  );
}

function DistributionSettingsTable({ cHat, sigmaC, fHat, sigmaF, setCHat, setSigmaC, setFHat, setSigmaF }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-grid-line bg-surface">
      <table className="w-full text-xs">
        <thead className="bg-panel text-muted">
          <tr>
            <th className="px-3 py-2 text-left font-semibold">Parameter</th>
            <th className="px-3 py-2 text-right font-semibold">Mean</th>
            <th className="px-3 py-2 text-right font-semibold">Std.</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-grid-line">
          <tr>
            <td className="px-3 py-3 font-semibold text-ink">c</td>
            <td className="px-2 py-2">
              <NumberCell value={cHat} min={0.5} max={30} step={0.05} prefix="$" onChange={setCHat} />
            </td>
            <td className="px-2 py-2">
              <NumberCell value={sigmaC} min={0.05} max={10} step={0.05} prefix="$" onChange={setSigmaC} />
            </td>
          </tr>
          <tr>
            <td className="px-3 py-3 font-semibold text-ink">F</td>
            <td className="px-2 py-2">
              <NumberCell value={fHat} min={50} max={10000} step={25} prefix="$" onChange={setFHat} />
            </td>
            <td className="px-2 py-2">
              <NumberCell value={sigmaF} min={25} max={5000} step={25} prefix="$" onChange={setSigmaF} />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function ShareBars({ rows }) {
  const [hover, setHover] = useState(null);
  const sorted = [...rows].filter((r) => r.share > 0).sort((a, b) => b.share - a.share);
  const user = sorted.find((r) => r.isUser);
  const topOthers = sorted.filter((r) => !r.isUser).slice(0, 9);
  const tail = Math.max(0, 1 - d3.sum([user, ...topOthers].filter(Boolean), (r) => r.share));
  const display = [user, ...topOthers].filter(Boolean);
  if (tail > 0.002) display.push({ id: "tail", label: "Other firms", share: tail, isTail: true, margin: null, acMin: null, profit: null });

  return (
    <div className="relative space-y-3">
      {hover && (
        <Tooltip x={hover.x} y={hover.y}>
          <div className="font-semibold text-ink">{hover.row.label}</div>
          <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1">
            <span className="text-muted">Share</span><span className="text-right font-semibold">{formatPct(hover.row.share, 2)}</span>
            {hover.row.margin != null && <><span className="text-muted">Margin</span><span className="text-right font-semibold">{formatPct(hover.row.margin, 1)}</span></>}
            {hover.row.acMin != null && <><span className="text-muted">AC min</span><span className="text-right font-semibold">{formatMoney(hover.row.acMin, 2)}</span></>}
            {hover.row.profit != null && <><span className="text-muted">Profit</span><span className="text-right font-semibold">{formatMoney(hover.row.profit, 0)}</span></>}
          </div>
        </Tooltip>
      )}
      {display.map((r) => (
        <div
          key={r.id}
          className="space-y-1 rounded-xl px-1 py-0.5 transition hover:bg-surface"
          onMouseMove={(e) => {
            const rect = e.currentTarget.parentElement.getBoundingClientRect();
            setHover({ row: r, x: e.clientX - rect.left, y: e.clientY - rect.top });
          }}
          onMouseLeave={() => setHover(null)}
        >
          <div className="flex items-center justify-between text-xs">
            <span className={r.isUser ? "font-semibold text-ink" : "text-body"}>{r.label}</span>
            <span className="font-medium tabular-nums text-body">{formatPct(r.share, 1)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface">
            <motion.div
              layout
              initial={false}
              animate={{ width: `${clamp(r.share * 100, 0, 100)}%` }}
              transition={{ type: "spring", stiffness: 190, damping: 24 }}
              className="h-full rounded-full"
              style={{
                background: r.isUser
                  ? CHART_COLOR.accent
                  : r.isTail
                    ? tint(CHART_COLOR.muted, TAIL_ALPHA)
                    : tint(CHART_COLOR.muted, 0.75),
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function AxisLabel({ children, className = "" }) {
  return <div className={`text-[11px] font-medium text-muted ${className}`}>{children}</div>;
}

function HtmlScatterPlot({ rows }) {
  const [hover, setHover] = useState(null);
  const xExtent = d3.extent(rows, (r) => r.mes);
  const yExtent = d3.extent(rows, (r) => r.acMin);
  const xScale = d3.scaleLinear().domain([xExtent[0] * 0.85, xExtent[1] * 1.08]).range([0, 100]).nice();
  const yScale = d3.scaleLinear().domain([yExtent[0] * 0.96, yExtent[1] * 1.05]).range([100, 0]).nice();
  const rScale = d3.scaleSqrt().domain([0, d3.max(rows, (r) => r.share) || 1]).range([8, 42]);
  const xTicks = xScale.ticks(5);
  const yTicks = yScale.ticks(5);

  return (
    <div className="relative h-full min-h-[420px] rounded-2xl bg-panel p-4">
      <div className="absolute inset-x-16 bottom-8 top-4">
        {hover && (
          <Tooltip x={hover.x} y={hover.y}>
            <div className="font-semibold text-ink">{hover.row.label}</div>
            <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1">
              <span className="text-muted">MES</span><span className="text-right font-semibold">{formatCompact(hover.row.mes)}</span>
              <span className="text-muted">AC min</span><span className="text-right font-semibold">{formatMoney(hover.row.acMin, 2)}</span>
              <span className="text-muted">Share</span><span className="text-right font-semibold">{formatPct(hover.row.share, 2)}</span>
              <span className="text-muted">c</span><span className="text-right font-semibold">{formatMoney(hover.row.c, 2)}</span>
              <span className="text-muted">F</span><span className="text-right font-semibold">{formatMoney(hover.row.F, 0)}</span>
            </div>
          </Tooltip>
        )}

        {xTicks.map((tick) => (
          <div key={`x-${tick}`} className={`absolute top-0 h-full border-l ${CHART.gridLine}`} style={{ left: `${xScale(tick)}%` }}>
            <div className={`absolute top-full mt-2 -translate-x-1/2 whitespace-nowrap ${CHART.axisText}`}>{formatCompact(tick)}</div>
          </div>
        ))}
        {yTicks.map((tick) => (
          <div key={`y-${tick}`} className={`absolute left-0 w-full border-t ${CHART.gridLine}`} style={{ top: `${yScale(tick)}%` }}>
            <div className={`absolute right-full mr-2 -translate-y-1/2 whitespace-nowrap ${CHART.axisText}`}>${tick.toFixed(1)}</div>
          </div>
        ))}

        <div className={`absolute inset-0 border-b border-l ${CHART.axisLine}`} />

        {[...rows]
          .filter((r) => !r.isUser)
          .sort((a, b) => a.share - b.share)
          .map((row) => {
            const size = rScale(row.share);
            return (
              <button
                key={row.id}
                className="absolute rounded-full transition hover:z-20 hover:scale-125 focus:outline-none"
                style={{
                  left: `${xScale(row.mes)}%`,
                  top: `${yScale(row.acMin)}%`,
                  width: size,
                  height: size,
                  transform: "translate(-50%, -50%)",
                  border: `1px solid ${CHART_COLOR.gridLine}`,
                  background: CHART_COLOR.rivalFill,
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
          .filter((r) => r.isUser)
          .map((row) => {
            const size = Math.max(24, rScale(row.share) + 8);
            return (
              <button
                key={row.id}
                className="absolute z-10 rounded-full shadow-lg transition hover:scale-125 focus:outline-none"
                style={{
                  left: `${xScale(row.mes)}%`,
                  top: `${yScale(row.acMin)}%`,
                  width: size,
                  height: size,
                  transform: "translate(-50%, -50%)",
                  border: `3px solid ${CHART_COLOR.gridLine}`,
                  background: CHART_COLOR.accent,
                }}
                onMouseMove={(e) => {
                  const rect = e.currentTarget.parentElement.getBoundingClientRect();
                  setHover({ row, x: e.clientX - rect.left, y: e.clientY - rect.top });
                }}
                onMouseLeave={() => setHover(null)}
                aria-label="Your firm"
              >
                <span className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] font-semibold text-ink">You</span>
              </button>
            );
          })}
      </div>
      <AxisLabel className="absolute bottom-0 left-1/2 -translate-x-1/2">Minimum efficient scale, qᴹᴱˢ</AxisLabel>
      <AxisLabel className="absolute left-1 top-1/2 -translate-y-1/2 -rotate-90">Minimum average cost</AxisLabel>
    </div>
  );
}

function getMetricValue(row, metricKey) {
  if (!row) return 0;
  if (metricKey === "profit") return row.profit ?? 0;
  if (metricKey === "margin") return row.margin ?? 0;
  return row.share ?? 0;
}

function buildFirmTimeSeries(history, filterKey, metricKey = "share") {
  const finalRows = history[history.length - 1].rows;
  const ranked = [...finalRows].sort((a, b) => b.share - a.share);
  const userId = "user";

  let selectedIds;
  if (filterKey === "all") {
    selectedIds = new Set(finalRows.map((r) => r.id));
  } else if (filterKey === "top10") {
    selectedIds = new Set(ranked.slice(0, 10).map((r) => r.id));
    selectedIds.add(userId);
  } else if (filterKey === "bottom10") {
    selectedIds = new Set(ranked.slice(-10).map((r) => r.id));
    selectedIds.add(userId);
  } else if (filterKey === "topBottom10") {
    selectedIds = new Set([...ranked.slice(0, 10), ...ranked.slice(-10)].map((r) => r.id));
    selectedIds.add(userId);
  } else if (filterKey === "top20") {
    selectedIds = new Set(ranked.slice(0, 20).map((r) => r.id));
    selectedIds.add(userId);
  } else if (metricKey === "share") {
    return [
      {
        id: "user",
        label: "Your firm",
        isUser: true,
        width: 4,
        values: history.map((d) => ({ t: d.t, value: d.userShare, meta: d.rows.find((r) => r.id === "user") })),
      },
      {
        id: "top-rival",
        label: "Top competitor",
        isAggregate: true,
        width: 3,
        values: history.map((d) => {
          const top = [...d.rows].filter((r) => r.alive && !r.isUser).sort((a, b) => b.share - a.share)[0];
          return { t: d.t, value: top?.share ?? 0, meta: top ?? { label: "Top competitor" } };
        }),
      },
      {
        id: "tail",
        label: "Long tail",
        isAggregate: true,
        width: 3,
        values: history.map((d) => ({ t: d.t, value: d.tailShare, meta: { label: "Long tail", share: d.tailShare, margin: null } })),
      },
    ];
  } else {
    selectedIds = new Set([userId, ...ranked.filter((r) => !r.isUser).slice(0, 5).map((r) => r.id)]);
  }

  return finalRows
    .filter((firm) => selectedIds.has(firm.id))
    .sort((a, b) => (a.isUser ? -1 : b.isUser ? 1 : b.share - a.share))
    .map((firm) => ({
      id: firm.id,
      label: firm.label,
      isUser: firm.isUser,
      width: firm.isUser ? 4 : 1.6,
      values: history.map((d) => {
        const row = d.rows.find((r) => r.id === firm.id);
        return { t: d.t, value: getMetricValue(row, metricKey), meta: row };
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
  const pad = Math.max(0.01, ((yExtent?.[1] ?? 1) - (yExtent?.[0] ?? 0)) * 0.12);
  const xScale = d3.scaleLinear().domain(xExtent).range([0, 100]);
  const yScale = d3.scaleLinear().domain([Math.min(0, (yExtent?.[0] ?? 0) - pad), (yExtent?.[1] ?? 1) + pad]).range([100, 0]).nice();
  const xTicks = xScale.ticks(6);
  const yTicks = yScale.ticks(5);

  const getColor = (s, index) => {
    if (s.isUser) return CHART_COLOR.accent;
    if (s.id === "top-rival") return tint(CHART_COLOR.muted, 0.85);
    if (s.id === "tail") return tint(CHART_COLOR.muted, TAIL_ALPHA);
    return index % 2 === 0 ? tint(CHART_COLOR.muted, 0.8) : tint(CHART_COLOR.muted, 0.6);
  };

  const getOpacity = (s) => {
    if (s.isUser) return 1;
    if (s.isAggregate) return 0.9;
    return showMany ? 0.38 : 0.65;
  };

  const setPeriodHover = (event) => {
    if (!periodTableTooltip) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const xPct = clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100);
    const rawT = xScale.invert(xPct);
    const nearest = history.reduce((best, d) => (Math.abs(d.t - rawT) < Math.abs(best.t - rawT) ? d : best), history[0]);
    const rows = series
      .map((s) => {
        const point = s.values.find((p) => p.t === nearest.t);
        const meta = point?.meta;
        return {
          id: s.id,
          label: s.label,
          isUser: s.isUser,
          share: meta?.share ?? point?.value ?? 0,
          margin: meta?.margin,
          alive: meta?.alive,
        };
      })
      .sort((a, b) => (a.share ?? 0) - (b.share ?? 0));

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
    <div className={`relative ${heightClass} min-h-[420px] rounded-2xl bg-panel p-4`}>
      <div
        className="absolute inset-x-16 bottom-8 top-4"
        onMouseMove={setPeriodHover}
        onMouseLeave={() => setHover(null)}
      >
        {hover && hover.tableMode && (
          <Tooltip x={hover.x} y={hover.y} className="w-[340px]">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="font-semibold text-ink">Period {hover.t}</div>
              <div className="text-[11px] text-muted">rendered firms • low to high</div>
            </div>
            <div className="max-h-[340px] overflow-y-auto rounded-xl border border-grid-line">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-surface text-muted">
                  <tr>
                    <th className="px-2 py-1 font-semibold">Firm</th>
                    <th className="px-2 py-1 text-right font-semibold">Share</th>
                    <th className="px-2 py-1 text-right font-semibold">Margin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-grid-line">
                  {hover.rows.map((row) => (
                    <tr
                      key={row.id}
                      className={
                        row.isUser
                          ? "text-bg"
                          : row.alive === false
                            ? "text-muted"
                            : "text-body"
                      }
                      style={
                        row.isUser
                          ? { background: CHART_COLOR.accent }
                          : row.alive === false
                            ? { background: tint(CHART_COLOR.muted, 0.12) }
                            : undefined
                      }
                    >
                      <td className="max-w-[130px] truncate px-2 py-1 font-medium">{row.label}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{formatPct(row.share, 2)}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{row.margin == null ? "--" : formatPct(row.margin, 1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Tooltip>
        )}

        {hover && !hover.tableMode && (
          <Tooltip x={hover.x} y={hover.y}>
            <div className="font-semibold text-ink">{hover.label}</div>
            <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1">
              <span className="text-muted">Period</span><span className="text-right font-semibold">{hover.t}</span>
              <span className="text-muted">{metricLabel}</span><span className="text-right font-semibold">{hover.value}</span>
              {hover.meta?.share != null && <><span className="text-muted">Share</span><span className="text-right font-semibold">{formatPct(hover.meta.share, 2)}</span></>}
              {hover.meta?.margin != null && <><span className="text-muted">Margin</span><span className="text-right font-semibold">{formatPct(hover.meta.margin, 1)}</span></>}
              {hover.meta?.profit != null && <><span className="text-muted">Profit</span><span className="text-right font-semibold">{formatMoney(hover.meta.profit, 0)}</span></>}
              {hover.meta?.alive != null && <><span className="text-muted">Status</span><span className="text-right font-semibold">{hover.meta.alive ? "Alive" : "Exited"}</span></>}
            </div>
          </Tooltip>
        )}

        {xTicks.map((tick) => (
          <div key={`x-${tick}`} className={`absolute top-0 h-full border-l ${CHART.gridLine}`} style={{ left: `${xScale(tick)}%` }}>
            <div className={`absolute top-full mt-2 -translate-x-1/2 whitespace-nowrap ${CHART.axisText}`}>{tick}</div>
          </div>
        ))}
        {yTicks.map((tick) => (
          <div key={`y-${tick}`} className={`absolute left-0 w-full border-t ${CHART.gridLine}`} style={{ top: `${yScale(tick)}%` }}>
            <div className={`absolute right-full mr-2 -translate-y-1/2 whitespace-nowrap ${CHART.axisText}`}>{valueFormat(tick)}</div>
          </div>
        ))}
        <div className={`absolute inset-0 border-b border-l ${CHART.axisLine}`} />

        {segments.map((seg) => (
          <div
            key={`${seg.s.id}-${seg.i}`}
            className="absolute origin-left rounded-full"
            style={{
              left: `${seg.x1}%`,
              top: `${seg.y1}%`,
              width: `${seg.length}%`,
              height: `${seg.s.width ?? 2}px`,
              opacity: getOpacity(seg.s),
              transform: `rotate(${seg.angle}deg)`,
              background: getColor(seg.s, seg.seriesIndex),
            }}
          />
        ))}

        {series.map((s, seriesIndex) => {
          const points = showMany && !s.isUser ? s.values.filter((_, i) => i % 3 === 0 || i === s.values.length - 1) : s.values;
          return points.map((p) => (
            <button
              key={`${s.id}-${p.t}`}
              className="absolute rounded-full shadow-sm transition hover:z-20 hover:scale-150 focus:outline-none"
              style={{
                left: `${xScale(p.t)}%`,
                top: `${yScale(p.value)}%`,
                width: s.isUser ? 9 : 7,
                height: s.isUser ? 9 : 7,
                transform: "translate(-50%, -50%)",
                opacity: s.isUser ? 1 : showMany ? 0.55 : 0.8,
                background: getColor(s, seriesIndex),
                border: `1px solid ${CHART_COLOR.gridLine}`,
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

function VisualCard({ slotName, selected, onSelect, children }) {
  return (
    <SimFrame
      className="flex min-h-[640px] flex-col rounded-3xl"
      eyebrow={slotName}
      title={VISUALS.find((v) => v.key === selected)?.label}
      toolbar={
        <SimSelect value={selected} onChange={(e) => onSelect(e.target.value)}>
          {VISUALS.map((v) => (
            <option key={v.key} value={v.key}>
              {v.label}
            </option>
          ))}
        </SimSelect>
      }
    >
      <div className="flex-1">{children}</div>
    </SimFrame>
  );
}

function FirmParameterTable({ rows, finalRows }) {
  const finalById = new Map(finalRows.map((r) => [r.id, r]));
  const displayRows = [...rows].sort((a, b) => (a.isUser ? -1 : b.isUser ? 1 : a.id.localeCompare(b.id)));

  return (
    <SimFrame
      className="rounded-3xl"
      eyebrow="Debug"
      title="Debug firm table"
    >
      <p className="-mt-3 mb-4 text-sm text-body">Generated parameters and simulated outcomes for every firm.</p>
      <div className="max-h-[420px] overflow-auto rounded-2xl border border-grid-line">
        <table className="w-full min-w-[980px] text-left text-xs">
          <thead className="sticky top-0 bg-surface text-muted">
            <tr>
              <th className="px-3 py-2 font-semibold">Firm</th>
              <th className="px-3 py-2 font-semibold">Type</th>
              <th className="px-3 py-2 font-semibold">c</th>
              <th className="px-3 py-2 font-semibold">F</th>
              <th className="px-3 py-2 font-semibold">MES</th>
              <th className="px-3 py-2 font-semibold">AC min</th>
              <th className="px-3 py-2 font-semibold">Static share</th>
              <th className="px-3 py-2 font-semibold">Static margin</th>
              <th className="px-3 py-2 font-semibold">Final share</th>
              <th className="px-3 py-2 font-semibold">Final margin</th>
              <th className="px-3 py-2 font-semibold">Final status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-grid-line">
            {displayRows.map((row) => {
              const final = finalById.get(row.id);
              return (
                <tr
                  key={row.id}
                  className={row.isUser ? "text-bg" : "text-body"}
                  style={row.isUser ? { background: CHART_COLOR.accent } : undefined}
                >
                  <td className="px-3 py-2 font-semibold">{row.label}</td>
                  <td className="px-3 py-2">{row.isUser ? "User" : "Competitor"}</td>
                  <td className="px-3 py-2 tabular-nums">{row.c.toFixed(2)}</td>
                  <td className="px-3 py-2 tabular-nums">{row.F.toFixed(0)}</td>
                  <td className="px-3 py-2 tabular-nums">{formatCompact(row.mes)}</td>
                  <td className="px-3 py-2 tabular-nums">{formatMoney(row.acMin, 2)}</td>
                  <td className="px-3 py-2 tabular-nums">{formatPct(row.share, 2)}</td>
                  <td className="px-3 py-2 tabular-nums">{formatPct(row.margin, 1)}</td>
                  <td className="px-3 py-2 tabular-nums">{formatPct(final?.share ?? 0, 2)}</td>
                  <td className="px-3 py-2 tabular-nums">{final?.margin == null ? "--" : formatPct(final.margin, 1)}</td>
                  <td className="px-3 py-2">{final?.alive ? "Alive" : "Exited"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </SimFrame>
  );
}

export default function StiglerBarrierMarketSimulator() {
  const [userC, setUserC] = useState(DEFAULTS.userC);
  const [userF, setUserF] = useState(DEFAULTS.userF);
  const [price, setPrice] = useState(DEFAULTS.price);
  const [marketSize, setMarketSize] = useState(DEFAULTS.marketSize);
  const [lambda, setLambda] = useState(DEFAULTS.lambda);
  const [eta, setEta] = useState(DEFAULTS.eta);
  const [shareAdjustment, setShareAdjustment] = useState(DEFAULTS.shareAdjustment);
  const [marginSignalCap, setMarginSignalCap] = useState(DEFAULTS.marginSignalCap);
  const [seed, setSeed] = useState(DEFAULTS.seed);
  const [nCompetitors, setNCompetitors] = useState(DEFAULTS.nCompetitors);
  const [cHat, setCHat] = useState(DEFAULTS.cHat);
  const [sigmaC, setSigmaC] = useState(DEFAULTS.sigmaC);
  const [fHat, setFHat] = useState(DEFAULTS.fHat);
  const [sigmaF, setSigmaF] = useState(DEFAULTS.sigmaF);
  const [debugMode, setDebugMode] = useState(false);
  const [leftVisual, setLeftVisual] = useState("share");
  const [rightVisual, setRightVisual] = useState("cost");
  const [timeFilter, setTimeFilter] = useState("default");
  const [debugTab, setDebugTab] = useState("simulation");

  const competitors = useMemo(() => {
    const random = mulberry32(seed);
    return Array.from({ length: nCompetitors }, (_, idx) => {
      const c = clamp(normalRandom(random, cHat, sigmaC), 0.5, 30);
      const F = clamp(normalRandom(random, fHat, sigmaF), 50, 10000);
      return {
        id: `firm-${idx + 1}`,
        label: `Firm ${idx + 1}`,
        c,
        F,
        isUser: false,
      };
    });
  }, [seed, nCompetitors, cHat, sigmaC, fHat, sigmaF]);

  const marketAverages = useMemo(() => {
    return {
      c: d3.mean(competitors, (d) => d.c) ?? cHat,
      F: d3.mean(competitors, (d) => d.F) ?? fHat,
    };
  }, [competitors, cHat, fHat]);

  const firms = useMemo(() => {
    const user = { id: "user", label: "Your firm", c: userC, F: userF, isUser: true };
    const all = [user, ...competitors].map((firm) => {
      const mes = Math.sqrt(firm.F / HIDDEN_MARKET.d);
      const acMin = firm.c + 2 * Math.sqrt(firm.F * HIDDEN_MARKET.d);
      return { ...firm, mes, acMin };
    });
    return all;
  }, [userC, userF, competitors]);

  const staticShares = useMemo(
    () => computeStaticShares(firms, marketSize, HIDDEN_MARKET.d, lambda),
    [firms, marketSize, lambda]
  );

  const staticRows = useMemo(() => {
    return firms
      .map((firm, i) => {
        const share = staticShares[i];
        const q = share * marketSize;
        const cost = totalCost(firm, q, HIDDEN_MARKET.d);
        const revenue = price * q;
        const profit = revenue - cost;
        const margin = revenue > 0 ? profit / revenue : 0;
        return { ...firm, share, q, cost, revenue, profit, margin, ac: q > 0 ? cost / q : null, alive: true };
      })
      .sort((a, b) => b.share - a.share);
  }, [firms, staticShares, marketSize, price]);

  const dynamicHistory = useMemo(() => {
    return simulateDynamics(firms, staticShares, {
      marketSize,
      price,
      d: HIDDEN_MARKET.d,
      eta,
      shareAdjustment,
      marginSignalCap,
      periods: HIDDEN_MARKET.periods,
      exitMargin: HIDDEN_MARKET.exitMargin,
      exitLag: HIDDEN_MARKET.exitLag,
      minShare: HIDDEN_MARKET.minShare,
    });
  }, [firms, staticShares, marketSize, price, eta, shareAdjustment, marginSignalCap]);

  const timeSeries = useMemo(() => buildFirmTimeSeries(dynamicHistory, timeFilter, "share"), [dynamicHistory, timeFilter]);
  const profitSeries = useMemo(() => buildFirmTimeSeries(dynamicHistory, timeFilter, "profit"), [dynamicHistory, timeFilter]);
  const marginSeries = useMemo(() => buildFirmTimeSeries(dynamicHistory, timeFilter, "margin"), [dynamicHistory, timeFilter]);
  const finalPeriod = dynamicHistory[dynamicHistory.length - 1];
  const initialPeriod = dynamicHistory[0];
  const userStatic = staticRows.find((r) => r.isUser);
  const userFinal = finalPeriod.rows.find((r) => r.isUser);
  const hhiStatic = d3.sum(staticShares, (s) => s * s);
  const activeStatic = staticRows.filter((r) => r.margin > HIDDEN_MARKET.exitMargin && r.share > HIDDEN_MARKET.minShare).length;
  const minCosts = firms.map((f) => f.acMin);
  const userCostPercentile = percentile(minCosts, firms[0].acMin, true);
  const userShareRank = [...staticRows].sort((a, b) => b.share - a.share).findIndex((r) => r.isUser) + 1;
  const survivingCompetitorCosts = staticRows.filter((r) => !r.isUser && r.margin > HIDDEN_MARKET.exitMargin).map((r) => r.acMin);
  const marginalCost = d3.quantile(survivingCompetitorCosts.sort(d3.ascending), 0.75) ?? d3.median(minCosts);
  const barrierWedge = marginalCost - firms[0].acMin;

  const reset = () => {
    setUserC(DEFAULTS.userC);
    setUserF(DEFAULTS.userF);
    setPrice(DEFAULTS.price);
    setMarketSize(DEFAULTS.marketSize);
    setLambda(DEFAULTS.lambda);
    setEta(DEFAULTS.eta);
    setShareAdjustment(DEFAULTS.shareAdjustment);
    setMarginSignalCap(DEFAULTS.marginSignalCap);
    setSeed(DEFAULTS.seed);
    setNCompetitors(DEFAULTS.nCompetitors);
    setCHat(DEFAULTS.cHat);
    setSigmaC(DEFAULTS.sigmaC);
    setFHat(DEFAULTS.fHat);
    setSigmaF(DEFAULTS.sigmaF);
    setLeftVisual("share");
    setRightVisual("cost");
    setTimeFilter("default");
    setDebugTab("simulation");
    setDebugMode(false);
  };

  const randomizeMarket = () => setSeed((s) => s + 1);

  const renderVisual = (visualKey) => {
    switch (visualKey) {
      case "cost":
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3">
              <div>
                <div className="text-xs text-muted">Cost percentile</div>
                <div className="text-lg font-semibold text-ink">{formatPct(userCostPercentile, 0)}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted">User AC min</div>
                <div className="text-lg font-semibold text-ink">{formatMoney(firms[0].acMin, 2)}</div>
              </div>
            </div>
            <div className="h-[500px]">
              <HtmlScatterPlot rows={staticRows} />
            </div>
          </div>
        );
      case "time":
        return (
          <div className="space-y-4">
            <div className="flex flex-col justify-between gap-3 rounded-2xl bg-surface px-4 py-3 xl:flex-row xl:items-center">
              <div>
                <div className="text-xs text-muted">User Δ share</div>
                <div className={`text-lg font-semibold ${deltaClass(finalPeriod.userShare - initialPeriod.userShare)}`}>
                  {finalPeriod.userShare >= initialPeriod.userShare ? "+" : ""}{formatPct(finalPeriod.userShare - initialPeriod.userShare, 1)}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-body">
                <span className="font-semibold text-muted">Lines</span>
                <SimSelect
                  value={timeFilter}
                  onChange={(e) => setTimeFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs"
                >
                  {TIME_FILTERS.map((option) => (
                    <option key={option.key} value={option.key}>{option.label}</option>
                  ))}
                </SimSelect>
              </div>
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
      case "profit":
        return (
          <div className="space-y-4">
            <div className="flex flex-col justify-between gap-3 rounded-2xl bg-surface px-4 py-3 xl:flex-row xl:items-center">
              <div>
                <div className="text-xs text-muted">User Δ profit</div>
                <div className={`text-lg font-semibold ${deltaClass((userFinal?.profit ?? 0) - (initialPeriod.rows.find((r) => r.isUser)?.profit ?? 0))}`}>
                  {((userFinal?.profit ?? 0) >= (initialPeriod.rows.find((r) => r.isUser)?.profit ?? 0)) ? "+" : ""}{formatMoney((userFinal?.profit ?? 0) - (initialPeriod.rows.find((r) => r.isUser)?.profit ?? 0), 0)}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-body">
                <span className="font-semibold text-muted">Lines</span>
                <SimSelect
                  value={timeFilter}
                  onChange={(e) => setTimeFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs"
                >
                  {TIME_FILTERS.map((option) => (
                    <option key={option.key} value={option.key}>{option.label}</option>
                  ))}
                </SimSelect>
              </div>
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
      case "marginTime":
        return (
          <div className="space-y-4">
            <div className="flex flex-col justify-between gap-3 rounded-2xl bg-surface px-4 py-3 xl:flex-row xl:items-center">
              <div>
                <div className="text-xs text-muted">User Δ margin</div>
                <div className={`text-lg font-semibold ${deltaClass((userFinal?.margin ?? 0) - (initialPeriod.rows.find((r) => r.isUser)?.margin ?? 0))}`}>
                  {((userFinal?.margin ?? 0) >= (initialPeriod.rows.find((r) => r.isUser)?.margin ?? 0)) ? "+" : ""}{formatPct((userFinal?.margin ?? 0) - (initialPeriod.rows.find((r) => r.isUser)?.margin ?? 0), 1)}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-body">
                <span className="font-semibold text-muted">Lines</span>
                <SimSelect
                  value={timeFilter}
                  onChange={(e) => setTimeFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs"
                >
                  {TIME_FILTERS.map((option) => (
                    <option key={option.key} value={option.key}>{option.label}</option>
                  ))}
                </SimSelect>
              </div>
            </div>
            <HtmlLineChart
              history={dynamicHistory}
              series={marginSeries}
              yLabel="Profit margin"
              valueFormat={(v) => formatPct(v, 1)}
              metricLabel="Margin"
              showMany={timeFilter !== "default"}
            />
          </div>
        );
      case "shakeout":
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="rounded-2xl bg-surface p-3">
                <div className="text-xs text-muted">Initial active</div>
                <div className="text-lg font-semibold text-ink">{initialPeriod.activeCount}</div>
              </div>
              <div className="rounded-2xl bg-surface p-3">
                <div className="text-xs text-muted">Final active</div>
                <div className="text-lg font-semibold text-ink">{finalPeriod.activeCount}</div>
              </div>
              <div className="rounded-2xl bg-surface p-3">
                <div className="text-xs text-muted">Final HHI</div>
                <div className="text-lg font-semibold text-ink">{finalPeriod.hhi.toFixed(3)}</div>
              </div>
            </div>
            <HtmlLineChart
              history={dynamicHistory}
              series={[
                {
                  id: "active",
                  label: "Active firms",
                  isUser: true,
                  width: 4,
                  values: dynamicHistory.map((d) => ({ t: d.t, value: d.activeCount, meta: { label: "Active firms" } })),
                },
              ]}
              yLabel="Active firms"
              valueFormat={(v) => d3.format(".0f")(v)}
              metricLabel="Active firms"
            />
          </div>
        );
      case "share":
      default:
        return (
          <div className="space-y-4">
            <ShareBars rows={staticRows} />
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl bg-surface p-3">
                <div className="text-xs text-muted">User profit</div>
                <div className="text-lg font-semibold text-ink">{formatMoney(userStatic.profit, 0)}</div>
              </div>
              <div className="rounded-2xl bg-surface p-3">
                <div className="text-xs text-muted">Barrier wedge</div>
                <div className={`text-lg font-semibold ${deltaClass(barrierWedge)}`}>
                  {barrierWedge >= 0 ? "+" : ""}{formatMoney(barrierWedge, 2)}/unit
                </div>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="w-full text-body">
      <div className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
          <SimFrame
            className="rounded-3xl"
            eyebrow="Stigler barrier simulator"
            title="Controls"
            toolbar={
              <>
                <SimButton variant="ghost" onClick={() => setDebugMode((v) => !v)}>
                  {debugMode ? "Hide debug" : "Debug mode"}
                </SimButton>
                <SimButton variant="outline" onClick={randomizeMarket}>
                  New hidden market
                </SimButton>
                <SimButton variant="solid" onClick={reset}>
                  Reset
                </SimButton>
              </>
            }
          >
            <div className="space-y-6">
              <SimSlider
                label="Your variable cost, c₀"
                value={userC}
                min={5.2}
                max={11.8}
                step={0.05}
                prefix="$"
                onChange={setUserC}
                hint="Per-unit operating cost. Dominates at scale."
                comparisonLabel="Market avg c"
                comparisonValue={formatMoney(marketAverages.c, 2)}
              />
              <SimSlider
                label="Your fixed cost, F₀"
                value={userF}
                min={300}
                max={2400}
                step={25}
                prefix="$"
                onChange={setUserF}
                hint="Entry and low-volume burden."
                comparisonLabel="Market avg F"
                comparisonValue={formatMoney(marketAverages.F, 0)}
              />

              {debugMode && (
                <div
                  className="space-y-5 rounded-3xl border p-4"
                  style={{
                    borderColor: tint(CHART_COLOR.danger, 0.45),
                    background: tint(CHART_COLOR.danger, 0.08),
                  }}
                >
                  <div className="flex items-center gap-2 text-sm font-semibold text-danger">
                    Debug controls
                  </div>

                  <SimTabs label="Debug settings" className="grid w-full grid-cols-2">
                    <SimToggleButton
                      active={debugTab === "simulation"}
                      onClick={() => setDebugTab("simulation")}
                    >
                      Simulation settings
                    </SimToggleButton>
                    <SimToggleButton
                      active={debugTab === "market"}
                      onClick={() => setDebugTab("market")}
                    >
                      Market settings
                    </SimToggleButton>
                  </SimTabs>

                  {debugTab === "simulation" ? (
                    <div className="space-y-4">
                      <SimSlider
                        label="Generated competitors"
                        value={nCompetitors}
                        min={5}
                        max={140}
                        step={1}
                        onChange={setNCompetitors}
                        hint="Number of non-user firms drawn at simulation start."
                      />
                      <div className="space-y-2">
                        <div>
                          <div className="text-sm font-medium text-ink">Competitor distribution</div>
                          <div className="text-xs text-muted">Rows are cost parameters; columns set hidden normal-draw mean and standard deviation.</div>
                        </div>
                        <DistributionSettingsTable
                          cHat={cHat}
                          sigmaC={sigmaC}
                          fHat={fHat}
                          sigmaF={sigmaF}
                          setCHat={setCHat}
                          setSigmaC={setSigmaC}
                          setFHat={setFHat}
                          setSigmaF={setSigmaF}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      <SimSlider
                        label="Market price, P"
                        value={price}
                        min={9.5}
                        max={16.5}
                        step={0.1}
                        prefix="$"
                        onChange={setPrice}
                        hint="Exogenous price environment."
                      />
                      <SimSlider
                        label="Market size, S"
                        value={marketSize}
                        min={45000}
                        max={180000}
                        step={2500}
                        onChange={setMarketSize}
                        hint="Total demand allocated across firms."
                      />
                      <SimSlider
                        label="Cost-share sensitivity, λ"
                        value={lambda}
                        min={0.25}
                        max={2.5}
                        step={0.05}
                        onChange={setLambda}
                        hint="How strongly static share follows cost."
                      />
                      <SimSlider
                        label="Reallocation speed, η"
                        value={eta}
                        min={0.5}
                        max={10}
                        step={0.25}
                        onChange={setEta}
                        hint="How strongly margin advantages affect target shares."
                      />
                      <SimSlider
                        label="Share adjustment damping, α"
                        value={shareAdjustment}
                        min={0.02}
                        max={1}
                        step={0.01}
                        onChange={setShareAdjustment}
                        hint="Fraction of the way firms move toward target shares each period. Lower is smoother."
                      />
                      <SimSlider
                        label="Margin signal cap, δ"
                        value={marginSignalCap}
                        min={0.02}
                        max={0.6}
                        step={0.01}
                        onChange={setMarginSignalCap}
                        hint="Clips margin advantage before exponentiation to prevent overshooting."
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="rounded-2xl bg-surface p-4 text-xs leading-5 text-body">
                <div className="mb-1 font-semibold text-ink">Hidden market assumptions</div>
                Competitors draw c and F from hidden truncated normal distributions: c ~ N({formatMoney(cHat, 2)}, {formatMoney(sigmaC, 2)}²), F ~ N({formatMoney(fHat, 0)}, {formatMoney(sigmaF, 0)}²). All firms share the same scale curvature d = {HIDDEN_MARKET.d}. Exit occurs after weak margin or tiny share persists.
              </div>
            </div>
          </SimFrame>

          <div className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-2">
              <VisualCard slotName="Left panel" selected={leftVisual} onSelect={setLeftVisual}>
                {renderVisual(leftVisual)}
              </VisualCard>

              <VisualCard slotName="Right panel" selected={rightVisual} onSelect={setRightVisual}>
                {renderVisual(rightVisual)}
              </VisualCard>
            </div>

            <SimFrame className="rounded-3xl">
              <SimReadoutRow>
                <SimReadout
                  label="Static user share"
                  value={formatPct(userStatic.share, 1)}
                  sublabel={`Rank ${userShareRank} of ${firms.length}`}
                />
                <SimReadout
                  label="User margin"
                  value={formatPct(userStatic.margin, 1)}
                  sublabel={`Final: ${formatPct(userFinal?.margin ?? 0, 1)}`}
                />
                <SimReadout
                  label="Market HHI"
                  value={hhiStatic.toFixed(3)}
                  sublabel={`Final: ${finalPeriod.hhi.toFixed(3)}`}
                />
                <SimReadout
                  label="Active firms"
                  value={`${activeStatic}`}
                  sublabel={`Final: ${finalPeriod.activeCount}`}
                />
              </SimReadoutRow>
            </SimFrame>

            {debugMode && <FirmParameterTable rows={staticRows} finalRows={finalPeriod.rows} />}

            <SimFrame className="rounded-3xl">
              <div className="grid gap-5 md:grid-cols-3">
                <div>
                  <div className="font-mono text-xs uppercase tracking-[0.18em] text-accent">Cost curve</div>
                  <div className="mt-2 font-mono text-sm text-ink">Cᵢ(q)=Fᵢ+cᵢq+dq²</div>
                  <p className="mt-2 text-sm leading-6 text-body">The user controls only F₀ and c₀. Competitor draws stay hidden unless debug mode is on.</p>
                </div>
                <div>
                  <div className="font-mono text-xs uppercase tracking-[0.18em] text-accent">Static allocation</div>
                  <div className="mt-2 font-mono text-sm text-ink">sᵢ ∝ exp(-λ ACᵢ)</div>
                  <p className="mt-2 text-sm leading-6 text-body">Lower average cost increases the probability-like share weight.</p>
                </div>
                <div>
                  <div className="font-mono text-xs uppercase tracking-[0.18em] text-accent">Dynamic update</div>
                  <div className="mt-2 font-mono text-sm text-ink">sᵢ,t+1=(1-α)sᵢ,t+α·targetᵢ,t</div>
                  <p className="mt-2 text-sm leading-6 text-body">Target shares use clipped margin pressure: exp(η·clip(mᵢ,t-m̄t, -δ, δ)).</p>
                </div>
              </div>
            </SimFrame>
          </div>
        </div>
      </div>
    </div>
  );
}
