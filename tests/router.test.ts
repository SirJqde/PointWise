// ============================================================
// Tests — router.test.ts
// Tests keyword matching, Yahoo/Bing/DDG result parsing,
// multi-result Google-style web search, and validity ranking.
// ============================================================

import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("../lib/verifier.js", () => ({
  verifyWebsite: vi.fn(async (url: string, opts?: { queryKeywords?: string[] }) => {
    const host = new URL(url.startsWith("http") ? url : `https://${url}`).hostname;
    const isGov = host.endsWith(".gov.in") || host.endsWith(".gov");
    const isBlog = /sarkari|yojana|sevasindhukarnataka\.com/i.test(host);
    const hasKw = (opts?.queryKeywords ?? []).some((k) => host.includes(k));
    const trustScore = isGov ? (hasKw ? 93 : 85) : isBlog ? 56 : 75;
    return {
      canonical: url.startsWith("http") ? url : `https://${url}`,
      trustScore,
      warnings: isBlog ? ["Third-party info/blog site — prefer official .gov or brand portals."] : [],
      signals: [
        { name: "Live HTTPS", passed: true, detail: "Reachable" },
        { name: "DNS", passed: true, detail: "Resolved" },
        { name: "Authority", passed: !isBlog, detail: isGov ? "Gov TLD" : "Standard" },
      ],
    };
  }),
}));

import {
  analyzePromptKeywords,
  parseBingSearchHtml,
  parseDDGHtml,
  parseYahooSearchHtml,
  resolveIntent,
  scoreKeywordRelevance,
  searchWebIntent,
} from "../lib/router.js";

afterEach(() => {
  vi.restoreAllMocks();
});

const SAMPLE_YAHOO_HTML = `
<div class="compTitle options-toggle">
  <a data-matarget="algo" href="https://r.search.yahoo.com/_ylt=abc/RV=2/RU=https%3a%2f%2fsarkariyojana.com%2fbmtc-bus-pass%2f/RK=2/RS=xyz">
    <h3 class="title">BMTC Bus Pass Online Guide 2026</h3>
  </a>
</div>
<div class="compText aAbs"><p>How to apply for BMTC bus pass online.</p></div>

<div class="compTitle options-toggle">
  <a data-matarget="algo" href="https://r.search.yahoo.com/_ylt=abc/RV=2/RU=https%3a%2f%2fmybmtc.karnataka.gov.in%2f51%2fstudent-pass%2fen/RK=2/RS=xyz">
    <h3 class="title">Student Pass | Bengaluru Metropolitan Transport Corporation</h3>
  </a>
</div>
<div class="compText aAbs"><p>Official BMTC portal for student and monthly bus pass application.</p></div>

<div class="compTitle options-toggle">
  <a data-matarget="algo" href="https://r.search.yahoo.com/_ylt=abc/RV=2/RU=https%3a%2f%2fsevasindhuservices.karnataka.gov.in%2fbuspassservices%2f/RK=2/RS=xyz">
    <h3 class="title">Seva Sindhu Bus Pass Services</h3>
  </a>
</div>
<div class="compText aAbs"><p>Apply online for BMTC bus pass through Karnataka Seva Sindhu.</p></div>
`;

describe("analyzePromptKeywords", () => {
  it("extracts keywords from 'apply for a bmtc bus pass'", () => {
    const res = analyzePromptKeywords("apply for a bmtc bus pass");
    expect(res.keywords).toEqual(["bmtc", "bus", "pass"]);
    expect(res.actionWords).toEqual(["apply"]);
    expect(res.searchQuery).toBe("apply bmtc bus pass");
    expect(res.hasGovIntent).toBe(true);
  });

  it("strips filler words while preserving entities", () => {
    const res = analyzePromptKeywords("how can I renew my driving licence online");
    expect(res.keywords).toEqual(["driving", "licence"]);
    expect(res.actionWords).toEqual(["renew"]);
    expect(res.hasGovIntent).toBe(true);
  });
});

describe("scoreKeywordRelevance", () => {
  it("scores exact domain & path keyword matches higher than unrelated domains", () => {
    const analysis = analyzePromptKeywords("apply for a bmtc bus pass");
    const official = scoreKeywordRelevance(
      {
        url: "https://mybmtc.karnataka.gov.in/51/student-pass/en",
        title: "BMTC Bus Pass Apply",
        snippet: "Official bus pass portal",
      },
      analysis
    );
    const weak = scoreKeywordRelevance(
      {
        url: "https://randomnews.example.com/article",
        title: "City Transit Updates",
        snippet: "General traffic report",
      },
      analysis
    );
    expect(official.keywordScore).toBeGreaterThan(weak.keywordScore);
    expect(official.matchedKeywords).toContain("bmtc");
  });
});

