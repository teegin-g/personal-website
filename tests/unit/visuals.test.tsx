import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import StiglerBarrierMarketSimulator from "@/components/visuals/StiglerBarrierMarketSimulator";

describe("StiglerBarrierMarketSimulator wrapper", () => {
  it("mounts without throwing and renders interactive controls", () => {
    const { container, getByText } = render(<StiglerBarrierMarketSimulator />);
    // Guards the @/ alias resolution + the "use client" re-export wiring.
    expect(container.firstChild).toBeTruthy();
    // A known control from the simulator proves the real component mounted.
    expect(getByText(/Reset/)).toBeTruthy();
  });
});
