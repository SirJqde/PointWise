// ============================================================
// Tests — verifier.test.ts
// Verifies multi-signal website validity scoring (Live HTTPS,
// DNS DoH, Domain Authority / Lookalike check, TLS/CT, HSTS).
// ============================================================

import { describe, it, expect, vi, afterEach } from "vitest";
import { verifyWebsite } from "../lib/verifier.js";

afterEach(() => {
  vi.restoreAllMocks();
});

function stubNetworkMocks(opts: {
  liveOk?: boolean;
  liveStatus?: number;
  dnsResolved?: boolean;
  ctValid?: boolean;
  hstsPreloaded?: boolean;
}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) => {
      if (input.includes("1.1.1.1/dns-query")) {
        return {
          ok: true,
          status: 200,
          json: async () =>
            opts.dnsResolved === false
              ? { Status: 3, Answer: [] }
              : { Status: 0, Answer: [{ data: "103.10.20.30" }] },
        };
      }
      if (input.includes("crt.sh")) {
        if (opts.ctValid === false) throw new Error("timeout");
        return {
          ok: true,
          status: 200,
          json: async () => [{ issuer_name: "Let's Encrypt", not_after: "2029-01-01T00:00:00Z" }],
        };
      }
      if (input.includes("hstspreload.org")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ status: opts.hstsPreloaded ? "preloaded" : "unknown" }),
        };
      }
      if (opts.liveOk === false) {
        throw new Error("Connection refused");
      }
      return {
        ok: true,
        status: opts.liveStatus ?? 200,
        url: input,
      };
    })
  );
}

describe("verifyWebsite", () => {
  it("scores official .gov.in website matching query keyword very high (≥ 90)", async () => {
    stubNetworkMocks({ liveOk: true, dnsResolved: true, ctValid: false, hstsPreloaded: false });

    const res = await verifyWebsite("https://mybmtc.karnataka.gov.in/51/student-pass/en", {
      queryKeywords: ["bmtc", "bus", "pass"],
      hasGovIntent: true,
    });

    expect(res.trustScore).toBeGreaterThanOrEqual(90);
    expect(res.warnings).toHaveLength(0);
    expect(res.signals.find((s) => s.name === "Authority")?.passed).toBe(true);
    expect(res.signals.find((s) => s.name === "Live HTTPS")?.passed).toBe(true);
  });

  it("penalizes third-party lookalike/blog domains with warning", async () => {
    stubNetworkMocks({ liveOk: true, dnsResolved: true, ctValid: true, hstsPreloaded: false });

    const res = await verifyWebsite("https://sevasindhukarnataka.com/bmtc-pass/", {
      queryKeywords: ["bmtc", "bus", "pass"],
      hasGovIntent: true,
    });

    expect(res.trustScore).toBeLessThan(70);
    expect(res.warnings.length).toBeGreaterThan(0);
    expect(res.signals.find((s) => s.name === "Authority")?.passed).toBe(false);
  });

  it("scores unreachable / non-resolving domain near zero", async () => {
    stubNetworkMocks({ liveOk: false, dnsResolved: false, ctValid: false, hstsPreloaded: false });

    const res = await verifyWebsite("https://fake-bus-pass-portal.xyz/", {
      queryKeywords: ["bmtc"],
      hasGovIntent: true,
    });

    expect(res.trustScore).toBeLessThan(25);
    expect(res.warnings.some((w) => w.includes("did not respond"))).toBe(true);
    expect(res.warnings.some((w) => w.includes("DNS"))).toBe(true);
  });

  it("keeps legitimate commercial portals like redbus.in high-scoring", async () => {
    stubNetworkMocks({ liveOk: true, dnsResolved: true, ctValid: true, hstsPreloaded: true });

    const res = await verifyWebsite("https://www.redbus.in/", {
      queryKeywords: ["redbus", "bus"],
      hasGovIntent: false,
    });

    expect(res.trustScore).toBeGreaterThanOrEqual(80);
  });
});
