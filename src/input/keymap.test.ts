import { describe, expect, it } from "vitest";
import { isBoundKey, keysToInput } from "./keymap";

describe("keysToInput", () => {
  it("何も押していなければ入力なし", () => {
    expect(keysToInput(new Set())).toEqual({
      pitch: 0,
      roll: 0,
      flap: false,
      boost: false,
    });
  });

  it("WASD と矢印キーは同じ操作に割り当たっている", () => {
    expect(keysToInput(new Set(["KeyW"]))).toEqual(
      keysToInput(new Set(["ArrowUp"])),
    );
    expect(keysToInput(new Set(["KeyD"]))).toEqual(
      keysToInput(new Set(["ArrowRight"])),
    );
  });

  it("W で機首上げ、S で機首下げ", () => {
    expect(keysToInput(new Set(["KeyW"])).pitch).toBe(1);
    expect(keysToInput(new Set(["KeyS"])).pitch).toBe(-1);
  });

  it("D で右バンク、A で左バンク", () => {
    expect(keysToInput(new Set(["KeyD"])).roll).toBe(1);
    expect(keysToInput(new Set(["KeyA"])).roll).toBe(-1);
  });

  it("逆方向の同時押しは打ち消し合う", () => {
    const input = keysToInput(new Set(["KeyW", "KeyS", "KeyA", "KeyD"]));
    expect(input.pitch).toBe(0);
    expect(input.roll).toBe(0);
  });

  it("Space で羽ばたき、Shift でブースト（左右どちらの Shift でも）", () => {
    expect(keysToInput(new Set(["Space"])).flap).toBe(true);
    expect(keysToInput(new Set(["ShiftLeft"])).boost).toBe(true);
    expect(keysToInput(new Set(["ShiftRight"])).boost).toBe(true);
  });

  it("割り当ての無いキーは無視する", () => {
    expect(keysToInput(new Set(["KeyQ", "Enter", "F5"]))).toEqual(
      keysToInput(new Set()),
    );
  });
});

describe("isBoundKey", () => {
  it("ゲームが使うキーだけを true にする（既定動作を止める対象の判定）", () => {
    expect(isBoundKey("Space")).toBe(true);
    expect(isBoundKey("ArrowDown")).toBe(true);
    expect(isBoundKey("F5")).toBe(false);
    expect(isBoundKey("Tab")).toBe(false);
  });
});
