// ============================================================
// Multi-Signal Website Validity Checker
// Quickly cross-checks candidate search results in parallel and
// produces a transparent validity score (0–100) + signal list.
//
// Signals (100 pts total):
//   1. Live HTTPS Reachability  (25 pts) — server responds over HTTPS
//   2. DNS-over-HTTPS Resolution(20 pts) — valid A/AAAA record via 1.1.1.1
//   3. Domain Authority / TLD   (25 pts) — gov/public TLD vs commercial vs spam/lookalike
//   4. TLS / CT Log Trust       (15 pts) — crt.sh or browser-verified HTTPS TLS
//   5. HSTS & Keyword Alignment (15 pts) — HSTS preload + prompt keyword in domain
// ============================================================

import type { DomainVerificationResult, VerificationSignal } from "./types.js";

export type { VerificationSignal };

export interface DetailedVerificationResult extends DomainVerificationResult {
  signals: VerificationSignal[];
}

export interface VerifyWebsiteOptions {
  queryKeywords?: string[];
  hasGovIntent?: boolean;
}

const DOH_URL = "https://1.1.1.1/dns-query";

/** Official government / public-sector TLD patterns */
const GOV_TLD_PATTERNS: RegExp[] = [
  /\.gov$/,
  /\.gov\.\w{2}$/,
  /\.gc\.ca$/,
  /\.gouv\.fr$/,
  /\.bund\.de$/,
  /\.admin\.ch$/,
  /\.govt\.nz$/,
  /\.gob\.\w{2}$/,
  /\.nic\.in$/,
  /\.edu(\.\w{2})?$/,
  /\.ac\.\w{2}$/,
];

/** Patterns indicative of third-party info blogs, aggregators, or lookalikes */
const THIRD_PARTY_BLOG_PATTERNS: RegExp[] = [
  /sarkari/i,
  /yojana/i,
  /smartbuspass/i,
  /blogspot\./i,
  /wordpress\./i,
  /medium\.com$/i,
  /quora\.com$/i,
  /reddit\.com$/i,
  /justdial\.com$/i,
  /free.*download/i,
  /\.apk/i,
  /-guide\./i,
  /portalinfo/i,
];

/**
 * Validates a full URL (preserving path) or bare domain against 5 parallel checks.
 */
export async function verifyWebsite(
  urlOrDomain: string,
  options: VerifyWebsiteOptions = {}
): Promise<DetailedVerificationResult> {
  const normalizedUrl = /^https?:\/\//i.test(urlOrDomain)
    ? urlOrDomain
    : `https://${urlOrDomain}`;

  let parsed: URL;
  try {
    parsed = new URL(normalizedUrl);
  } catch {
    return {
      canonical: "",
      trustScore: 0,
      warnings: ["Invalid URL format."],
      signals: [],
    };
  }

  const host = parsed.hostname.toLowerCase();
  const isHttps = parsed.protocol === "https:";
  const queryKeywords = options.queryKeywords ?? [];
  const hasGovIntent = Boolean(options.hasGovIntent);

  const [reachSignal, dnsSignal, ctSignal, hstsSignal] = await Promise.all([
    checkLiveReachability(normalizedUrl, host, isHttps),
    checkDNS(host),
    checkCertificateTransparency(host),
    checkHSTSPreload(host),
  ]);

  const authorityEval = evaluateDomainAuthority(host, hasGovIntent);
  const keywordMatch = checkKeywordInHost(host, queryKeywords);

  // TLS signal: pass via CT log OR via confirmed live HTTPS fetch (when crt.sh is slow/busy)
  const tlsPassed = ctSignal.passed || (isHttps && reachSignal.passed);
  const tlsScore = ctSignal.passed ? 15 : tlsPassed ? 12 : 0;
  const tlsSignal: VerificationSignal = ctSignal.passed
    ? ctSignal
    : {
        name: "TLS / CT",
        passed: tlsPassed,
        detail: tlsPassed
          ? "✅ Valid HTTPS TLS confirmed live (CT log busy)"
          : ctSignal.detail,
      };

  const hstsPts = hstsSignal.passed ? 7 : 0;
  const hostKwPts = keywordMatch.passed ? 8 : 0;

  const score = Math.min(
    100,
    (reachSignal.passed ? 25 : 0) +
      (dnsSignal.passed ? 20 : 0) +
      authorityEval.points +
      tlsScore +
      hstsPts +
      hostKwPts
  );

  const signals: VerificationSignal[] = [
    reachSignal,
    dnsSignal,
    authorityEval.signal,
    tlsSignal,
    hstsSignal,
  ];
  if (queryKeywords.length > 0) {
    signals.push(keywordMatch);
  }

  const warnings: string[] = [];
  if (!isHttps) {
    warnings.push("Connection is not HTTPS — avoid entering sensitive details.");
  }
  if (!reachSignal.passed) {
    warnings.push("Website did not respond cleanly — link may be broken or offline.");
  }
  if (!dnsSignal.passed) {
    warnings.push("Domain did not resolve via DNS.");
  }
  if (authorityEval.warning) {
    warnings.push(authorityEval.warning);
  }

  return {
    canonical: normalizedUrl,
    trustScore: score,
    warnings,
    signals,
  };
}

