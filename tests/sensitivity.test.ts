// ============================================================
// Tests — sensitivity.test.ts
// ============================================================

import { describe, it, expect } from "vitest";
import { detectSensitivity } from "../lib/sensitivity";

describe("detectSensitivity", () => {
  it("detects captcha from text", () => {
    expect(detectSensitivity("Solve the captcha", "")).toBe("captcha");
  });
  it("detects captcha from iframe src", () => {
    expect(detectSensitivity("", "", ["https://www.google.com/recaptcha/api2/anchor"])).toBe("captcha");
  });
  it("detects OTP", () => {
    expect(detectSensitivity("Enter your one-time password", "")).toBe("otp");
  });
  it("detects payment", () => {
    expect(detectSensitivity("Card number", "Credit card details")).toBe("payment");
  });
  it("detects legal", () => {
    expect(detectSensitivity("I agree to the terms and conditions", "")).toBe("legal");
  });
  it("returns normal for safe elements", () => {
    expect(detectSensitivity("Click Submit", "Review your application")).toBe("normal");
  });
});
