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
  GitBranch,
  Layers,
  RotateCcw,
  Shield,
  Skull,
  SlidersHorizontal,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";

const DEFAULTS = {
  userAdvantage: 1.15,
  userMoat: 0.62,
  learningRate: 0.032,
  seed: 42,
  nCompetitors: 62,
  marketSize: 100000,
  price: 13.0,
  demandSensitivity: 1.08,
  imitationSpeed: 0.22,
  shareAdjustment: 0.16,
  marginSignalCap: 0.22,
  experimentationNoise: 0.028,
  cMean: 8.45,
  cSd: 0.88,
  fMean: 980,
  fSd: 270,
  moatMean: 0.34,
  moatSd: 0.2,
  periods: 65,
  exitMargin: -0.055,
  exitLag: 4,
  minShare: 0.0015,
};

const HIDDEN_MARKET = {
  minCost: 3.2,
  maxCost: 15.5,
  minFixedCost: 80,
  maxFixedCost: 4500,
  userFixedCostMultiplier: 0.98,
  moatFixedCostLoad: 260,
  competitorAbsorptionPenalty: 0.35,
  shareFloor: 1e-7,
};

const REGIME_TEMPLATES = {
  generic: {
    key: "generic",
    label: "Generic capability market",
    shortLabel: "Generic",
    description: "Balanced market with moderate imitation, moderate moats, and a fixed demand environment. Good baseline for exploring rent decay.",
    controls: { ...DEFAULTS },
    leftVisual: "rent",
    rightVisual: "cost",
  },
  commodity: {
    key: "commodity",
    label: "Commodity / easy-copy market",
    shortLabel: "Commodity",
    description: "Customers treat output as interchangeable and firms can copy processes quickly. Advantages tend to decay unless the cost edge is very large.",
    controls: {
      ...DEFAULTS,
      userAdvantage: 0.85,
      userMoat: 0.16,
      learningRate: 0.012,
      nCompetitors: 92,
      price: 12.4,
      demandSensitivity: 1.32,
      imitationSpeed: 0.38,
      cMean: 8.35,
      cSd: 0.55,
      fMean: 760,
      fSd: 180,
      moatMean: 0.18,
      moatSd: 0.11,
      experimentationNoise: 0.038,
      shareAdjustment: 0.2,
    },
    leftVisual: "copy",
    rightVisual: "share",
  },
  assetScarce: {
    key: "assetScarce",
    label: "Asset-scarce market",
    shortLabel: "Scarce assets",
    description: "Supply-side advantage comes from scarce assets, logistics, know-how, or geology. Demand substitution is fixed, but copyability is structurally low.",
    controls: {
      ...DEFAULTS,
      userAdvantage: 1.45,
      userMoat: 0.78,
      learningRate: 0.026,
      nCompetitors: 58,
      marketSize: 125000,
      price: 13.3,
      demandSensitivity: 1.18,
      imitationSpeed: 0.105,
      cMean: 8.65,
      cSd: 1.08,
      fMean: 1220,
      fSd: 420,
      moatMean: 0.5,
      moatSd: 0.27,
      experimentationNoise: 0.018,
      shareAdjustment: 0.14,
    },
    leftVisual: "rent",
    rightVisual: "shakeout",
  },
  softwareFeature: {
    key: "softwareFeature",
    label: "Software feature market",
    shortLabel: "Feature",
    description: "Initial product or process improvements are cheap to observe and imitate. Learning helps, but weak moats often compress profit quickly.",
    controls: {
      ...DEFAULTS,
      userAdvantage: 0.75,
      userMoat: 0.28,
      learningRate: 0.052,
      nCompetitors: 72,
      marketSize: 155000,
      price: 11.8,
      demandSensitivity: 0.9,
      imitationSpeed: 0.34,
      cMean: 7.8,
      cSd: 0.95,
      fMean: 520,
      fSd: 170,
      moatMean: 0.25,
      moatSd: 0.18,
      experimentationNoise: 0.05,
      shareAdjustment: 0.23,
      marginSignalCap: 0.28,
    },
    leftVisual: "copy",
    rightVisual: "profit",
  },
  platformData: {
    key: "platformData",
    label: "Platform / data moat",
    shortLabel: "Data moat",
    description: "Advantage is reinforced by learning, proprietary data, scale, or ecosystem depth. A strong moat can turn a modest edge into durable concentration.",
    controls: {
      ...DEFAULTS,
      userAdvantage: 1.05,
      userMoat: 0.86,
      learningRate: 0.064,
      nCompetitors: 34,
      marketSize: 190000,
      price: 14.4,
      demandSensitivity: 0.78,
      imitationSpeed: 0.095,
      cMean: 8.25,
      cSd: 1.25,
      fMean: 1550,
      fSd: 520,
      moatMean: 0.55,
      moatSd: 0.25,
      experimentationNoise: 0.02,
      shareAdjustment: 0.15,
      marginSignalCap: 0.18,
    },
    leftVisual: "rent",
    rightVisual: "time",
  },
};

const VISUALS = [
  { key: "rent", label: "Rent durability" },
  { key: "copy", label: "Copy gap over time" },
  { key: "cost", label: "Cost / moat map" },
  { key: "share", label: "Share snapshot" },
  { key: "time", label: "Share over time" },
  { key: "profit", label: "Profit over time" },
  { key: "margin", label: "Margin over time" },
  { key: "costTime", label: "Unit cost curves" },
  { key: "shakeout", label: "Shakeout" },
];