describe("HTML search parsers", () => {
  it("parses Yahoo search results and decodes RU redirect URLs", () => {
    const parsed = parseYahooSearchHtml(SAMPLE_YAHOO_HTML);
    expect(parsed).toHaveLength(3);
    expect(parsed[1]?.url).toBe("https://mybmtc.karnataka.gov.in/51/student-pass/en");
    expect(parsed[1]?.title).toContain("Bengaluru Metropolitan Transport Corporation");
    expect(parsed[2]?.url).toBe("https://sevasindhuservices.karnataka.gov.in/buspassservices/");
  });

  it("parses Bing search results and decodes u=a1 base64 redirect URLs", () => {
    const b64 = btoa("https://mybmtc.karnataka.gov.in/")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const bingHtml = `
      <li class="b_algo">
        <h2><a href="https://www.bing.com/ck/a?!&&u=a1${b64}&ntb=1">BMTC Official Portal</a></h2>
        <p>Official Bengaluru bus transport website</p>
      </li>`;
    const parsed = parseBingSearchHtml(bingHtml);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.url).toBe("https://mybmtc.karnataka.gov.in/");
    expect(parsed[0]?.title).toBe("BMTC Official Portal");
  });

  it("parses DuckDuckGo HTML search results and decodes uddg URLs", () => {
    const ddgHtml = `
      <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.redbus.in%2F">RedBus Ticket Booking</a>
      <a class="result__snippet">Book bus tickets across India.</a>
    `;
    const parsed = parseDDGHtml(ddgHtml);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.url).toBe("https://www.redbus.in/");
    expect(parsed[0]?.snippet).toContain("Book bus tickets");
  });
});

describe("searchWebIntent — multi-result search + validity ranking", () => {
  it("returns multiple web links for 'apply for a bmtc bus pass' ranked by validity", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => SAMPLE_YAHOO_HTML,
      })
    );

    const response = await searchWebIntent("apply for a bmtc bus pass");
    expect(response.keywords).toContain("bmtc");
    expect(response.results.length).toBe(3);

    // Top two results must be the valid .gov.in portals, ranked above the third-party blog
    const topTwoDomains = response.results.slice(0, 2).map((r) => r.domain);
    expect(topTwoDomains).toContain("mybmtc.karnataka.gov.in");
    expect(topTwoDomains).toContain("sevasindhuservices.karnataka.gov.in");
    expect(response.results[0]?.validityScore).toBeGreaterThanOrEqual(85);
    expect(response.results[2]?.domain).toBe("sarkariyojana.com");
    expect(response.results[2]?.validityScore).toBeLessThan(70);
  });

  it("falls back to Bing/DDG if Yahoo returns HTTP error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (input: string) => {
        if (input.includes("search.yahoo.com")) {
          return { ok: false, status: 500, text: async () => "" };
        }
        if (input.includes("bing.com")) {
          return {
            ok: true,
            status: 200,
            text: async () =>
              `<li class="b_algo"><h2><a href="https://parivahan.gov.in/">Parivahan Sewa</a></h2><p>Official driving licence portal</p></li>`,
          };
        }
        return { ok: false, status: 403, text: async () => "" };
      })
    );

    const response = await searchWebIntent("renew driving licence");
    expect(response.results.length).toBe(1);
    expect(response.results[0]?.domain).toBe("parivahan.gov.in");
  });

  it("validates direct domain input directly", async () => {
    const response = await searchWebIntent("mybmtc.karnataka.gov.in");
    expect(response.results).toHaveLength(1);
    expect(response.results[0]?.url).toBe("https://mybmtc.karnataka.gov.in");
    expect(response.results[0]?.validityScore).toBeGreaterThanOrEqual(85);
  });

  it("returns empty results with warning when search providers yield nothing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Offline"))
    );

    const response = await searchWebIntent("unknown obscure query xyz");
    expect(response.results).toHaveLength(0);
    expect(response.warnings.length).toBeGreaterThan(0);
  });

  it("resolveIntent wrapper returns top ranked website", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => SAMPLE_YAHOO_HTML,
      })
    );

    const top = await resolveIntent("apply for a bmtc bus pass");
    expect(top.canonical).toMatch(/\.gov\.in/);
    expect(top.trustScore).toBeGreaterThanOrEqual(85);
  });
});
