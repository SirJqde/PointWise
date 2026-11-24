// ============================================================
// PointWise — Keyword-Matched Web Search Router
//
// Pipeline (NO static website registry):
//   1. Keyword Matching & Extraction: extracts core nouns,
//      acronyms, and intent cues from the user's natural prompt.
//   2. Direct URL/Domain check (if user typed a site directly).
//   3. Live Web Search: fetches multiple organic web results
//      (Google-style links with title, URL, and snippet).
//   4. Parallel Validity Checker: cross-checks each candidate
//      website (Live HTTPS, DNS, Gov/Authority TLD, TLS/CT, HSTS)
//      and scores + ranks results by validity & keyword match.
// ============================================================

import {
  verifyWebsite,
  type DetailedVerificationResult,
} from "./verifier.js";
import type { SearchResultItem, WebSearchResponse } from "./types.js";

export type { DetailedVerificationResult, SearchResultItem, WebSearchResponse };

// ── Keyword Extraction & Prompt Analysis ──────────────────────

const FILLER_WORDS = new Set([
  "a", "an", "the", "to", "for", "my", "on", "in", "of", "and", "or",
  "with", "from", "by", "at", "into", "is", "are", "how", "can", "i",
  "want", "need", "please", "me", "help", "find", "get", "open", "show",
  "website", "site", "web", "page", "portal", "link", "online", "official",
]);

const ACTION_VERBS = new Set([
  "apply", "book", "renew", "file", "pay", "check", "register",
  "download", "update", "track", "buy", "order", "search", "login",
  "verify", "cancel", "claim", "enroll", "submit",
]);

const GOV_INTENT_PATTERN =
  /\b(apply|renew|file|pass|licence|license|passport|aadhaar|aadhar|pan|tax|itr|gst|epfo|pf|voter|ration|scholarship|pension|challan|parivahan|sarathi|seva|sindhu|bmtc|ksrtc|irctc|gov|government|municipal|certificate|visa|immigration|dmv|irs|ssa|hmrc|nhs)\b/i;

export interface PromptAnalysis {
  raw: string;
  keywords: string[];
  actionWords: string[];
  searchQuery: string;
  hasGovIntent: boolean;
}

/**
 * Extracts meaningful keywords and builds a clean search query
 * from natural-language prompts like "apply for a bmtc bus pass".
 */
