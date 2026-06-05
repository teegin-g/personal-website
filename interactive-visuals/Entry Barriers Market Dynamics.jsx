import React, { useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, AreaChart, Area } from "recharts";
import { motion } from "framer-motion";

function money(value) {
  if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(1)}B`;
  return `$${value.toFixed(0)}M`;
}

const presets = [
  {
    label: "Local services",
    description: "Small prize, low entry burden",
    profitPool: 80,
    entryBurden: 6,
  },
  {
    label: "SaaS niche",
    description: "Large prize, modest entry burden",
    profitPool: 450,
    entryBurden: 18,
  },
  {
    label: "Airlines",
    description: "Large prize, high entry burden",
    profitPool: 700,
    entryBurden: 95,
  },
  {
    label: "Refining / pipelines",
    description: "Very large prize, very high entry burden",
    profitPool: 1300,
    entryBurden: 180,
  },
];

function Slider({ label, value, min, max, step, onChange, helper }) {
  return (
    <label className="block rounded-2xl bg-white p-5 shadow-sm border border-slate-200">
      <div className="flex items-start justify-between gap-4 mb-2">
        <div>
          <span className="text-sm font-semibold text-slate-800">{label}</span>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">{helper}</p>
        </div>
        <span className="text-lg font-bold text-slate-950 whitespace-nowrap">{money(value)}</span>
      </div>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-slate-900 mt-3"
      />
    </label>
  );
}

function MetricCard({ title, value, helper }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="rounded-2xl bg-white p-5 shadow-sm border border-slate-200"
    >
      <div className="text-sm text-slate-500 mb-1">{title}</div>
      <div className="text-3xl font-bold tracking-tight text-slate-950">{value}</div>
      <div className="text-xs text-slate-500 mt-2 leading-relaxed">{helper}</div>
    </motion.div>
  );
}

export default function EntryBarrierMarketDynamics() {
  const [profitPool, setProfitPool] = useState(500);
  const [entryBurden, setEntryBurden] = useState(45);

  const model = useMemo(() => {
    const maxCompetitors = 14;
    const rivalryIntensity = 0.42;
    const rows = [];

    for (let n = 1; n <= maxCompetitors; n += 1) {
      // As more competitors enter, the industry does not just split the prize;
      // rivalry also reduces the total amount firms can capture.
      const rivalryErosion = rivalryIntensity * (1 - 1 / Math.sqrt(n));
      const capturedProfitPool = profitPool * (1 - rivalryErosion);
      const profitBeforeEntryBurden = capturedProfitPool / n;
      const profitAfterEntryBurden = profitBeforeEntryBurden - entryBurden;

      rows.push({
        n,
        capturedProfitPool,
        profitBeforeEntryBurden,
        profitAfterEntryBurden,
        rivalryErosion,
        viable: profitAfterEntryBurden >= 0,
      });
    }

    const viableRows = rows.filter((row) => row.viable);
    const equilibrium = viableRows.length ? viableRows[viableRows.length - 1] : rows[0];
    const equilibriumN = viableRows.length ? equilibrium.n : 0;
    const nextEntrant = rows.find((row) => row.n === equilibriumN + 1) || rows[rows.length - 1];
    const hhi = equilibriumN > 0 ? Math.round(10000 / equilibriumN) : 10000;

    return { rows, equilibrium, equilibriumN, nextEntrant, hhi };
  }, [profitPool, entryBurden]);

  const marketLabel = model.equilibriumN === 0
    ? "No stable entry"
    : model.equilibriumN === 1
      ? "Monopoly-like"
      : model.equilibriumN <= 3
        ? "Concentrated"
        : model.equilibriumN <= 6
          ? "Oligopoly"
          : "Fragmented";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-5">
        <header className="rounded-3xl bg-white border border-slate-200 shadow-sm p-6 md:p-8">
          <div className="inline-flex rounded-full bg-slate-900 text-white px-3 py-1 text-xs font-medium tracking-wide mb-4">
            Interactive model
          </div>
          <div className="grid lg:grid-cols-[1.25fr_.75fr] gap-6 items-end">
            <div>
              <h1 className="text-3xl md:text-5xl font-bold tracking-tight">How entry barriers shape competition</h1>
              <p className="mt-3 text-slate-600 max-w-3xl leading-relaxed">
                A market attracts new competitors when the prize is large enough to cover the cost of entering. Move the two sliders to compare industries where entry is easy, expensive, or somewhere in between.
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 text-sm text-slate-600 leading-relaxed">
              <div className="font-semibold text-slate-900 mb-1">Rule of thumb</div>
              Entry continues until the next competitor would earn less than the cost of getting into the market.
            </div>
          </div>
        </header>

        <section className="grid md:grid-cols-4 gap-4">
          <MetricCard
            title="Likely competitors"
            value={model.equilibriumN}
            helper={`Market structure: ${marketLabel}`}
          />
          <MetricCard
            title="Profit pool left"
            value={money(model.equilibrium.capturedProfitPool)}
            helper="After rivalry reduces what firms can capture"
          />
          <MetricCard
            title="Profit per firm"
            value={money(model.equilibrium.profitAfterEntryBurden)}
            helper="At the likely competitor count"
          />
          <MetricCard
            title="HHI proxy"
            value={model.hhi.toLocaleString()}
            helper="Simple equal-share concentration measure"
          />
        </section>

        <main className="grid lg:grid-cols-[360px_1fr] gap-5">
          <aside className="space-y-4">
            <Slider
              label="Available profit pool"
              value={profitPool}
              min={50}
              max={1500}
              step={25}
              onChange={setProfitPool}
              helper="How much annual profit firms could capture before entry costs and rivalry."
            />
            <Slider
              label="Entry burden"
              value={entryBurden}
              min={0}
              max={250}
              step={5}
              onChange={setEntryBurden}
              helper="Annualized cost of entering and operating at minimum viable scale."
            />

            <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4">
              <div className="text-sm font-semibold text-slate-900 mb-3">Try an industry shape</div>
              <div className="grid gap-2">
                {presets.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => {
                      setProfitPool(preset.profitPool);
                      setEntryBurden(preset.entryBurden);
                    }}
                    className="text-left rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 p-3 transition"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-slate-900">{preset.label}</span>
                      <span className="text-xs text-slate-500">{money(preset.profitPool)} / {money(preset.entryBurden)}</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">{preset.description}</div>
                  </button>
                ))}
              </div>
            </div>
          </aside>

          <section className="space-y-5">
            <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-xl font-bold tracking-tight">When does entry stop?</h2>
                  <p className="text-sm text-slate-500 mt-1">
                    The line shows profit available to each firm before paying the entry burden. Firms keep entering while the line sits above the entry-cost threshold.
                  </p>
                </div>
                <div className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
                  Equilibrium: {model.equilibriumN} competitors
                </div>
              </div>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={model.rows} margin={{ top: 12, right: 20, bottom: 8, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="n" label={{ value: "Competitors", position: "insideBottom", offset: -4 }} />
                    <YAxis tickFormatter={(v) => `$${v}M`} />
                    <Tooltip
                      formatter={(value, name) => [money(Number(value)), name]}
                      labelFormatter={(label) => `${label} competitors`}
                    />
                    <ReferenceLine y={entryBurden} strokeDasharray="4 4" label="entry burden" />
                    {model.equilibriumN > 0 && <ReferenceLine x={model.equilibriumN} strokeDasharray="4 4" />}
                    <Line type="monotone" dataKey="profitBeforeEntryBurden" name="Profit available per firm" strokeWidth={3} dot />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid md:grid-cols-[1fr_.9fr] gap-5">
              <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5">
                <h2 className="text-xl font-bold tracking-tight mb-1">What happens to the prize?</h2>
                <p className="text-sm text-slate-500 mb-4">More competitors divide the market and intensify rivalry, which reduces the total profit firms can capture.</p>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={model.rows} margin={{ top: 12, right: 20, bottom: 8, left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="n" />
                      <YAxis tickFormatter={(v) => `$${v}M`} />
                      <Tooltip formatter={(value, name) => [money(Number(value)), name]} labelFormatter={(label) => `${label} competitors`} />
                      <Area type="monotone" dataKey="capturedProfitPool" name="Profit pool left" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-2xl bg-slate-900 text-white shadow-sm p-5 flex flex-col justify-between">
                <div>
                  <div className="text-sm uppercase tracking-wide text-slate-300">Reader takeaway</div>
                  <p className="mt-3 text-lg font-semibold leading-snug">
                    Big markets do not always become crowded. They become crowded when the prize is large relative to the cost of entering.
                  </p>
                  <p className="mt-3 text-sm text-slate-300 leading-relaxed">
                    In this scenario, the next entrant would earn {money(model.nextEntrant.profitAfterEntryBurden)} after covering the entry burden, so entry {model.nextEntrant.profitAfterEntryBurden >= 0 ? "still looks attractive" : "is no longer attractive"}.
                  </p>
                </div>
                <div className="mt-6 rounded-2xl bg-white/10 p-4 text-sm text-slate-200 leading-relaxed">
                  <div className="font-semibold text-white mb-1">Simplified formula</div>
                  Profit per firm = profit pool left ÷ competitors − entry burden
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
