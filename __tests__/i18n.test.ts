import { describe, it, expect } from "vitest";
import { check } from "../scripts/check-i18n.mjs";

describe("i18n consistency", () => {
  it("all locales have parity with en + no English placeholders", () => {
    // check() returns 0 on success, 1 on failure (and prints errors).
    // We run it inside the Vitest process so a placeholder in any locale
    // breaks the test suite alongside any other regression.
    expect(check()).toBe(0);
  });
});