export function analyzePromptKeywords(prompt: string): PromptAnalysis {
  const raw = prompt.trim();
  const tokens = raw
    .toLowerCase()
    .replace(/[^\w\s.-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  const keywords: string[] = [];
  const actionWords: string[] = [];
  const queryTokens: string[] = [];

  for (const tok of tokens) {
    if (FILLER_WORDS.has(tok)) continue;
    if (ACTION_VERBS.has(tok)) {
      if (!actionWords.includes(tok)) actionWords.push(tok);
      queryTokens.push(tok);
      continue;
    }
    if (tok.length >= 2) {
      if (!keywords.includes(tok)) keywords.push(tok);
      queryTokens.push(tok);
    }
  }

  // Ensure query isn't empty if prompt only had short words
  const searchQuery =
    queryTokens.length > 0 ? queryTokens.join(" ") : raw;

  return {
    raw,
    keywords,
    actionWords,
    searchQuery,
    hasGovIntent: GOV_INTENT_PATTERN.test(raw),
  };
}

/**
 * Scores a search result against extracted prompt keywords across
 * hostname, path, title, and snippet.
 */
export function scoreKeywordRelevance(
  candidate: { url: string; title: string; snippet: string },
  analysis: PromptAnalysis
): { keywordScore: number; matchedKeywords: string[] } {
  const allTerms = [...analysis.keywords, ...analysis.actionWords];
  if (allTerms.length === 0) return { keywordScore: 50, matchedKeywords: [] };

  let host = "";
  let path = "";
  try {
    const u = new URL(candidate.url);
    host = u.hostname.toLowerCase();
    path = u.pathname.toLowerCase();
  } catch {
    host = candidate.url.toLowerCase();
  }

  const titleLow = candidate.title.toLowerCase();
  const snippetLow = candidate.snippet.toLowerCase();
  const matchedKeywords: string[] = [];
  let earned = 0;
  let possible = 0;

  for (const kw of analysis.keywords) {
    possible += 10;
    let pts = 0;
    if (host.includes(kw)) pts += 5;
    if (path.includes(kw)) pts += 2;
    if (titleLow.includes(kw)) pts += 3;
    if (snippetLow.includes(kw)) pts += 1;
    if (pts > 0) matchedKeywords.push(kw);
    earned += Math.min(10, pts);
  }

  for (const act of analysis.actionWords) {
    possible += 4;
    if (titleLow.includes(act) || path.includes(act) || snippetLow.includes(act)) {
      earned += 4;
      if (!matchedKeywords.includes(act)) matchedKeywords.push(act);
    }
  }

  // Extra boost for concatenated keywords in URLs (e.g. "buspass" matching ["bus", "pass"])
  if (analysis.keywords.length >= 2) {
    const joined = analysis.keywords.join("");
    const lastTwo = analysis.keywords.slice(-2).join("");
    if (
      host.includes(joined) ||
      path.includes(joined) ||
      host.includes(lastTwo) ||
      path.includes(lastTwo)
    ) {
      earned += 4;
    }
  }

  const keywordScore =
    possible > 0 ? Math.min(100, Math.round((earned / possible) * 100)) : 50;

  return { keywordScore, matchedKeywords };
}

// ── Raw Candidate Extraction ──────────────────────────────────

export interface RawSearchCandidate {
  title: string;
  url: string;
  snippet: string;
}

const SEARCH_ENGINE_HOSTS = [
  "yahoo.com",
  "bing.com",
  "google.com",
  "duckduckgo.com",
  "gstatic.com",
  "yimg.com",
  "microsoft.com/en-us/bing",
];

function isValidResultUrl(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    const h = u.hostname.toLowerCase();
    if (!h.includes(".")) return false;
    return !SEARCH_ENGINE_HOSTS.some((se) => h === se || h.endsWith(`.${se}`));
  } catch {
    return false;
  }
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;|&#x27;/gi, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_m, code) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

function extractYahooRedirectUrl(href: string): string {
  const ruMatch = href.match(/\/RU=([^/]+)\//);
  if (ruMatch?.[1]) {
    try {
      return decodeURIComponent(ruMatch[1]);
    } catch {
      return href;
    }
  }
  return href;
}

export function parseYahooSearchHtml(html: string): RawSearchCandidate[] {
  const results: RawSearchCandidate[] = [];
  const blockRegex =
    /<div[^>]*class="[^"]*compTitle[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?:<div[^>]*class="[^"]*compText[^"]*"[^>]*>([\s\S]*?)<\/div>)?/gi;

  let match: RegExpExecArray | null;
  while ((match = blockRegex.exec(html)) !== null) {
    const titleBlock = match[1] ?? "";
    const snippetBlock = match[2] ?? "";

    const anchorMatch = titleBlock.match(
      /<a[^>]*data-matarget="algo"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i
    ) ?? titleBlock.match(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);

    if (!anchorMatch?.[1]) continue;

    const rawHref = anchorMatch[1].replace(/&amp;/g, "&");
    const targetUrl = extractYahooRedirectUrl(rawHref);
    if (!isValidResultUrl(targetUrl)) continue;

    const anchorInner = anchorMatch[2] ?? "";
    const h3Match = anchorInner.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
    const title = decodeHtmlEntities(h3Match?.[1] ?? anchorInner);
    const snippet = decodeHtmlEntities(snippetBlock);

    if (!title) continue;
    results.push({ title, url: targetUrl, snippet });
  }

  return results;
}

function decodeBingClickUrl(href: string): string {
  try {
    const u = new URL(href);
    if (u.hostname.endsWith("bing.com") && u.pathname.startsWith("/ck/a")) {
      const encoded = u.searchParams.get("u");
      if (encoded && encoded.startsWith("a1")) {
        const b64 = encoded
          .slice(2)
          .replace(/-/g, "+")
          .replace(/_/g, "/");
        const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
        return atob(padded);
      }
    }
  } catch {
    // Return original href on parse failure
  }
  return href;
}

export function parseBingSearchHtml(html: string): RawSearchCandidate[] {
  const results: RawSearchCandidate[] = [];
  const itemRegex = /<li[^>]*class="[^"]*\bb_algo\b[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;

  let match: RegExpExecArray | null;
  while ((match = itemRegex.exec(html)) !== null) {
    const block = match[1] ?? "";
    const h2Link = block.match(/<h2[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    const tilkLink = block.match(/<a[^>]*class="[^"]*tilk[^"]*"[^>]*href="([^"]+)"/i);

    const rawHref = (h2Link?.[1] ?? tilkLink?.[1] ?? "").replace(/&amp;/g, "&");
    if (!rawHref) continue;

    const targetUrl = decodeBingClickUrl(rawHref);
    if (!isValidResultUrl(targetUrl)) continue;

    const title = decodeHtmlEntities(h2Link?.[2] ?? targetUrl);
    const pMatch = block.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    const snippet = decodeHtmlEntities(pMatch?.[1] ?? "");

    results.push({ title, url: targetUrl, snippet });
  }

  return results;
}

export function parseDDGHtml(html: string): RawSearchCandidate[] {
  const results: RawSearchCandidate[] = [];
  const linkRegex =
    /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  const snippetRegex =
    /<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;

  const snippets: string[] = [];
  let sMatch: RegExpExecArray | null;
  while ((sMatch = snippetRegex.exec(html)) !== null) {
    snippets.push(decodeHtmlEntities(sMatch[1] ?? ""));
  }

  let lMatch: RegExpExecArray | null;
  let idx = 0;
  while ((lMatch = linkRegex.exec(html)) !== null) {
    let href = (lMatch[1] ?? "").replace(/&amp;/g, "&");
    if (href.startsWith("//")) href = `https:${href}`;
    try {
      const parsed = new URL(href, "https://duckduckgo.com");
      const uddg = parsed.searchParams.get("uddg");
      if (uddg) href = uddg;
    } catch {
      // ignore
    }

    const title = decodeHtmlEntities(lMatch[2] ?? "");
    const snippet = snippets[idx] ?? "";
    idx++;

    if (!isValidResultUrl(href) || !title) continue;
    results.push({ title, url: href, snippet });
  }

  return results;
}

// ── Live Web Search Providers ─────────────────────────────────

async function fetchYahooResults(query: string): Promise<RawSearchCandidate[]> {
  try {
    const url = `https://search.yahoo.com/search?p=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(6000),
      headers: { Accept: "text/html,application/xhtml+xml" },
    });
    if (!res.ok) return [];
    const html = await res.text();
    return parseYahooSearchHtml(html);
  } catch {
    return [];
  }
}

async function fetchBingResults(query: string): Promise<RawSearchCandidate[]> {
  try {
    const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(6000),
      headers: { Accept: "text/html,application/xhtml+xml" },
    });
    if (!res.ok) return [];
    const html = await res.text();
    return parseBingSearchHtml(html);
  } catch {
    return [];
  }
}

async function fetchDDGHtmlResults(query: string): Promise<RawSearchCandidate[]> {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(6000),
      headers: { Accept: "text/html,application/xhtml+xml" },
    });
    if (!res.ok) return [];
    const html = await res.text();
    return parseDDGHtml(html);
  } catch {
    return [];
  }
}

interface DDGInstantResponse {
  AbstractText?: string;
  AbstractURL?: string;
  Heading?: string;
  Results?: { FirstURL?: string; Text?: string }[];
  RelatedTopics?: { FirstURL?: string; Text?: string; Topics?: { FirstURL?: string; Text?: string }[] }[];
}

async function fetchDDGInstantResults(query: string): Promise<RawSearchCandidate[]> {
  try {
    const params = new URLSearchParams({
      q: query,
      format: "json",
      no_html: "1",
      skip_disambig: "1",
      no_redirect: "1",
      t: "pointwise",
    });
    const res = await fetch(`https://api.duckduckgo.com/?${params}`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as DDGInstantResponse;
    const out: RawSearchCandidate[] = [];

    if (data.AbstractURL && isValidResultUrl(data.AbstractURL)) {
      out.push({
        title: data.Heading || new URL(data.AbstractURL).hostname,
        url: data.AbstractURL,
        snippet: data.AbstractText || "",
      });
    }
    for (const r of data.Results ?? []) {
      if (r.FirstURL && isValidResultUrl(r.FirstURL)) {
        out.push({
          title: r.Text || new URL(r.FirstURL).hostname,
          url: r.FirstURL,
          snippet: r.Text || "",
        });
      }
    }
    for (const t of data.RelatedTopics ?? []) {
      if (t.FirstURL && isValidResultUrl(t.FirstURL)) {
        out.push({
          title: t.Text || new URL(t.FirstURL).hostname,
          url: t.FirstURL,
          snippet: t.Text || "",
        });
      }
      for (const sub of t.Topics ?? []) {
        if (sub.FirstURL && isValidResultUrl(sub.FirstURL)) {
          out.push({
            title: sub.Text || new URL(sub.FirstURL).hostname,
            url: sub.FirstURL,
            snippet: sub.Text || "",
          });
        }
      }
    }
    return out;
  } catch {
    return [];
  }
}

async function fetchGeminiGroundedResults(query: string): Promise<RawSearchCandidate[]> {
  if (typeof chrome === "undefined" || !chrome.storage?.local) return [];
  const apiKey = await new Promise<string>((resolve) => {
    chrome.storage.local.get("gc_api_key", (r) => {
      resolve(((r["gc_api_key"] as string) ?? "").trim());
    });
  });
  if (!apiKey) return [];

  try {
    const endpoint =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
    const res = await fetch(`${endpoint}?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `Find the official websites for: "${query}". List the top official portals and helpful pages.`,
              },
            ],
          },
        ],
        tools: [{ google_search: {} }],
      }),
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      candidates?: {
        groundingMetadata?: {
          groundingChunks?: { web?: { uri?: string; title?: string } }[];
        };
      }[];
    };
    const chunks = json.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
    const out: RawSearchCandidate[] = [];
    for (const c of chunks) {
      const uri = c.web?.uri;
      const title = c.web?.title;
      if (uri && isValidResultUrl(uri)) {
        out.push({
          title: title || new URL(uri).hostname,
          url: uri,
          snippet: "Found via Google Search grounding",
        });
      }
    }
    return out;
  } catch {
    return [];
  }
}

// ── Helpers ───────────────────────────────────────────────────

function extractDirectUrl(query: string): string | null {
  const trimmed = query.trim();
  if (!trimmed || /\s/.test(trimmed)) return null;
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    if (parsed.hostname.includes(".") && parsed.hostname.length >= 4) {
      return parsed.href.replace(/\/$/, "");
    }
  } catch {
    return null;
  }
  return null;
}

function deduplicateCandidates(
  rawList: RawSearchCandidate[]
): RawSearchCandidate[] {
  const seenUrls = new Set<string>();
  const domainCounts = new Map<string, number>();
  const deduped: RawSearchCandidate[] = [];

  for (const item of rawList) {
    try {
      const u = new URL(item.url);
      const normUrl = `${u.origin}${u.pathname.replace(/\/$/, "")}${u.search}`;
      const host = u.hostname.toLowerCase();

      if (seenUrls.has(normUrl)) continue;
      // Limit to max 1 result per exact hostname so user sees diverse websites
      const count = domainCounts.get(host) ?? 0;
      if (count >= 1) continue;

      seenUrls.add(normUrl);
      domainCounts.set(host, count + 1);
      deduped.push(item);
    } catch {
      continue;
    }
  }
  return deduped;
}

// ── Public Multi-Result Search API ────────────────────────────

const MAX_RESULTS = 5;

export async function searchWebIntent(
  taskDescription: string
): Promise<WebSearchResponse> {
  const analysis = analyzePromptKeywords(taskDescription);
  if (!analysis.raw) {
    return {
      query: "",
      keywords: [],
      results: [],
      warnings: ["Enter a prompt or website name to search."],
    };
  }

  const candidates: RawSearchCandidate[] = [];

  // Direct domain/URL check (if user entered something like "mybmtc.karnataka.gov.in")
  const directUrl = extractDirectUrl(analysis.raw);
  if (directUrl) {
    candidates.push({
      title: new URL(directUrl).hostname,
      url: directUrl,
      snippet: "Direct URL entered by user",
    });
  }

  // Live web search: query Yahoo first, then Bing / DDG HTML / DDG Instant / Gemini Search
  if (!directUrl) {
    let raw = await fetchYahooResults(analysis.searchQuery);

    if (raw.length < 2) {
      const [bing, ddgHtml] = await Promise.all([
        fetchBingResults(analysis.searchQuery),
        fetchDDGHtmlResults(analysis.searchQuery),
      ]);
      raw = [...raw, ...bing, ...ddgHtml];
    }

    if (raw.length === 0) {
      const [ddgApi, gemini] = await Promise.all([
        fetchDDGInstantResults(analysis.searchQuery),
        fetchGeminiGroundedResults(analysis.searchQuery),
      ]);
      raw = [...ddgApi, ...gemini];
    }

    candidates.push(...raw);
  }

  const unique = deduplicateCandidates(candidates);
  if (unique.length === 0) {
    return {
      query: analysis.searchQuery,
      keywords: [...analysis.keywords, ...analysis.actionWords],
      results: [],
      warnings: [
        "No web results returned. Try adding specific keywords or typing a website domain.",
      ],
    };
  }

  // Score by prompt keywords first, pick top candidates, then run parallel Validity Checks
  const scored = unique
    .map((item) => ({
      item,
      ...scoreKeywordRelevance(item, analysis),
    }))
    .sort((a, b) => b.keywordScore - a.keywordScore)
    .slice(0, MAX_RESULTS);

  const verifiedResults: SearchResultItem[] = await Promise.all(
    scored.map(async ({ item, keywordScore, matchedKeywords }) => {
      const v = await verifyWebsite(item.url, {
        queryKeywords: analysis.keywords,
        hasGovIntent: analysis.hasGovIntent,
      });

      const host = (() => {
        try {
          return new URL(item.url).hostname;
        } catch {
          return item.url;
        }
      })();

      return {
        title: item.title,
        url: item.url,
        domain: host,
        snippet: item.snippet,
        matchedKeywords,
        keywordScore,
        validityScore: v.trustScore,
        signals: v.signals,
        warnings: v.warnings,
      };
    })
  );

  // Rank primarily by validity score + keyword match so official valid portals surface first
  verifiedResults.sort((a, b) => {
    const rankA = a.validityScore * 0.65 + a.keywordScore * 0.35;
    const rankB = b.validityScore * 0.65 + b.keywordScore * 0.35;
    return rankB - rankA;
  });

  return {
    query: analysis.searchQuery,
    keywords: [...analysis.keywords, ...analysis.actionWords],
    results: verifiedResults,
    warnings: [],
  };
}

/** Backwards-compatible single-result resolver returning the top validated website */
export async function resolveIntent(
  taskDescription: string
): Promise<DetailedVerificationResult> {
  const response = await searchWebIntent(taskDescription);
  const top = response.results[0];
  if (!top) {
    return {
      canonical: "",
      trustScore: 0,
      warnings: response.warnings,
      signals: [],
    };
  }
  return {
    canonical: top.url,
    trustScore: top.validityScore,
    warnings: top.warnings,
    signals: top.signals,
    label: top.title,
  };
}
