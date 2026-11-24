// ============================================================
// Tests — scrubber.test.ts
// ============================================================

import { describe, it, expect } from "vitest";
import { isSensitiveField, scrubText } from "../lib/scrubber";

describe("isSensitiveField", () => {
  it("flags password fields", () => {
    expect(isSensitiveField("Enter password")).toBe(true);
  });
  it("flags OTP fields", () => {
    expect(isSensitiveField("Enter OTP")).toBe(true);
  });
  it("flags credit card fields", () => {
    expect(isSensitiveField("Card Number", "cc-number")).toBe(true);
  });
  it("passes normal fields", () => {
    expect(isSensitiveField("First Name", "firstName")).toBe(false);
  });
});

describe("scrubText", () => {
  it("redacts email addresses", () => {
    expect(scrubText("Contact us at john@example.com today")).not.toContain("john@example.com");
  });
  it("redacts phone numbers", () => {
    expect(scrubText("Call 9876543210 for support")).not.toContain("9876543210");
  });
  it("redacts PAN numbers", () => {
    expect(scrubText("Your PAN is ABCDE1234F")).not.toContain("ABCDE1234F");
  });
  it("truncates long strings", () => {
    const long = "a".repeat(200);
    expect(scrubText(long).length).toBeLessThanOrEqual(124); // 120 + "…"
  });
  it("passes clean text unchanged", () => {
    expect(scrubText("Click the Submit button")).toBe("Click the Submit button");
  });
});