/** Backwards-compatible wrapper used by existing callers/tests */
export async function verifyDomain(domain: string): Promise<DetailedVerificationResult> {
  const cleanDomain = domain
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .toLowerCase();
  return verifyWebsite(`https://${cleanDomain}`);
}

// ── Signal 1: Live HTTPS Reachability ─────────────────────────

async function checkLiveReachability(
  url: string,
  expectedHost: string,
  isHttps: boolean
): Promise<VerificationSignal> {
  if (!isHttps) {
    return {
      name: "Live HTTPS",
      passed: false,
      detail: "❌ Not using HTTPS",
    };
  }
  try {
    let res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(2500),
    });

    // Many gov/portal servers return 405 Method Not Allowed for HEAD — retry lightweight GET
    if (res.status === 405 || res.status === 501) {
      res = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: AbortSignal.timeout(2500),
      });
    }

    // 2xx, 3xx, or 401/403 (bot-shielded live portal) confirm server is alive and TLS verified
    const alive = res.status < 404 || res.status === 403 || res.status === 401;
    let sameRootHost = true;
    try {
      if (res.url) {
        const finalHost = new URL(res.url).hostname.toLowerCase();
        const rootExpected = expectedHost.split(".").slice(-2).join(".");
        const rootFinal = finalHost.split(".").slice(-2).join(".");
        sameRootHost = finalHost === expectedHost || rootExpected === rootFinal;
      }
    } catch {
      sameRootHost = true;
    }

    const passed = alive && sameRootHost;
    return {
      name: "Live HTTPS",
      passed,
      detail: passed
        ? `✅ Reachable via HTTPS (HTTP ${res.status})`
        : !sameRootHost
        ? `⚠️ Redirected to external host (${res.url})`
        : `❌ Unhealthy HTTP status (${res.status})`,
    };
  } catch (err) {
    return {
      name: "Live HTTPS",
      passed: false,
      detail: `❌ Reachability check failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ── Signal 2: DNS-over-HTTPS Resolution ───────────────────────

async function checkDNS(domain: string): Promise<VerificationSignal> {
  try {
    const res = await fetch(`${DOH_URL}?name=${encodeURIComponent(domain)}&type=A`, {
      headers: { Accept: "application/dns-json" },
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) throw new Error(`DoH HTTP ${res.status}`);
    const json = (await res.json()) as {
      Status: number;
      Answer?: { data: string }[];
    };

    const resolved =
      json.Status === 0 && Array.isArray(json.Answer) && json.Answer.length > 0;
    const ip = json.Answer?.[0]?.data ?? "unknown";

    return {
      name: "DNS",
      passed: resolved,
      detail: resolved
        ? `✅ Resolves to ${ip}`
        : `❌ No DNS A record found (RCODE ${json.Status})`,
    };
  } catch (err) {
    return {
      name: "DNS",
      passed: false,
      detail: `❌ DoH query failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ── Signal 3: Domain Authority & Lookalike Check ──────────────

function evaluateDomainAuthority(
  domain: string,
  hasGovIntent: boolean
): { points: number; signal: VerificationSignal; warning?: string } {
  if (GOV_TLD_PATTERNS.some((re) => re.test(domain))) {
    return {
      points: 25,
      signal: {
        name: "Authority",
        passed: true,
        detail: "✅ Official government / public institution domain",
      },
    };
  }

  if (THIRD_PARTY_BLOG_PATTERNS.some((re) => re.test(domain))) {
    return {
      points: 4,
      signal: {
        name: "Authority",
        passed: false,
        detail: `⚠️ Unofficial guide/aggregator domain (${domain})`,
      },
      warning: "Third-party info/blog site — prefer official .gov or brand portals.",
    };
  }

  if (/\.org(\.\w{2})?$/.test(domain)) {
    return {
      points: 18,
      signal: {
        name: "Authority",
        passed: true,
        detail: "✅ Established .org domain",
      },
    };
  }

  const hyphenCount = (domain.match(/-/g) ?? []).length;
  const looksLookalike =
    hasGovIntent &&
    /(gov|seva|sindhu|passport|aadhaar|uidai|parivahan|irctc|epfo)/i.test(domain);

  if (looksLookalike || hyphenCount >= 3) {
    return {
      points: 5,
      signal: {
        name: "Authority",
        passed: false,
        detail: `⚠️ Commercial lookalike or multi-hyphen domain (${domain})`,
      },
      warning: "Unofficial domain for a government-related query — verify carefully.",
    };
  }

  return {
    points: 15,
    signal: {
      name: "Authority",
      passed: true,
      detail: `✅ Standard commercial domain (${domain})`,
    },
  };
}

// ── Signal 4: Certificate Transparency Log (crt.sh) ───────────

async function checkCertificateTransparency(domain: string): Promise<VerificationSignal> {
  try {
    const url = `https://crt.sh/?q=${encodeURIComponent(domain)}&output=json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) throw new Error(`crt.sh HTTP ${res.status}`);

    const records = (await res.json()) as {
      issuer_name?: string;
      not_after?: string;
    }[];
    const hasValid = records.some((r) => {
      if (!r.not_after) return false;
      return new Date(r.not_after) > new Date();
    });

    const issuer = records[0]?.issuer_name ?? "unknown";
    return {
      name: "TLS / CT",
      passed: records.length > 0 && hasValid,
      detail:
        records.length > 0 && hasValid
          ? `✅ ${records.length} cert(s) in CT log (${issuer.slice(0, 45)})`
          : "❌ No valid certificates found in CT logs",
    };
  } catch (err) {
    return {
      name: "TLS / CT",
      passed: false,
      detail: `⚠️ CT check unavailable: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ── Signal 5: HSTS Preload + Domain-Keyword Match ─────────────

async function checkHSTSPreload(domain: string): Promise<VerificationSignal> {
  try {
    const url = `https://hstspreload.org/api/v2/status?domain=${encodeURIComponent(domain)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) throw new Error(`HSTS API HTTP ${res.status}`);

    const json = (await res.json()) as { status?: string };
    const preloaded = json.status === "preloaded";

    return {
      name: "HSTS",
      passed: preloaded,
      detail: preloaded
        ? "✅ Domain is on HSTS preload list"
        : `⚠️ Not HSTS preloaded (${json.status ?? "unknown"})`,
    };
  } catch (err) {
    return {
      name: "HSTS",
      passed: false,
      detail: `⚠️ HSTS check unavailable`,
    };
  }
}

function checkKeywordInHost(
  domain: string,
  keywords: string[]
): VerificationSignal {
  const matched = keywords.filter((kw) => kw.length >= 3 && domain.includes(kw));
  const passed = matched.length > 0;
  return {
    name: "Domain Match",
    passed,
    detail: passed
      ? `✅ Domain matches prompt keyword (${matched.join(", ")})`
      : "⚠️ Domain name doesn't directly contain prompt keywords",
  };
}
