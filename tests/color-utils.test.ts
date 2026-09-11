import { describe, expect, it } from "vitest";
import { neutralHex, neutralizePurple } from "../lib/color-utils";

describe("neutral UI accents", () => {
  it("neutralizes legacy and extracted purple accents", () => {
    for (const color of ["#8b7cf6", "#b99cff", "#800080", "#CFD4FF"]) {
      const neutral = neutralizePurple(color);
      expect(neutral).not.toBe(color);
      expect(neutral.slice(1, 3)).toBe(neutral.slice(3, 5));
      expect(neutral.slice(3, 5)).toBe(neutral.slice(5, 7));
    }
  });
  it("preserves semantic colors and existing neutrals", () => {
    for (const color of ["#d8a657", "#6eb7f7", "#1db954", "#ff0000", "#a3a3a3", "var(--brand)"]) {
      expect(neutralizePurple(color)).toBe(color);
    }
  });
  it("neutralizes every wordmark stop without changing black or white", () => {
    expect(neutralHex("#000000")).toBe("#000000");
    expect(neutralHex("#ffffff")).toBe("#ffffff");
    expect(neutralHex("#4f9cf0")).toMatch(/^#([a-f0-9]{2})\1\1$/);
  });
});
