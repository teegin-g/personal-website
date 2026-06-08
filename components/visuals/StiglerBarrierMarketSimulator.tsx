"use client";

// Thin client-boundary wrapper around the existing simulator authored in
// interactive-visuals/. The .jsx file is left untouched; we only re-export it so
// MDX articles can embed it as an interactive island.
export { default } from "../../interactive-visuals/Stigler Barrier Market Simulator.jsx";