const TIME_FILTERS = [
  { key: "default", label: "Default" },
  { key: "rankRange", label: "Final rank ranges" },
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

function softmax(values) {
  const max = Math.max(...values);
  if (!Number.isFinite(max)) return values.map(() => 0);
  const exp = values.map((v) => (Number.isFinite(v) ? Math.exp(v - max) : 0));
  const sum = d3.sum(exp);
  return exp.map((x) => x / Math.max(sum, 1e-12));
}

function formatPct(value, digits = 1) {
  if (!Number.isFinite(value)) return "--";
  return `${(value * 100).toFixed(digits)}%`;
}

function formatMoney(value, digits = 2) {
  if (!Number.isFinite(value)) return "--";
  return `$${value.toFixed(digits)}`;
}

function formatCompact(value) {
  if (!Number.isFinite(value)) return "--";
  return d3.format("~s")(value).replace("G", "B");
}

function moatLabel(value) {
  if (value < 0.25) return "Easy to copy";
  if (value < 0.55) return "Partly protected";
  if (value < 0.8) return "Hard to copy";
  return "Deep moat";
}

function averageCost(firm, q) {
  return firm.c + firm.F / Math.max(q, 1e-6);
}

function totalCost(firm, q) {
  return firm.c * q + firm.F;
}

function normalizeShares(shares, alive) {
  const liveShares = shares.map((s, i) => (alive && !alive[i] ? 0 : Math.max(0, s)));
  const total = d3.sum(liveShares);
  if (total <= 0) {
    const aliveCount = alive ? alive.filter(Boolean).length : shares.length;
    return liveShares.map((_, i) => (alive && !alive[i] ? 0 : 1 / Math.max(1, aliveCount)));
  }
  return liveShares.map((s) => s / total);
}

function computeCostBasedShares(firms, params, alive = null, startingShares = null) {
  const n = firms.length;
  let shares = startingShares ? normalizeShares(startingShares, alive) : normalizeShares(Array(n).fill(1 / n), alive);

  for (let iter = 0; iter < 220; iter++) {
    const costs = firms.map((firm, i) => {
      if (alive && !alive[i]) return Infinity;
      return averageCost(firm, Math.max(params.marketSize * shares[i], 1e-6));
    });
    const target = softmax(costs.map((cost) => (Number.isFinite(cost) ? -params.demandSensitivity * cost : -Infinity)));
    shares = normalizeShares(shares.map((s, i) => (alive && !alive[i] ? 0 : 0.82 * s + 0.18 * target[i])), alive);
  }

  return shares;
}

function computeRows(firms, shares, params, alive = null) {
  return firms.map((firm, i) => {
    const isAlive = alive ? alive[i] : true;
    if (!isAlive) {
      return {
        ...firm,
        alive: false,
        share: 0,
        q: 0,
        ac: null,
        revenue: 0,
        cost: 0,
        profit: 0,
        margin: null,
        costGapToUser: null,
      };
    }

    const share = shares[i] ?? 0;
    const q = share * params.marketSize;
    const cost = totalCost(firm, q);
    const revenue = params.price * q;
    const profit = revenue - cost;
    const margin = revenue > 0 ? profit / revenue : -1;
    return {
      ...firm,
      alive: true,
      share,
      q,
      ac: q > 0 ? cost / q : null,
      revenue,
      cost,
      profit,
      margin,
      costGapToUser: null,
    };
  });
}

function updateCosts(firms, rows, alive, params, random) {
  const userRow = rows.find((r) => r.isUser);
  const userMargin = Math.max(0, userRow?.margin ?? 0);
  const userShare = Math.max(0, userRow?.share ?? 0);
  const userLearning = params.learningRate * userMargin * (0.35 + Math.sqrt(userShare));

  return firms.map((firm, i) => {
    if (!alive[i]) return firm;

    if (firm.isUser) {
      return {
        ...firm,
        c: clamp(firm.c * (1 - userLearning), HIDDEN_MARKET.minCost, HIDDEN_MARKET.maxCost),
      };
    }

    const row = rows.find((r) => r.id === firm.id);
    if (!row?.alive || !userRow) return firm;

    const costGap = Math.max(0, firm.c - userRow.c);
    const profitSignal = clamp((userRow.margin ?? 0) - (row.margin ?? 0), 0, params.marginSignalCap);
    const copyability = 1 - userRow.moat;
    const absorptiveFriction = 1 - HIDDEN_MARKET.competitorAbsorptionPenalty * firm.moat;
    const copyForce = params.imitationSpeed * copyability * absorptiveFriction * profitSignal * (0.35 + userShare);
    const experimentation = normalRandom(random, 0, params.experimentationNoise);

    return {
      ...firm,
      c: clamp(firm.c - copyForce * costGap + experimentation, HIDDEN_MARKET.minCost, HIDDEN_MARKET.maxCost),
    };
  });
}

function summarizePeriod(rows, params) {
  const aliveRows = rows.filter((r) => r.alive);
  const competitors = aliveRows.filter((r) => !r.isUser);
  const user = rows.find((r) => r.isUser) ?? rows[0];
  const aliveShare = d3.sum(aliveRows, (r) => r.share);
  const competitorShare = d3.sum(competitors, (r) => r.share);
  const weightedMargin = aliveShare > 0 ? d3.sum(aliveRows, (r) => r.share * (r.margin ?? 0)) / aliveShare : 0;
  const weightedCompetitorCost = competitorShare > 0 ? d3.sum(competitors, (r) => r.share * r.c) / competitorShare : d3.mean(competitors, (r) => r.c) ?? user.c;
  const avgCompetitorProfit = d3.mean(competitors, (r) => r.profit) ?? 0;
  const topCompetitor = [...competitors].sort((a, b) => b.share - a.share)[0];
  const topFiveShare = d3.sum([...competitors].sort((a, b) => b.share - a.share).slice(0, 5), (r) => r.share);
  const bestCompetitorCost = d3.min(competitors, (r) => r.c) ?? user.c;
  const copyGap = Math.max(0, weightedCompetitorCost - user.c);
  const excessProfit = (user?.profit ?? 0) - avgCompetitorProfit;
  const imitationPressure = params.imitationSpeed * (1 - (user?.moat ?? 0)) * clamp((user?.margin ?? 0) - weightedMargin, 0, params.marginSignalCap);

  return {
    hhi: d3.sum(rows, (r) => r.share * r.share),
    activeCount: aliveRows.length,
    weightedMargin,
    userShare: user?.share ?? 0,
    userMargin: user?.margin ?? 0,
    userProfit: user?.profit ?? 0,
    userCost: user?.c ?? 0,
    weightedCompetitorCost,
    bestCompetitorCost,
    copyGap,
    excessProfit,
    avgCompetitorProfit,
    topCompetitorShare: topCompetitor?.share ?? 0,
    topCompetitorProfit: topCompetitor?.profit ?? 0,
    topFiveShare,
    tailShare: Math.max(0, 1 - (user?.share ?? 0) - topFiveShare),
    imitationPressure,
  };
}

function simulateDynamics(initialFirms, initialShares, params) {
  let firms = initialFirms.map((f) => ({ ...f }));
  let shares = [...initialShares];
  let alive = firms.map(() => true);
  let badPeriods = firms.map(() => 0);
  const history = [];
  const random = mulberry32(params.seed + 9001);

  for (let t = 0; t <= params.periods; t++) {
    shares = normalizeShares(shares, alive);
    let rows = computeRows(firms, shares, params, alive);
    const summary = summarizePeriod(rows, params);
    const rowsWithGaps = rows.map((row) => ({ ...row, costGapToUser: row.alive ? row.c - summary.userCost : null }));

    history.push({
      t,
      firms: firms.map((f) => ({ ...f })),
      rows: rowsWithGaps,
      ...summary,
    });

    if (t === params.periods) break;

    rows.forEach((row, i) => {
      if (!alive[i]) return;
      if ((row.margin ?? -1) < params.exitMargin || row.share < params.minShare) badPeriods[i] += 1;
      else badPeriods[i] = 0;
      if (badPeriods[i] >= params.exitLag) {
        alive[i] = false;
        shares[i] = 0;
      }
    });

    firms = updateCosts(firms, rows, alive, params, random);
    const targetShares = computeCostBasedShares(firms, params, alive, shares);
    shares = shares.map((s, i) => (alive[i] ? (1 - params.shareAdjustment) * s + params.shareAdjustment * targetShares[i] : 0));
    shares = normalizeShares(shares, alive);
  }

  return history;
}

function percentile(values, value, lowerIsBetter = true) {
  const finite = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!finite.length) return 0;
  const rank = d3.bisectLeft(finite, value) / Math.max(1, finite.length - 1);
  return lowerIsBetter ? 1 - rank : rank;
}

function Tooltip({ x, y, children, className = "" }) {
  const left = x > 280 ? x - 250 : x + 12;
  const top = y > 200 ? y - 170 : y + 18;

  return (
    <div
      className={`pointer-events-none absolute z-30 min-w-[170px] rounded-2xl border border-slate-200 bg-white/95 px-3 py-2 text-xs text-slate-700 shadow-xl backdrop-blur ${className}`}
      style={{ left, top }}
    >
      {children}
    </div>
  );
}

function Slider({ label, value, min, max, step, onChange, suffix = "", prefix = "", hint, format, comparisonLabel, comparisonValue }) {
  const displayValue = format
    ? format(value)
    : `${prefix}${Number(value).toLocaleString(undefined, { maximumFractionDigits: step < 1 ? 3 : 0 })}${suffix}`;

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
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{comparisonLabel}</div>
              <div className="text-sm font-semibold tabular-nums text-slate-700">{comparisonValue}</div>
            </div>
          </div>
        ) : (
          <div className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold tabular-nums text-slate-800">{displayValue}</div>
        )}
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-slate-950"
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

