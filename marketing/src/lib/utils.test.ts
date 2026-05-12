import { describe, expect, it } from "vitest";

import { cn } from "./utils";

describe("cn", () => {
  it("drops falsy values and merges conflicting Tailwind classes", () => {
    expect(cn("px-2", false && "hidden", "font-semibold", "px-4", undefined)).toBe(
      "font-semibold px-4"
    );
  });
});
