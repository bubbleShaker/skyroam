import { describe, expect, it, vi } from "vitest";
import { CompositeInput } from "./CompositeInput";
import {
  NEUTRAL_INPUT,
  type FlightInput,
  type InputSource,
} from "../flight/FlightInput";

function source(name: string, input: Partial<FlightInput>): InputSource {
  return { name, read: () => ({ ...NEUTRAL_INPUT, ...input }) };
}

describe("CompositeInput", () => {
  it("入力源が無ければ入力なし", () => {
    expect(new CompositeInput().read()).toEqual(NEUTRAL_INPUT);
  });

  it("操作していない側の 0 が、操作している側を打ち消さない", () => {
    const composite = new CompositeInput(
      source("idle", {}),
      source("touch", { roll: 0.7, pitch: -0.4 }),
    );
    expect(composite.read().roll).toBeCloseTo(0.7);
    expect(composite.read().pitch).toBeCloseTo(-0.4);
  });

  it("両方が動いている時は倒し込みの大きい方が勝つ", () => {
    const composite = new CompositeInput(
      source("keyboard", { roll: 1 }),
      source("touch", { roll: -0.3 }),
    );
    expect(composite.read().roll).toBe(1);
  });

  it("負の側が大きければ負が勝つ（符号を保つ）", () => {
    const composite = new CompositeInput(
      source("keyboard", { roll: 0.2 }),
      source("touch", { roll: -0.9 }),
    );
    expect(composite.read().roll).toBeCloseTo(-0.9);
  });

  it("羽ばたきとブーストはどちらかが押されていれば有効", () => {
    const composite = new CompositeInput(
      source("keyboard", { flap: true }),
      source("touch", { boost: true }),
    );
    expect(composite.read()).toMatchObject({ flap: true, boost: true });
  });

  it("dispose は全ての入力源に伝わる", () => {
    const dispose = vi.fn();
    const composite = new CompositeInput(
      { ...source("a", {}), dispose },
      source("b", {}),
    );
    composite.dispose();
    expect(dispose).toHaveBeenCalledOnce();
  });
});