function DistributionSettingsTable({ cMean, cSd, fMean, fSd, moatMean, moatSd, setCMean, setCSd, setFMean, setFSd, setMoatMean, setMoatSd }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <table className="w-full text-xs">
        <thead className="bg-slate-50 text-slate-500">
          <tr>
            <th className="px-3 py-2 text-left font-semibold">Parameter</th>
            <th className="px-2 py-2 text-right font-semibold">Mean</th>
            <th className="px-2 py-2 text-right font-semibold">Std.</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          <tr>
            <td className="px-3 py-3 font-semibold text-slate-800">Unit cost, c</td>
            <td className="px-2 py-2"><NumberCell value={cMean} min={4} max={13} step={0.05} prefix="$" onChange={setCMean} /></td>
            <td className="px-2 py-2"><NumberCell value={cSd} min={0.05} max={3} step={0.05} prefix="$" onChange={setCSd} /></td>
          </tr>
          <tr>
            <td className="px-3 py-3 font-semibold text-slate-800">Fixed cost, F</td>
            <td className="px-2 py-2"><NumberCell value={fMean} min={80} max={3500} step={25} prefix="$" onChange={setFMean} /></td>
            <td className="px-2 py-2"><NumberCell value={fSd} min={20} max={1800} step={25} prefix="$" onChange={setFSd} /></td>
          </tr>
          <tr>
            <td className="px-3 py-3 font-semibold text-slate-800">Moat, r</td>
            <td className="px-2 py-2"><NumberCell value={moatMean} min={0} max={1} step={0.01} onChange={setMoatMean} /></td>
            <td className="px-2 py-2"><NumberCell value={moatSd} min={0.01} max={0.6} step={0.01} onChange={setMoatSd} /></td>
          </tr>
        </tbody>
      </table>
    </div>
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

function ShareBars({ rows }) {
  const [hover, setHover] = useState(null);
  const sorted = [...rows].filter((r) => r.share > 0).sort((a, b) => b.share - a.share);
  const user = sorted.find((r) => r.isUser);
  const topOthers = sorted.filter((r) => !r.isUser).slice(0, 9);
  const tail = Math.max(0, 1 - d3.sum([user, ...topOthers].filter(Boolean), (r) => r.share));
  const display = [user, ...topOthers].filter(Boolean);
  if (tail > 0.002) display.push({ id: "tail", label: "Other firms", share: tail, isTail: true });

  return (
    <div className="relative space-y-3">
      {hover && (
        <Tooltip x={hover.x} y={hover.y}>
          <div className="font-semibold text-slate-950">{hover.row.label}</div>
          <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1">
            <span className="text-slate-500">Share</span><span className="text-right font-semibold">{formatPct(hover.row.share, 2)}</span>
            {hover.row.margin != null && <><span className="text-slate-500">Margin</span><span className="text-right font-semibold">{formatPct(hover.row.margin, 1)}</span></>}
            {hover.row.c != null && <><span className="text-slate-500">Unit cost</span><span className="text-right font-semibold">{formatMoney(hover.row.c, 2)}</span></>}
            {hover.row.ac != null && <><span className="text-slate-500">Avg. cost</span><span className="text-right font-semibold">{formatMoney(hover.row.ac, 2)}</span></>}
            {hover.row.profit != null && <><span className="text-slate-500">Profit</span><span className="text-right font-semibold">{formatMoney(hover.row.profit, 0)}</span></>}
          </div>
        </Tooltip>
      )}
      {display.map((r) => (
        <div
          key={r.id}
          className="space-y-1 rounded-xl px-1 py-0.5 transition hover:bg-slate-50"
          onMouseMove={(e) => {
            const rect = e.currentTarget.parentElement.getBoundingClientRect();
            setHover({ row: r, x: e.clientX - rect.left, y: e.clientY - rect.top });
          }}
          onMouseLeave={() => setHover(null)}
        >
          <div className="flex items-center justify-between text-xs">
            <span className={r.isUser ? "font-semibold text-slate-950" : "text-slate-600"}>{r.label}</span>
            <span className="font-medium tabular-nums text-slate-700">{formatPct(r.share, 1)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <motion.div
              layout
              initial={false}
              animate={{ width: `${clamp(r.share * 100, 0, 100)}%` }}
              transition={{ type: "spring", stiffness: 190, damping: 24 }}
              className={r.isUser ? "h-full rounded-full bg-slate-950" : r.isTail ? "h-full rounded-full bg-slate-300" : "h-full rounded-full bg-slate-500"}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function CostMoatMap({ rows }) {
  const [hover, setHover] = useState(null);
  const aliveRows = rows.filter((r) => r.alive);
  const xExtent = d3.extent(aliveRows, (r) => r.c);
  const xPad = Math.max(0.3, ((xExtent[1] ?? 10) - (xExtent[0] ?? 6)) * 0.18);
  const xScale = d3.scaleLinear().domain([(xExtent[0] ?? 6) - xPad, (xExtent[1] ?? 10) + xPad]).range([0, 100]).nice();
  const yScale = d3.scaleLinear().domain([0, 1]).range([100, 0]);
  const rScale = d3.scaleSqrt().domain([0, d3.max(aliveRows, (r) => r.share) || 1]).range([7, 44]);
  const xTicks = xScale.ticks(5);
  const yTicks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="relative h-full min-h-[430px] rounded-2xl bg-white p-4">
      <div className="absolute inset-x-16 bottom-8 top-4">
        {hover && (
          <Tooltip x={hover.x} y={hover.y}>
            <div className="font-semibold text-slate-950">{hover.row.label}</div>
            <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1">
              <span className="text-slate-500">Unit cost</span><span className="text-right font-semibold">{formatMoney(hover.row.c, 2)}</span>
              <span className="text-slate-500">Moat</span><span className="text-right font-semibold">{formatPct(hover.row.moat, 0)}</span>
              <span className="text-slate-500">Share</span><span className="text-right font-semibold">{formatPct(hover.row.share, 2)}</span>
              <span className="text-slate-500">Margin</span><span className="text-right font-semibold">{formatPct(hover.row.margin ?? 0, 1)}</span>
              <span className="text-slate-500">Copy gap</span><span className="text-right font-semibold">{formatMoney(hover.row.costGapToUser ?? 0, 2)}</span>
            </div>
          </Tooltip>
        )}

        {xTicks.map((tick) => (
          <div key={`x-${tick}`} className="absolute top-0 h-full border-l border-dashed border-slate-200" style={{ left: `${xScale(tick)}%` }}>
            <div className="absolute top-full mt-2 -translate-x-1/2 whitespace-nowrap text-[11px] text-slate-500">${tick.toFixed(1)}</div>
          </div>
        ))}
        {yTicks.map((tick) => (
          <div key={`y-${tick}`} className="absolute left-0 w-full border-t border-dashed border-slate-200" style={{ top: `${yScale(tick)}%` }}>
            <div className="absolute right-full mr-2 -translate-y-1/2 whitespace-nowrap text-[11px] text-slate-500">{formatPct(tick, 0)}</div>
          </div>
        ))}
        <div className="absolute inset-0 border-b border-l border-slate-400" />

        {[...aliveRows]
          .filter((r) => !r.isUser)
          .sort((a, b) => a.share - b.share)
          .map((row) => {
            const size = rScale(row.share);
            return (
              <button
                key={row.id}
                className="absolute rounded-full border border-slate-500 bg-slate-400/55 transition hover:z-20 hover:scale-125 hover:bg-slate-500/80 focus:outline-none"
                style={{ left: `${xScale(row.c)}%`, top: `${yScale(row.moat)}%`, width: size, height: size, transform: "translate(-50%, -50%)" }}
                onMouseMove={(e) => {
                  const rect = e.currentTarget.parentElement.getBoundingClientRect();
                  setHover({ row, x: e.clientX - rect.left, y: e.clientY - rect.top });
                }}
                onMouseLeave={() => setHover(null)}
                aria-label={row.label}
              />
            );
          })}

        {aliveRows
          .filter((r) => r.isUser)
          .map((row) => {
            const size = Math.max(28, rScale(row.share) + 8);
            return (
              <button
                key={row.id}
                className="absolute z-10 rounded-full border-[3px] border-white bg-slate-950 shadow-lg transition hover:scale-125 focus:outline-none"
                style={{ left: `${xScale(row.c)}%`, top: `${yScale(row.moat)}%`, width: size, height: size, transform: "translate(-50%, -50%)" }}
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
      <AxisLabel className="absolute bottom-0 left-1/2 -translate-x-1/2">Unit cost, c</AxisLabel>
      <AxisLabel className="absolute left-1 top-1/2 -translate-y-1/2 -rotate-90">Replicability barrier, r</AxisLabel>
    </div>
  );
}

function getMetricValue(row, metricKey) {
  if (!row) return 0;
  if (metricKey === "profit") return row.profit ?? 0;
  if (metricKey === "margin") return row.margin ?? 0;
  if (metricKey === "cost") return row.c ?? 0;
  return row.share ?? 0;
}

function normalizeRankRange(range, maxRank) {
  const start = clamp(Math.round(range.start), 1, Math.max(1, maxRank));
  const end = clamp(Math.round(range.end), 1, Math.max(1, maxRank));
  return { start: Math.min(start, end), end: Math.max(start, end) };
}

function rankRangeLabel(ranges) {
  return ranges.map((range) => `${range.start}-${range.end}`).join(" + ");
}

function buildFirmTimeSeries(history, filterKey, metricKey = "share", rankRanges = []) {
  const finalRows = history[history.length - 1].rows;
  const ranked = [...finalRows].sort((a, b) => b.share - a.share);
  const rankedRivals = [...finalRows].filter((r) => !r.isUser).sort((a, b) => b.share - a.share);
  const userId = "user";

  let selectedIds;
  if (filterKey === "all") {
    selectedIds = new Set(finalRows.map((r) => r.id));
  } else if (filterKey === "rankRange") {
    selectedIds = new Set([userId]);
    const maxRank = rankedRivals.length;
    rankRanges.map((range) => normalizeRankRange(range, maxRank)).forEach((range) => {
      rankedRivals.slice(range.start - 1, range.end).forEach((rival) => selectedIds.add(rival.id));
    });
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
      { id: "user", label: "Your firm", isUser: true, width: 4, values: history.map((d) => ({ t: d.t, value: d.userShare, meta: d.rows.find((r) => r.id === "user") })) },
      { id: "top-rival", label: "Top competitor", isAggregate: true, width: 3, values: history.map((d) => {
        const top = [...d.rows].filter((r) => r.alive && !r.isUser).sort((a, b) => b.share - a.share)[0];
        return { t: d.t, value: top?.share ?? 0, meta: top ?? { label: "Top competitor" } };
      }) },
      { id: "tail", label: "Long tail", isAggregate: true, width: 3, values: history.map((d) => ({ t: d.t, value: d.tailShare, meta: { label: "Long tail", share: d.tailShare } })) },
    ];
  } else {
    selectedIds = new Set([userId, ...ranked.filter((r) => !r.isUser).slice(0, 5).map((r) => r.id)]);
  }

  const finalRankById = new Map(rankedRivals.map((row, index) => [row.id, index + 1]));

  return finalRows
    .filter((firm) => selectedIds.has(firm.id))
    .sort((a, b) => (a.isUser ? -1 : b.isUser ? 1 : (finalRankById.get(a.id) ?? 9999) - (finalRankById.get(b.id) ?? 9999)))
    .map((firm) => ({
      id: firm.id,
      label: firm.isUser ? firm.label : `${firm.label} · R${finalRankById.get(firm.id) ?? "--"}`,
      isUser: firm.isUser,
      rank: finalRankById.get(firm.id),
      width: firm.isUser ? 4 : 1.6,
      values: history.map((d) => {
        const row = d.rows.find((r) => r.id === firm.id);
        return { t: d.t, value: getMetricValue(row, metricKey), meta: row ? { ...row, finalRank: finalRankById.get(firm.id) } : row };
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
  yDomain,
}) {
  const [hover, setHover] = useState(null);
  const allPoints = series.flatMap((s) => s.values.map((p) => p.value).filter(Number.isFinite));
  const xExtent = d3.extent(history, (d) => d.t);
  const rawYExtent = d3.extent(allPoints.length ? allPoints : [0, 1]);
  const yExtent = yDomain ?? rawYExtent;
  const pad = Math.max(0.01, ((yExtent?.[1] ?? 1) - (yExtent?.[0] ?? 0)) * 0.12);
  const xScale = d3.scaleLinear().domain(xExtent).range([0, 100]);
  const yScale = d3.scaleLinear().domain(yDomain ?? [Math.min(0, (yExtent?.[0] ?? 0) - pad), (yExtent?.[1] ?? 1) + pad]).range([100, 0]).nice();
  const xTicks = xScale.ticks(6);
  const yTicks = yScale.ticks(5);

  const getColorClass = (s, index) => {
    if (s.isUser) return "bg-slate-950";
    if (s.id === "top-rival" || s.id === "weighted-competitor") return "bg-slate-500";
    if (s.id === "tail" || s.id === "best-rival") return "bg-slate-300";
    if (s.id === "excess-rent") return "bg-slate-950";
    return index % 2 === 0 ? "bg-slate-500" : "bg-slate-400";
  };

  const getOpacity = (s) => {
    if (s.isUser || s.id === "excess-rent") return 1;
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
        return { id: s.id, label: s.label, isUser: s.isUser, share: meta?.share ?? point?.value ?? 0, margin: meta?.margin, alive: meta?.alive, finalRank: meta?.finalRank };
      })
      .sort((a, b) => (a.share ?? 0) - (b.share ?? 0));

    setHover({ tableMode: true, t: nearest.t, rows, x: event.clientX - rect.left, y: event.clientY - rect.top });
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
      <div className="absolute inset-x-16 bottom-8 top-4" onMouseMove={setPeriodHover} onMouseLeave={() => setHover(null)}>
        {hover && hover.tableMode && (
          <Tooltip x={hover.x} y={hover.y} className="w-[360px]">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="font-semibold text-slate-950">Period {hover.t}</div>
              <div className="text-[11px] text-slate-500">rendered firms • low to high</div>
            </div>
            <div className="max-h-[340px] overflow-y-auto rounded-xl border border-slate-100">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-slate-50 text-slate-500">
                  <tr><th className="px-2 py-1 font-semibold">Firm</th><th className="px-2 py-1 text-right font-semibold">Rank</th><th className="px-2 py-1 text-right font-semibold">Share</th><th className="px-2 py-1 text-right font-semibold">Margin</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {hover.rows.map((row) => (
                    <tr key={row.id} className={row.isUser ? "bg-slate-950 text-white" : row.alive === false ? "bg-slate-50 text-slate-400" : "bg-white text-slate-700"}>
                      <td className="max-w-[130px] truncate px-2 py-1 font-medium">{row.label}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{row.isUser ? "You" : row.finalRank ?? "--"}</td>
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
            <div className="font-semibold text-slate-950">{hover.label}</div>
            <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1">
              <span className="text-slate-500">Period</span><span className="text-right font-semibold">{hover.t}</span>
              {hover.meta?.finalRank != null && <><span className="text-slate-500">Final rank</span><span className="text-right font-semibold">#{hover.meta.finalRank}</span></>}
              <span className="text-slate-500">{metricLabel}</span><span className="text-right font-semibold">{hover.value}</span>
              {hover.meta?.share != null && <><span className="text-slate-500">Share</span><span className="text-right font-semibold">{formatPct(hover.meta.share, 2)}</span></>}
              {hover.meta?.margin != null && <><span className="text-slate-500">Margin</span><span className="text-right font-semibold">{formatPct(hover.meta.margin, 1)}</span></>}
              {hover.meta?.c != null && <><span className="text-slate-500">Unit cost</span><span className="text-right font-semibold">{formatMoney(hover.meta.c, 2)}</span></>}
              {hover.meta?.profit != null && <><span className="text-slate-500">Profit</span><span className="text-right font-semibold">{formatMoney(hover.meta.profit, 0)}</span></>}
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
            style={{ left: `${seg.x1}%`, top: `${seg.y1}%`, width: `${seg.length}%`, height: `${seg.s.width ?? 2}px`, opacity: getOpacity(seg.s), transform: `rotate(${seg.angle}deg)` }}
          />
        ))}

        {series.map((s, seriesIndex) => {
          const points = showMany && !s.isUser ? s.values.filter((_, i) => i % 3 === 0 || i === s.values.length - 1) : s.values;
          return points.map((p) => (
            <button
              key={`${s.id}-${p.t}`}
              className={`absolute rounded-full border border-white shadow-sm transition hover:z-20 hover:scale-150 focus:outline-none ${getColorClass(s, seriesIndex)}`}
              style={{ left: `${xScale(p.t)}%`, top: `${yScale(p.value)}%`, width: s.isUser ? 9 : 7, height: s.isUser ? 9 : 7, transform: "translate(-50%, -50%)", opacity: s.isUser ? 1 : showMany ? 0.55 : 0.8 }}
              onMouseMove={(e) => {
                if (periodTableTooltip) return;
                const rect = e.currentTarget.parentElement.getBoundingClientRect();
                setHover({ label: s.label, t: p.t, value: valueFormat(p.value), meta: p.meta, x: e.clientX - rect.left, y: e.clientY - rect.top });
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

function RankRangeControl({ maxRank, rankRanges, setRankRanges }) {
  const [drag, setDrag] = useState(null);
  const ranges = rankRanges.map((range) => normalizeRankRange(range, maxRank));
  const pct = (rank) => (maxRank <= 1 ? 0 : ((rank - 1) / (maxRank - 1)) * 100);
  const rankFromEvent = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = clamp((event.clientX - rect.left) / Math.max(rect.width, 1), 0, 1);
    return clamp(Math.round(1 + x * (maxRank - 1)), 1, maxRank);
  };
  const updateRange = (index, mode, rank) => {
    setRankRanges((current) => current.map((range, i) => {
      if (i !== index) return range;
      const normalized = normalizeRankRange(range, maxRank);
      if (mode === "start") return normalizeRankRange({ ...normalized, start: rank }, maxRank);
      if (mode === "end") return normalizeRankRange({ ...normalized, end: rank }, maxRank);
      const width = normalized.end - normalized.start;
      const nextStart = clamp(Math.round(rank - width / 2), 1, Math.max(1, maxRank - width));
      return normalizeRankRange({ start: nextStart, end: nextStart + width }, maxRank);
    }));
  };
  const beginDrag = (event, index, forcedMode = null) => {
    const range = ranges[index];
    const rank = rankFromEvent(event);
    const startDistance = Math.abs(rank - range.start);
    const endDistance = Math.abs(rank - range.end);
    const inside = rank >= range.start && rank <= range.end;
    const mode = forcedMode ?? (inside && Math.min(startDistance, endDistance) > Math.max(1, Math.round(maxRank * 0.025)) ? "window" : startDistance <= endDistance ? "start" : "end");
    setDrag({ index, mode });
    updateRange(index, mode, rank);
  };
  const handleMove = (event, index) => {
    if (!drag || drag.index !== index) return;
    updateRange(index, drag.mode, rankFromEvent(event));
  };
  const addRange = () => setRankRanges((current) => {
    const used = current.map((range) => normalizeRankRange(range, maxRank));
    const last = used[used.length - 1] ?? { start: 1, end: Math.min(8, maxRank) };
    const width = Math.max(3, Math.min(9, last.end - last.start + 1));
    const start = clamp(last.end + 1, 1, Math.max(1, maxRank - width + 1));
    return [...used, normalizeRankRange({ start, end: start + width - 1 }, maxRank)].slice(0, 4);
  });
  const removeRange = (index) => setRankRanges((current) => current.filter((_, i) => i !== index));
  const selectAll = () => setRankRanges([{ start: 1, end: maxRank }]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Rival rank windows</div>
          <div className="truncate text-xs font-semibold text-slate-800">Rivals {rankRangeLabel(ranges)}</div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button onClick={selectAll} className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-200">All</button>
          <button
            onClick={addRange}
            disabled={ranges.length >= 4}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-950 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-35"
            aria-label="Add rank range"
          >
            +
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {ranges.map((range, index) => {
          const left = pct(range.start);
          const right = pct(range.end);
          return (
            <div key={index} className="grid grid-cols-[42px_1fr_auto] items-center gap-2">
              <div className="text-[11px] font-semibold tabular-nums text-slate-500">{range.start}-{range.end}</div>
              <div
                className="relative h-5 cursor-pointer rounded-full"
                onMouseDown={(e) => beginDrag(e, index)}
                onMouseMove={(e) => handleMove(e, index)}
                onMouseUp={() => setDrag(null)}
                onMouseLeave={() => setDrag(null)}
              >
                <div className="absolute left-0 right-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-slate-200" />
                <div
                  className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-slate-950"
                  style={{ left: `${left}%`, width: `${Math.max(1.2, right - left)}%` }}
                />
                <button
                  className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-slate-950 shadow"
                  style={{ left: `${left}%` }}
                  onMouseDown={(e) => { e.stopPropagation(); beginDrag(e, index, "start"); }}
                  aria-label={`Move start of range ${index + 1}`}
                />
                <button
                  className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-slate-950 shadow"
                  style={{ left: `${right}%` }}
                  onMouseDown={(e) => { e.stopPropagation(); beginDrag(e, index, "end"); }}
                  aria-label={`Move end of range ${index + 1}`}
                />
              </div>
              {ranges.length > 1 ? (
                <button onClick={() => removeRange(index)} className="h-6 w-6 rounded-full text-xs font-semibold text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">×</button>
              ) : (
                <div className="h-6 w-6" />
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[10px] font-medium text-slate-400">
        <span>R1</span>
        <span>Final rival rank</span>
        <span>R{maxRank}</span>
      </div>
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
            {VISUALS.map((v) => <option key={v.key} value={v.key}>{v.label}</option>)}
          </select>
        </div>
        <div className="flex-1">{children}</div>
      </CardContent>
    </Card>
  );
}

function FirmParameterTable({ initialRows, finalRows }) {
  const finalById = new Map(finalRows.map((r) => [r.id, r]));
  const displayRows = [...initialRows].sort((a, b) => (a.isUser ? -1 : b.isUser ? 1 : a.id.localeCompare(b.id)));

  return (
    <Card className="rounded-3xl border-slate-200 bg-white/90 shadow-sm backdrop-blur">
      <CardContent className="p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Debug firm table</h2>
            <p className="text-sm text-slate-500">Generated supply-side traits, copyability, cost drift, and simulated outcomes for every firm.</p>
          </div>
          <Database className="h-5 w-5 text-slate-400" />
        </div>
        <div className="max-h-[430px] overflow-auto rounded-2xl border border-slate-200">
          <table className="w-full min-w-[1160px] text-left text-xs">
            <thead className="sticky top-0 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-3 py-2 font-semibold">Firm</th>
                <th className="px-3 py-2 font-semibold">Type</th>
                <th className="px-3 py-2 font-semibold">c₀</th>
                <th className="px-3 py-2 font-semibold">cT</th>
                <th className="px-3 py-2 font-semibold">Δc</th>
                <th className="px-3 py-2 font-semibold">F</th>
                <th className="px-3 py-2 font-semibold">Moat</th>
                <th className="px-3 py-2 font-semibold">Initial share</th>
                <th className="px-3 py-2 font-semibold">Final share</th>
                <th className="px-3 py-2 font-semibold">Final margin</th>
                <th className="px-3 py-2 font-semibold">Final profit</th>
                <th className="px-3 py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayRows.map((row) => {
                const final = finalById.get(row.id);
                const deltaC = (final?.c ?? row.c) - row.c;
                return (
                  <tr key={row.id} className={row.isUser ? "bg-slate-950 text-white" : "bg-white text-slate-700"}>
                    <td className="px-3 py-2 font-semibold">{row.label}</td>
                    <td className="px-3 py-2">{row.isUser ? "User" : "Competitor"}</td>
                    <td className="px-3 py-2 tabular-nums">{formatMoney(row.c, 2)}</td>
                    <td className="px-3 py-2 tabular-nums">{formatMoney(final?.c ?? row.c, 2)}</td>
                    <td className="px-3 py-2 tabular-nums">{deltaC >= 0 ? "+" : ""}{formatMoney(deltaC, 2)}</td>
                    <td className="px-3 py-2 tabular-nums">{formatMoney(row.F, 0)}</td>
                    <td className="px-3 py-2 tabular-nums">{formatPct(row.moat, 0)}</td>
                    <td className="px-3 py-2 tabular-nums">{formatPct(row.share, 2)}</td>
                    <td className="px-3 py-2 tabular-nums">{formatPct(final?.share ?? 0, 2)}</td>
                    <td className="px-3 py-2 tabular-nums">{final?.margin == null ? "--" : formatPct(final.margin, 1)}</td>
                    <td className="px-3 py-2 tabular-nums">{formatMoney(final?.profit ?? 0, 0)}</td>
                    <td className="px-3 py-2">{final?.alive ? "Alive" : "Exited"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SupplySideCopyabilitySimulator() {
  const [userAdvantage, setUserAdvantage] = useState(DEFAULTS.userAdvantage);
  const [userMoat, setUserMoat] = useState(DEFAULTS.userMoat);
  const [learningRate, setLearningRate] = useState(DEFAULTS.learningRate);
  const [seed, setSeed] = useState(DEFAULTS.seed);
  const [nCompetitors, setNCompetitors] = useState(DEFAULTS.nCompetitors);
  const [marketSize, setMarketSize] = useState(DEFAULTS.marketSize);
  const [price, setPrice] = useState(DEFAULTS.price);
  const [demandSensitivity, setDemandSensitivity] = useState(DEFAULTS.demandSensitivity);
  const [imitationSpeed, setImitationSpeed] = useState(DEFAULTS.imitationSpeed);
  const [shareAdjustment, setShareAdjustment] = useState(DEFAULTS.shareAdjustment);
  const [marginSignalCap, setMarginSignalCap] = useState(DEFAULTS.marginSignalCap);
  const [experimentationNoise, setExperimentationNoise] = useState(DEFAULTS.experimentationNoise);
  const [cMean, setCMean] = useState(DEFAULTS.cMean);
  const [cSd, setCSd] = useState(DEFAULTS.cSd);
  const [fMean, setFMean] = useState(DEFAULTS.fMean);
  const [fSd, setFSd] = useState(DEFAULTS.fSd);
  const [moatMean, setMoatMean] = useState(DEFAULTS.moatMean);
  const [moatSd, setMoatSd] = useState(DEFAULTS.moatSd);
  const [periods, setPeriods] = useState(DEFAULTS.periods);
  const [exitMargin, setExitMargin] = useState(DEFAULTS.exitMargin);
  const [exitLag, setExitLag] = useState(DEFAULTS.exitLag);
  const [minShare, setMinShare] = useState(DEFAULTS.minShare);
  const [debugMode, setDebugMode] = useState(false);
  const [debugTab, setDebugTab] = useState("simulation");
  const [leftVisual, setLeftVisual] = useState("rent");
  const [rightVisual, setRightVisual] = useState("cost");
  const [timeFilter, setTimeFilter] = useState("default");
  const [rankRanges, setRankRanges] = useState([{ start: 1, end: 999 }]);
  const [regime, setRegime] = useState("generic");

  const params = useMemo(() => ({
    seed,
    marketSize,
    price,
    demandSensitivity,
    imitationSpeed,
    shareAdjustment,
    marginSignalCap,
    experimentationNoise,
    learningRate,
    periods,
    exitMargin,
    exitLag,
    minShare,
  }), [seed, marketSize, price, demandSensitivity, imitationSpeed, shareAdjustment, marginSignalCap, experimentationNoise, learningRate, periods, exitMargin, exitLag, minShare]);

  const competitors = useMemo(() => {
    const random = mulberry32(seed);
    return Array.from({ length: nCompetitors }, (_, idx) => {
      const c = clamp(normalRandom(random, cMean, cSd), HIDDEN_MARKET.minCost, HIDDEN_MARKET.maxCost);
      const F = clamp(normalRandom(random, fMean, fSd), HIDDEN_MARKET.minFixedCost, HIDDEN_MARKET.maxFixedCost);
      const moat = clamp(normalRandom(random, moatMean, moatSd), 0.01, 1);
      return {
        id: `firm-${idx + 1}`,
        label: `Firm ${idx + 1}`,
        isUser: false,
        c,
        c0: c,
        F,
        moat,
      };
    });
  }, [seed, nCompetitors, cMean, cSd, fMean, fSd, moatMean, moatSd]);

  const marketAverages = useMemo(() => ({
    c: d3.mean(competitors, (d) => d.c) ?? cMean,
    F: d3.mean(competitors, (d) => d.F) ?? fMean,
    moat: d3.mean(competitors, (d) => d.moat) ?? moatMean,
  }), [competitors, cMean, fMean, moatMean]);

  const firms = useMemo(() => {
    const userC = clamp(cMean - userAdvantage, HIDDEN_MARKET.minCost, HIDDEN_MARKET.maxCost);
    const userF = clamp(fMean * HIDDEN_MARKET.userFixedCostMultiplier + HIDDEN_MARKET.moatFixedCostLoad * userMoat * userMoat, HIDDEN_MARKET.minFixedCost, HIDDEN_MARKET.maxFixedCost);
    const user = {
      id: "user",
      label: "Your firm",
      isUser: true,
      c: userC,
      c0: userC,
      F: userF,
      moat: userMoat,
    };
    return [user, ...competitors];
  }, [cMean, fMean, userAdvantage, userMoat, competitors]);

  const initialShares = useMemo(() => computeCostBasedShares(firms, params), [firms, params]);
  const initialRows = useMemo(() => computeRows(firms, initialShares, params).map((row) => ({ ...row, costGapToUser: row.c - firms[0].c })), [firms, initialShares, params]);
  const dynamicHistory = useMemo(() => simulateDynamics(firms, initialShares, params), [firms, initialShares, params]);

  const initialPeriod = dynamicHistory[0];
  const finalPeriod = dynamicHistory[dynamicHistory.length - 1];
  const userInitial = initialPeriod.rows.find((r) => r.isUser);
  const userFinal = finalPeriod.rows.find((r) => r.isUser);
  const userShareRank = [...initialRows].sort((a, b) => b.share - a.share).findIndex((r) => r.isUser) + 1;
  const costPercentile = percentile(initialRows.map((r) => r.c), userInitial?.c ?? 0, true);
  const finalCostPercentile = percentile(finalPeriod.rows.filter((r) => r.alive).map((r) => r.c), userFinal?.c ?? 0, true);
  const initialActive = initialRows.filter((r) => (r.margin ?? -1) > exitMargin && r.share > minShare).length;
  const maxRivalRank = Math.max(1, finalPeriod.rows.filter((r) => !r.isUser).length);

  const shareSeries = useMemo(() => buildFirmTimeSeries(dynamicHistory, timeFilter, "share", rankRanges), [dynamicHistory, timeFilter, rankRanges]);
  const profitSeries = useMemo(() => buildFirmTimeSeries(dynamicHistory, timeFilter, "profit", rankRanges), [dynamicHistory, timeFilter, rankRanges]);
  const marginSeries = useMemo(() => buildFirmTimeSeries(dynamicHistory, timeFilter, "margin", rankRanges), [dynamicHistory, timeFilter, rankRanges]);
  const costSeries = useMemo(() => buildFirmTimeSeries(dynamicHistory, timeFilter, "cost", rankRanges), [dynamicHistory, timeFilter, rankRanges]);

  const rentSeries = useMemo(() => {
    if (timeFilter !== "default") return buildFirmTimeSeries(dynamicHistory, timeFilter, "profit", rankRanges);
    return [
      { id: "excess-rent", label: "Your excess profit", isUser: true, width: 4, values: dynamicHistory.map((d) => ({ t: d.t, value: d.excessProfit, meta: d.rows.find((r) => r.id === "user") })) },
      { id: "user-profit", label: "Your profit", isAggregate: true, width: 3, values: dynamicHistory.map((d) => ({ t: d.t, value: d.userProfit, meta: d.rows.find((r) => r.id === "user") })) },
      { id: "top-rival", label: "Top competitor profit", isAggregate: true, width: 3, values: dynamicHistory.map((d) => ({ t: d.t, value: d.topCompetitorProfit, meta: { label: "Top competitor" } })) },
    ];
  }, [dynamicHistory, timeFilter, rankRanges]);

  const copyGapSeries = useMemo(() => {
    if (timeFilter !== "default") return buildFirmTimeSeries(dynamicHistory, timeFilter, "cost", rankRanges);
    return [
      { id: "user", label: "Your unit cost", isUser: true, width: 4, values: dynamicHistory.map((d) => ({ t: d.t, value: d.userCost, meta: d.rows.find((r) => r.isUser) })) },
      { id: "weighted-competitor", label: "Weighted competitor cost", isAggregate: true, width: 3, values: dynamicHistory.map((d) => ({ t: d.t, value: d.weightedCompetitorCost, meta: { label: "Weighted competitor cost" } })) },
      { id: "best-rival", label: "Best rival cost", isAggregate: true, width: 3, values: dynamicHistory.map((d) => ({ t: d.t, value: d.bestCompetitorCost, meta: { label: "Best rival cost" } })) },
    ];
  }, [dynamicHistory, timeFilter, rankRanges]);

  const applyRegime = (key) => {
    const template = REGIME_TEMPLATES[key] ?? REGIME_TEMPLATES.generic;
    const c = template.controls;
    setRegime(template.key);
    setUserAdvantage(c.userAdvantage);
    setUserMoat(c.userMoat);
    setLearningRate(c.learningRate);
    setNCompetitors(c.nCompetitors);
    setMarketSize(c.marketSize);
    setPrice(c.price);
    setDemandSensitivity(c.demandSensitivity);
    setImitationSpeed(c.imitationSpeed);
    setShareAdjustment(c.shareAdjustment);
    setMarginSignalCap(c.marginSignalCap);
    setExperimentationNoise(c.experimentationNoise);
    setCMean(c.cMean);
    setCSd(c.cSd);
    setFMean(c.fMean);
    setFSd(c.fSd);
    setMoatMean(c.moatMean);
    setMoatSd(c.moatSd);
    setPeriods(c.periods);
    setExitMargin(c.exitMargin);
    setExitLag(c.exitLag);
    setMinShare(c.minShare);
    setLeftVisual(template.leftVisual);
    setRightVisual(template.rightVisual);
    setTimeFilter("default");
    setRankRanges([{ start: 1, end: 999 }]);
  };

  const reset = () => {
    applyRegime("generic");
    setSeed(DEFAULTS.seed);
    setDebugMode(false);
    setDebugTab("simulation");
  };

  const randomizeMarket = () => setSeed((s) => s + 1);
  const activeTemplate = REGIME_TEMPLATES[regime] ?? REGIME_TEMPLATES.generic;

  const renderTimeHeader = (label, value, positive) => (
    <div className="space-y-3">
      <div className="flex flex-col justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3 xl:flex-row xl:items-center">
        <div>
          <div className="text-xs text-slate-500">{label}</div>
          <div className={`text-lg font-semibold ${positive ? "text-emerald-700" : "text-rose-700"}`}>{value}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
          <span className="font-semibold text-slate-500">Lines</span>
          <select
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value)}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm outline-none focus:border-slate-400"
          >
            {TIME_FILTERS.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
          </select>
        </div>
      </div>
      {timeFilter === "rankRange" && (
        <RankRangeControl maxRank={maxRivalRank} rankRanges={rankRanges} setRankRanges={setRankRanges} />
      )}
    </div>
  );

  const renderVisual = (visualKey) => {
    switch (visualKey) {
      case "copy":
        return (
          <div className="space-y-4">
            {renderTimeHeader("User Δ unit cost", `${(userFinal?.c ?? 0) <= (userInitial?.c ?? 0) ? "" : "+"}${formatMoney((userFinal?.c ?? 0) - (userInitial?.c ?? 0), 2)}`, (userFinal?.c ?? 0) <= (userInitial?.c ?? 0))}
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="rounded-2xl bg-slate-50 p-3"><div className="text-xs text-slate-500">Initial gap</div><div className="text-lg font-semibold">{formatMoney(initialPeriod.copyGap, 2)}</div></div>
              <div className="rounded-2xl bg-slate-50 p-3"><div className="text-xs text-slate-500">Final gap</div><div className="text-lg font-semibold">{formatMoney(finalPeriod.copyGap, 2)}</div></div>
              <div className="rounded-2xl bg-slate-50 p-3"><div className="text-xs text-slate-500">Pressure</div><div className="text-lg font-semibold">{formatPct(finalPeriod.imitationPressure, 1)}</div></div>
            </div>
            <HtmlLineChart history={dynamicHistory} series={copyGapSeries} yLabel="Unit cost" valueFormat={(v) => formatMoney(v, 2)} metricLabel="Cost" showMany={timeFilter !== "default"} />
          </div>
        );
      case "cost":
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3">
              <div>
                <div className="text-xs text-slate-500">Cost percentile</div>
                <div className="text-lg font-semibold text-slate-950">{formatPct(finalCostPercentile, 0)}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-500">Moat type</div>
                <div className="text-lg font-semibold text-slate-950">{moatLabel(userMoat)}</div>
              </div>
            </div>
            <div className="h-[500px]"><CostMoatMap rows={finalPeriod.rows} /></div>
          </div>
        );
      case "share":
        return (
          <div className="space-y-4">
            <ShareBars rows={finalPeriod.rows} />
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl bg-slate-50 p-3"><div className="text-xs text-slate-500">User final profit</div><div className="text-lg font-semibold">{formatMoney(userFinal?.profit ?? 0, 0)}</div></div>
              <div className="rounded-2xl bg-slate-50 p-3"><div className="text-xs text-slate-500">Final share rank</div><div className="text-lg font-semibold">#{[...finalPeriod.rows].sort((a, b) => b.share - a.share).findIndex((r) => r.isUser) + 1}</div></div>
            </div>
          </div>
        );
      case "time":
        return (
          <div className="space-y-4">
            {renderTimeHeader("User Δ share", `${finalPeriod.userShare >= initialPeriod.userShare ? "+" : ""}${formatPct(finalPeriod.userShare - initialPeriod.userShare, 1)}`, finalPeriod.userShare >= initialPeriod.userShare)}
            <HtmlLineChart history={dynamicHistory} series={shareSeries} yLabel="Market share" valueFormat={(v) => formatPct(v, 1)} metricLabel="Share" showMany={timeFilter !== "default"} periodTableTooltip />
          </div>
        );
      case "profit":
        return (
          <div className="space-y-4">
            {renderTimeHeader("User Δ profit", `${(userFinal?.profit ?? 0) >= (userInitial?.profit ?? 0) ? "+" : ""}${formatMoney((userFinal?.profit ?? 0) - (userInitial?.profit ?? 0), 0)}`, (userFinal?.profit ?? 0) >= (userInitial?.profit ?? 0))}
            <HtmlLineChart history={dynamicHistory} series={profitSeries} yLabel="Profit" valueFormat={(v) => formatMoney(v, 0)} metricLabel="Profit" showMany={timeFilter !== "default"} />
          </div>
        );
      case "margin":
        return (
          <div className="space-y-4">
            {renderTimeHeader("User Δ margin", `${(userFinal?.margin ?? 0) >= (userInitial?.margin ?? 0) ? "+" : ""}${formatPct((userFinal?.margin ?? 0) - (userInitial?.margin ?? 0), 1)}`, (userFinal?.margin ?? 0) >= (userInitial?.margin ?? 0))}
            <HtmlLineChart history={dynamicHistory} series={marginSeries} yLabel="Margin" valueFormat={(v) => formatPct(v, 1)} metricLabel="Margin" showMany={timeFilter !== "default"} />
          </div>
        );
      case "costTime":
        return (
          <div className="space-y-4">
            {renderTimeHeader("User Δ unit cost", `${(userFinal?.c ?? 0) <= (userInitial?.c ?? 0) ? "" : "+"}${formatMoney((userFinal?.c ?? 0) - (userInitial?.c ?? 0), 2)}`, (userFinal?.c ?? 0) <= (userInitial?.c ?? 0))}
            <HtmlLineChart history={dynamicHistory} series={costSeries} yLabel="Unit cost" valueFormat={(v) => formatMoney(v, 2)} metricLabel="Unit cost" showMany={timeFilter !== "default"} />
          </div>
        );
      case "shakeout":
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="rounded-2xl bg-slate-50 p-3"><div className="text-xs text-slate-500">Initial active</div><div className="text-lg font-semibold">{initialActive}</div></div>
              <div className="rounded-2xl bg-slate-50 p-3"><div className="text-xs text-slate-500">Final active</div><div className="text-lg font-semibold">{finalPeriod.activeCount}</div></div>
              <div className="rounded-2xl bg-slate-50 p-3"><div className="text-xs text-slate-500">Final HHI</div><div className="text-lg font-semibold">{finalPeriod.hhi.toFixed(3)}</div></div>
            </div>
            <HtmlLineChart
              history={dynamicHistory}
              series={[{ id: "active", label: "Active firms", isUser: true, width: 4, values: dynamicHistory.map((d) => ({ t: d.t, value: d.activeCount, meta: { label: "Active firms" } })) }]}
              yLabel="Active firms"
              valueFormat={(v) => d3.format(".0f")(v)}
              metricLabel="Active firms"
            />
          </div>
        );
      case "rent":
      default:
        return (
          <div className="space-y-4">
            {renderTimeHeader("Rent retained", formatPct(finalPeriod.excessProfit / Math.max(Math.abs(initialPeriod.excessProfit), 1), 0), finalPeriod.excessProfit >= 0)}
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="rounded-2xl bg-slate-50 p-3"><div className="text-xs text-slate-500">Initial excess</div><div className="text-lg font-semibold">{formatMoney(initialPeriod.excessProfit, 0)}</div></div>
              <div className="rounded-2xl bg-slate-50 p-3"><div className="text-xs text-slate-500">Final excess</div><div className={`text-lg font-semibold ${finalPeriod.excessProfit >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{formatMoney(finalPeriod.excessProfit, 0)}</div></div>
              <div className="rounded-2xl bg-slate-50 p-3"><div className="text-xs text-slate-500">Rent retained</div><div className="text-lg font-semibold">{formatPct(finalPeriod.excessProfit / Math.max(Math.abs(initialPeriod.excessProfit), 1), 0)}</div></div>
            </div>
            <HtmlLineChart history={dynamicHistory} series={rentSeries} yLabel="Profit / excess rent" valueFormat={(v) => formatMoney(v, 0)} metricLabel="Profit" showMany={timeFilter !== "default"} />
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
              <GitBranch className="h-3.5 w-3.5" />
              Fixed-demand supply-side copyability simulator
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950 md:text-5xl">
              Moats, imitation, and rent decay
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 md:text-base">
              Demand substitution is fixed. You control the size of your supply advantage, how hard it is to copy, and how fast you keep learning. Competitor traits and market mechanics stay hidden unless debug mode is on.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="rounded-full" onClick={() => setDebugMode((v) => !v)}>
              <Bug className="mr-2 h-4 w-4" /> {debugMode ? "Hide debug" : "Debug mode"}
            </Button>
            <Button variant="outline" className="rounded-full" onClick={randomizeMarket}>New hidden market</Button>
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

              <div className="space-y-3 rounded-3xl border border-slate-200 bg-slate-50/80 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Copyability regime</div>
                    <div className="text-sm font-semibold text-slate-900">{activeTemplate.label}</div>
                  </div>
                  <div className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-500 shadow-sm">Preset</div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {Object.values(REGIME_TEMPLATES).map((template) => (
                    <button
                      key={template.key}
                      onClick={() => applyRegime(template.key)}
                      className={`rounded-2xl border px-3 py-2 text-left text-xs font-semibold transition ${
                        regime === template.key
                          ? "border-slate-950 bg-slate-950 text-white shadow-sm"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-100"
                      }`}
                    >
                      {template.shortLabel}
                    </button>
                  ))}
                </div>
                <p className="text-xs leading-5 text-slate-500">{activeTemplate.description}</p>
              </div>

              <Slider
                label="Supply advantage"
                value={userAdvantage}
                min={0}
                max={3}
                step={0.05}
                prefix="$"
                onChange={setUserAdvantage}
                hint="Initial unit-cost edge versus the hidden market average. This is capability, not demand differentiation."
              />
              <Slider
                label="Moat / replicability barrier"
                value={userMoat}
                min={0}
                max={1}
                step={0.01}
                onChange={setUserMoat}
                hint="Higher values slow competitors copying your supply-side edge."
                format={(v) => formatPct(v, 0)}
                comparisonLabel="Market avg."
                comparisonValue={formatPct(marketAverages.moat, 0)}
              />
              <Slider
                label="Learning rate"
                value={learningRate}
                min={0}
                max={0.09}
                step={0.001}
                onChange={setLearningRate}
                hint="How quickly your firm improves when margins and scale give room to learn."
                format={(v) => formatPct(v, 1)}
              />

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl bg-slate-50 p-3">
                  <div className="text-xs text-slate-500">Implied user c</div>
                  <div className="text-lg font-semibold">{formatMoney(userInitial?.c ?? 0, 2)}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  <div className="text-xs text-slate-500">Market avg c</div>
                  <div className="text-lg font-semibold">{formatMoney(marketAverages.c, 2)}</div>
                </div>
              </div>

              {debugMode && (
                <div className="space-y-5 rounded-3xl border border-amber-200 bg-amber-50/70 p-4">
                  <div className="flex items-center gap-2 text-amber-900"><Bug className="h-4 w-4" /><div className="text-sm font-semibold">Debug controls</div></div>

                  <div className="grid grid-cols-4 gap-2 rounded-full bg-white/70 p-1">
                    <DebugTabButton active={debugTab === "simulation"} onClick={() => setDebugTab("simulation")}>Sim</DebugTabButton>
                    <DebugTabButton active={debugTab === "market"} onClick={() => setDebugTab("market")}>Market</DebugTabButton>
                    <DebugTabButton active={debugTab === "firms"} onClick={() => setDebugTab("firms")}>Firms</DebugTabButton>
                    <DebugTabButton active={debugTab === "exit"} onClick={() => setDebugTab("exit")}>Exit</DebugTabButton>
                  </div>

                  {debugTab === "simulation" ? (
                    <div className="space-y-4">
                      <Slider label="Generated competitors" value={nCompetitors} min={5} max={150} step={1} onChange={setNCompetitors} hint="Number of non-user firms drawn at simulation start." />
                      <Slider label="Periods" value={periods} min={20} max={120} step={1} onChange={setPeriods} hint="Length of the imitation and shakeout simulation." />
                      <Slider label="Imitation speed, μ" value={imitationSpeed} min={0} max={0.75} step={0.005} onChange={setImitationSpeed} hint="How fast rivals close the cost gap when the user advantage is profitable and copyable." />
                      <Slider label="Experimentation noise" value={experimentationNoise} min={0} max={0.12} step={0.002} onChange={setExperimentationNoise} hint="Random competitor cost drift each period." />
                    </div>
                  ) : debugTab === "market" ? (
                    <div className="space-y-4">
                      <Slider label="Market price, P" value={price} min={9} max={17} step={0.1} prefix="$" onChange={setPrice} hint="Exogenous price environment. Demand substitution remains fixed." />
                      <Slider label="Market size, M" value={marketSize} min={35000} max={220000} step={2500} onChange={setMarketSize} hint="Total demand allocated across firms." />
                      <Slider label="Fixed demand substitution, λ" value={demandSensitivity} min={0.2} max={2.5} step={0.02} onChange={setDemandSensitivity} hint="Hidden cost sensitivity in the fixed demand allocation rule." />
                      <Slider label="Share adjustment, α" value={shareAdjustment} min={0.02} max={0.55} step={0.01} onChange={setShareAdjustment} hint="How quickly realized shares move toward cost-based target shares." />
                      <Slider label="Margin signal cap" value={marginSignalCap} min={0.02} max={0.6} step={0.01} onChange={setMarginSignalCap} hint="Clips the margin advantage that attracts imitators." />
                    </div>
                  ) : debugTab === "firms" ? (
                    <div className="space-y-3">
                      <div>
                        <div className="text-sm font-medium text-slate-800">Competitor distribution</div>
                        <div className="text-xs text-slate-500">Rows are hidden firm traits; competitors are truncated normal draws.</div>
                      </div>
                      <DistributionSettingsTable
                        cMean={cMean}
                        cSd={cSd}
                        fMean={fMean}
                        fSd={fSd}
                        moatMean={moatMean}
                        moatSd={moatSd}
                        setCMean={setCMean}
                        setCSd={setCSd}
                        setFMean={setFMean}
                        setFSd={setFSd}
                        setMoatMean={setMoatMean}
                        setMoatSd={setMoatSd}
                      />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <Slider label="Exit margin" value={exitMargin} min={-0.3} max={0.08} step={0.005} onChange={setExitMargin} format={(v) => formatPct(v, 1)} hint="Firms exit after this weak margin persists." />
                      <Slider label="Exit lag" value={exitLag} min={1} max={10} step={1} onChange={setExitLag} hint="Number of consecutive weak periods before exit." />
                      <Slider label="Minimum share" value={minShare} min={0.0002} max={0.01} step={0.0001} onChange={setMinShare} format={(v) => formatPct(v, 2)} hint="Firms with tiny share for long enough exit." />
                    </div>
                  )}
                </div>
              )}

              <div className="rounded-2xl bg-slate-50 p-4 text-xs leading-5 text-slate-600">
                <div className="mb-1 font-semibold text-slate-800">Hidden market assumptions</div>
                Demand substitution is fixed: shares follow a cost-sensitive logit rule using average cost. Rivals copy only through the supply side: profitable user margins create imitation pressure, but the user moat slows how quickly cost gaps close.
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-2">
              <VisualCard slotName="Left panel" selected={leftVisual} onSelect={setLeftVisual}>{renderVisual(leftVisual)}</VisualCard>
              <VisualCard slotName="Right panel" selected={rightVisual} onSelect={setRightVisual}>{renderVisual(rightVisual)}</VisualCard>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <MetricCard icon={TrendingUp} label="Initial user share" value={formatPct(userInitial?.share ?? 0, 1)} sublabel={`Rank ${userShareRank} of ${firms.length}`} />
              <MetricCard icon={Shield} label="Moat" value={formatPct(userMoat, 0)} sublabel={moatLabel(userMoat)} />
              <MetricCard icon={Zap} label="Cost position" value={formatPct(costPercentile, 0)} sublabel={`Final: ${formatPct(finalCostPercentile, 0)}`} />
              <MetricCard icon={Users} label="Active firms" value={`${initialActive}`} sublabel={`Final: ${finalPeriod.activeCount} • HHI ${finalPeriod.hhi.toFixed(3)}`} />
            </div>

            {debugMode && <FirmParameterTable initialRows={initialRows} finalRows={finalPeriod.rows} />}

            <Card className="rounded-3xl border-slate-200 bg-slate-950 text-white shadow-sm">
              <CardContent className="grid gap-5 p-5 md:grid-cols-3">
                <div>
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-400"><Layers className="h-4 w-4" />Fixed demand allocation</div>
                  <div className="mt-2 font-mono text-sm text-slate-100">sᵢ ∝ exp(-λ·ACᵢ)</div>
                  <p className="mt-2 text-sm leading-6 text-slate-300">λ is fixed in debug mode. The primary interface does not let the user change customer substitutability.</p>
                </div>
                <div>
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-400"><BarChart3 className="h-4 w-4" />Profit</div>
                  <div className="mt-2 font-mono text-sm text-slate-100">πᵢ=(P-cᵢ)Msᵢ-Fᵢ</div>
                  <p className="mt-2 text-sm leading-6 text-slate-300">Your supply advantage lowers c₀. The question is whether that profit premium survives imitation.</p>
                </div>
                <div>
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-400"><GitBranch className="h-4 w-4" />Copyability</div>
                  <div className="mt-2 font-mono text-sm text-slate-100">cⱼ,t+1 ← cⱼ,t - μ(1-r₀)Δm⁺(cⱼ-c₀)</div>
                  <p className="mt-2 text-sm leading-6 text-slate-300">Weak moats let rivals close cost gaps. Strong moats convert the same edge into durable rents.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
