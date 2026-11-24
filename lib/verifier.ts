// ============================================================
// Multi-Signal Domain Verifier
// Runs 4 independent checks in parallel and aggregates into a
// single trust score + warnings list.
//
// Checks:
//   1. Trusted-TLD pattern (.gov, .gov.in, .gov.uk, etc.)
//   2. DNS-over-HTTPS A/AAAA record resolution (Cloudflare DoH)
//   3. Certificate Transparency log — confirms cert is known-good
//   4. HSTS preload list membership (via hstspreload.org)
//
// No network requests are made with user data — only the domain
// string itself is transmitted (to public, unauthenticated APIs).
// ============================================================

import type { DomainVerificationResult } from "./types.js";

const DOH_URL = "https://1.1.1.1/dns-query";

/** Official government TLD patterns — these alone boost trust significantly */
const GOV_TLD_PATTERNS: RegExp[] = [
  /\.gov$/,           // USA + generic
  /\.gov\.\w{2}$/,    // .gov.in .gov.uk .gov.au .gov.sg .gov.za etc.
  /\.gc\.ca$/,        // Canada federal
  /\.gouv\.fr$/,      // France
  /\.bund\.de$/,      // Germany federal
  /\.admin\.ch$/,     // Switzerland
  /\.govt\.nz$/,      // New Zealand
  /\.gob\.\w{2}$/,    // Spanish-speaking (.gob.mx, .gob.ar, etc.)
  /\.nic\.in$/,       // India NIC (National Informatics Centre)
  /\.uidai\.gov\.in$/, // Aadhaar authority
];

export interface VerificationSignal {
  name: string;
  passed: boolean;
  detail: string;
}

export interface DetailedVerificationResult extends DomainVerificationResult {
  signals: VerificationSignal[];
}

/**
 * Runs all 4 verification signals in parallel against a domain string.
 * Returns a consolidated trust score (0–100) + per-signal breakdown.
 */
export async function verifyDomain(domain: string): Promise<DetailedVerificationResult> {
  const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase();

  const [tldSignal, dnsSignal, ctSignal, hstsSignal] = await Promise.all([
    checkTrustedTLD(cleanDomain),
    checkDNS(cleanDomain),
    checkCertificateTransparency(cleanDomain),
    checkHSTSPreload(cleanDomain),
  ]);

  const signals = [tldSignal, dnsSignal, ctSignal, hstsSignal];
  const passCount = signals.filter((s) => s.passed).length;

  // Weighted scoring:
  //   TLD match  → 40 pts (strongest indicator for gov sites)
  //   DNS        → 25 pts (domain actually resolves)
  //   CT log     → 20 pts (cert has been seen in public log)
  //   HSTS       → 15 pts (security hardening)
  const score =
    (tldSignal.passed ? 40 : 0) +
    (dnsSignal.passed ? 25 : 0) +
    (ctSignal.passed ? 20 : 0) +
    (hstsSignal.passed ? 15 : 0);

  const warnings: string[] = [];
  if (!tldSignal.passed) warnings.push("Domain is not on a government TLD — verify carefully.");
  if (!dnsSignal.passed) warnings.push("Domain did not resolve via DNS — may be offline or misspelled.");
  if (!ctSignal.passed) warnings.push("No certificate found in CT logs — could be very new or suspicious.");
  if (!hstsSignal.passed) warnings.push("Not on HSTS preload list — connection may be less secure.");

  return {
    canonical: `https://${cleanDomain}`,
    trustScore: score,
    warnings,
    signals,
  };
}

// ── Signal 1: Trusted TLD Pattern ─────────────────────────────

async function checkTrustedTLD(domain: string): Promise<VerificationSignal> {
  const matched = GOV_TLD_PATTERNS.some((re) => re.test(domain));
  return {
    name: "Trusted TLD",
    passed: matched,
    detail: matched
      ? `✅ Domain uses a government TLD pattern`
      : `⚠️ Not a government TLD (${domain})`,
  };
}

// ── Signal 2: DNS-over-HTTPS Resolution ───────────────────────

async function checkDNS(domain: string): Promise<VerificationSignal> {
  try {
    const res = await fetch(`${DOH_URL}?name=${domain}&type=A`, {
      headers: { Accept: "application/dns-json" },
    });
    if (!res.ok) throw new Error(`DoH HTTP ${res.status}`);
    const json = (await res.json()) as { Status: number; Answer?: { data: string }[] };

    const resolved = json.Status === 0 && Array.isArray(json.Answer) && json.Answer.length > 0;
    const ip = json.Answer?.[0]?.data ?? "unknown";

    return {
      name: "DNS Resolution",
      passed: resolved,
      detail: resolved
        ? `✅ Resolves to ${ip}`
        : `❌ No A record found (RCODE ${json.Status})`,
    };
  } catch (err) {
    return { name: "DNS Resolution", passed: false, detail: `❌ DoH query failed: ${err}` };
  }
}

// ── Signal 3: Certificate Transparency Log (crt.sh) ───────────

async function checkCertificateTransparency(domain: string): Promise<VerificationSignal> {
  try {
    // crt.sh returns JSON when ?output=json is appended
    const url = `https://crt.sh/?q=${encodeURIComponent(domain)}&output=json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) throw new Error(`crt.sh HTTP ${res.status}`);

    const records = (await res.json()) as { issuer_name?: string; not_after?: string }[];
    const hasValid = records.some((r) => {
      if (!r.not_after) return false;
      return new Date(r.not_after) > new Date(); // cert not yet expired
    });

    const issuer = records[0]?.issuer_name ?? "unknown";
    return {
      name: "Certificate Transparency",
      passed: records.length > 0 && hasValid,
      detail:
        records.length > 0 && hasValid
          ? `✅ ${records.length} cert(s) in CT log — issuer: ${issuer.slice(0, 60)}`
          : `❌ No valid certificates found in CT logs`,
    };
  } catch (err) {
    return {
      name: "Certificate Transparency",
      passed: false,
      detail: `⚠️ CT check unavailable: ${err}`,
    };
  }
}

// ── Signal 4: HSTS Preload List ───────────────────────────────

async function checkHSTSPreload(domain: string): Promise<VerificationSignal> {
  try {
    // hstspreload.org has a public status API
    const url = `https://hstspreload.org/api/v2/status?domain=${encodeURIComponent(domain)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`HSTS API HTTP ${res.status}`);

    const json = (await res.json()) as { status?: string };
    const preloaded = json.status === "preloaded";

    return {
      name: "HSTS Preload",
      passed: preloaded,
      detail: preloaded
        ? `✅ Domain is on the HSTS preload list`
        : `⚠️ Not preloaded (status: ${json.status ?? "unknown"})`,
    };
  } catch (err) {
    return {
      name: "HSTS Preload",
      passed: false,
      detail: `⚠️ HSTS check unavailable: ${err}`,
    };
  }
}
