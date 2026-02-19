import { describe, it, expect } from "vitest";
import { domainColor } from "@/lib/colors";

describe("domainColor", () => {
  it("returns an object with border, bg, and text properties", () => {
    const color = domainColor(0);
    expect(color).toHaveProperty("border");
    expect(color).toHaveProperty("bg");
    expect(color).toHaveProperty("text");
  });

  it("returns valid CSS color strings", () => {
    const color = domainColor(0);
    // Each property should be a non-empty string (hex, rgb, etc.)
    expect(typeof color.border).toBe("string");
    expect(color.border.length).toBeGreaterThan(0);
    expect(typeof color.bg).toBe("string");
    expect(color.bg.length).toBeGreaterThan(0);
    expect(typeof color.text).toBe("string");
    expect(color.text.length).toBeGreaterThan(0);
  });

  it("returns different colors for different indices", () => {
    const color0 = domainColor(0);
    const color1 = domainColor(1);
    // At least the border color should differ between adjacent indices
    expect(color0.border).not.toBe(color1.border);
  });

  it("wraps around for large indices without throwing", () => {
    expect(() => domainColor(100)).not.toThrow();
    const color = domainColor(100);
    expect(color).toHaveProperty("border");
    expect(color).toHaveProperty("bg");
    expect(color).toHaveProperty("text");
  });

  it("handles index 0 and returns a valid color", () => {
    const color = domainColor(0);
    expect(color.border).toBeTruthy();
    expect(color.bg).toBeTruthy();
    expect(color.text).toBeTruthy();
  });
});
