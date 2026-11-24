// ============================================================
// PointWise — AI Plan Generator, Sufficiency Check & Local Fallback
// Runs inside the service worker (or test environment).
// Calls Gemini API when an API key is configured; otherwise
// uses deterministic local sufficiency & DOM element matching.
// ============================================================

import type { Plan, ScrubbedSnapshot, SnapshotElement, Step } from "./types.js";

const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash"] as const;

export interface PlanOptions {
  apiKeyOverride?: string;
  contextProvided?: boolean;
}

export async function getStoredApiKey(): Promise<string> {
  if (typeof chrome === "undefined" || !chrome.storage?.local) return "";
  return new Promise((resolve) => {
    chrome.storage.local.get("gc_api_key", (r) => {
      resolve(((r["gc_api_key"] as string) ?? "").trim());
    });
  });
}

export async function generatePlan(
  snapshot: ScrubbedSnapshot,
  taskGoal: string,
  options?: PlanOptions | string
): Promise<Plan> {
  const opts: PlanOptions =
    typeof options === "string" ? { apiKeyOverride: options } : (options ?? {});
  const apiKey = opts.apiKeyOverride ?? (await getStoredApiKey());
  const contextProvided = Boolean(opts.contextProvided);

  if (!apiKey) {
    if (!contextProvided) {
      const check = checkLocalSufficiency(snapshot, taskGoal);
      if (!check.sufficient && check.question) {
        return {
          taskGoal,
          steps: [],
          source: "local",
          needsContext: true,
          clarifyingQuestion: check.question,
        };
      }
    }
    return generateLocalPlan(snapshot, taskGoal);
  }

  const prompt = buildPrompt(snapshot, taskGoal, contextProvided);
  let lastError = "Unknown Gemini API error";

  for (const model of GEMINI_MODELS) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    try {
      const res = await fetch(`${endpoint}?key=${encodeURIComponent(apiKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            maxOutputTokens: 1024,
            temperature: 0.2,
          },
        }),
        signal: AbortSignal.timeout(12_000),
      });

      if (res.status === 404) {
        lastError = `Model ${model} unavailable (404)`;
        continue;
      }

      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        throw new Error(`Gemini API ${res.status}: ${errBody.slice(0, 120)}`);
      }

      const json = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const raw = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
      const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
      const parsed = JSON.parse(cleaned) as {
        sufficient?: boolean;
        clarifyingQuestion?: string;
        steps?: Step[];
      };

      if (
        !contextProvided &&
        parsed.sufficient === false &&
        typeof parsed.clarifyingQuestion === "string" &&
        parsed.clarifyingQuestion.trim()
      ) {
        return {
          taskGoal,
          steps: [],
          source: "ai",
          needsContext: true,
          clarifyingQuestion: parsed.clarifyingQuestion.trim(),
        };
      }

      const steps = normalizeSteps(parsed.steps ?? [], snapshot.elements);

      if (steps.length > 0) {
        return { taskGoal, steps, source: "ai" };
      }

      const fallback = generateLocalPlan(snapshot, taskGoal);
      return {
        ...fallback,
        warning: "AI returned no actionable elements; showing closest interactive element.",
      };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  const fallback = generateLocalPlan(snapshot, taskGoal);
  return {
    ...fallback,
    warning: `AI unavailable (${lastError}). Showing local guidance.`,
  };
}

function normalizeSteps(steps: Step[], elements: SnapshotElement[]): Step[] {
  return steps
    .filter((s) => s && typeof s.targetSelector === "string" && s.targetSelector.trim() && s.hint)
    .slice(0, 4)
    .map((s) => {
      const matched = elements.find((el) => el.selector === s.targetSelector);
      const step: Step = {
        targetSelector: s.targetSelector.trim(),
        action: s.action || "click",
        hint: s.hint.slice(0, 140),
        sensitivityClass: s.sensitivityClass || "normal",
      };
      const fb = s.fallbackLabel ?? matched?.label;
      if (fb !== undefined) step.fallbackLabel = fb;
      if (s.errorRecovery !== undefined) step.errorRecovery = s.errorRecovery;
      return step;
    });
}

// ── Local Sufficiency Check ───────────────────────────────────

const STOP_WORDS = new Set([
  "a", "an", "the", "to", "for", "my", "on", "in", "of", "and",
  "me", "with", "this", "page", "guide", "through", "website", "site", "want", "need",
]);

const GENERIC_VERBS = new Set([
  "book", "buy", "order", "shop", "search", "find", "ticket", "tickets",
  "bus", "train", "flight", "hotel", "food", "help", "open", "do", "something",
  "apply", "check", "pay", "get", "make", "go", "visit",
]);

export function checkLocalSufficiency(
  snapshot: ScrubbedSnapshot,
  taskGoal: string
): { sufficient: boolean; question?: string } {
  const clean = taskGoal.toLowerCase().trim();
  if (!clean) {
    return {
      sufficient: false,
      question: "What specific task or item would you like PointWise to help you with on this page?",
    };
  }

  const words = clean
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));

  const specificWords = words.filter((w) => !GENERIC_VERBS.has(w));

  // Ticket booking prompt missing origin, destination, or date (distinct from "bus pass" applications)
  const isPassApplication = /\bpass\b/i.test(clean);
  const isTicketBooking =
    !isPassApplication &&
    (/\b(ticket|tickets|irctc|redbus|makemytrip|flight|train)\b/i.test(clean) ||
      (/\bbook\b/i.test(clean) && /\b(bus|train|flight|trip)\b/i.test(clean)));
  const hasRoutePreposition = /\b(from|to)\b/i.test(clean) && specificWords.length >= 2;
  if (isTicketBooking && !hasRoutePreposition && specificWords.length < 2) {
    return {
      sufficient: false,
      question: "Where are you travelling from, where to, and on what date?",
    };
  }

  // Bus/transit pass prompt missing pass category (student / monthly / senior citizen)
  if (isPassApplication && !/\b(student|monthly|daily|senior|citizen|general|renew|new)\b/i.test(clean)) {
    return {
      sufficient: false,
      question: "Which pass type are you applying for (e.g. Student, Monthly, General, or Renewal)?",
    };
  }

  // Shopping / food delivery prompt missing item name
  const isShoppingTask = /\b(amazon|flipkart|meesho|swiggy|zomato|bigbasket|buy|shop|order)\b/i.test(clean);
  if (isShoppingTask && specificWords.length < 2) {
    const hasSearchInput = snapshot.elements.some(
      (el) => el.tagName === "input" && /search|query|find/i.test(`${el.label} ${el.inputType ?? ""}`)
    );
    if (hasSearchInput || words.length <= 3) {
      return {
        sufficient: false,
        question: "What specific product, item, or dish are you looking for?",
      };
    }
  }

  // Very short / vague prompt with no concrete nouns
  if (words.length <= 2 && specificWords.length <= 1) {
    return {
      sufficient: false,
      question: "Can you share a few more details about what you want to do on this site?",
    };
  }

  return { sufficient: true };
}

// ── Local Deterministic Fallback ──────────────────────────────

export function generateLocalPlan(
  snapshot: ScrubbedSnapshot,
  taskGoal: string
): Plan {
  const goalWords = taskGoal
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));

  const candidates = snapshot.elements.filter((el) => el.visible && !el.disabled);

  const scored = candidates
    .map((el) => {
      const label = el.label.toLowerCase();
      let score = 0;

      if (el.inViewport) score += 8;

      for (const word of goalWords) {
        if (label.includes(word)) score += 15;
      }

      if (el.tagName === "input" && (el.inputType === "search" || el.inputType === "text" || !el.inputType)) {
        score += 10;
        if (/search|from|origin|source|find|query|destination|to|enter/i.test(label)) {
          score += 12;
        }
      }
      if (el.tagName === "button" || el.role === "button" || el.inputType === "submit") {
        score += 7;
        if (/search|book|continue|next|apply|submit|login|sign in|get started/i.test(label)) {
          score += 9;
        }
      }
      if (el.tagName === "select") score += 6;

      return { el, score };
    })
    .sort((a, b) => b.score - a.score);

  const picked: SnapshotElement[] = [];
  for (const item of scored) {
    if (picked.length >= 3) break;
    if (item.el.label || picked.length === 0) {
      picked.push(item.el);
    }
  }

  const steps: Step[] = picked.map((el) => {
    const isInput =
      el.tagName === "input" &&
      el.inputType !== "submit" &&
      el.inputType !== "button" &&
      el.inputType !== "checkbox" &&
      el.inputType !== "radio";

    const labelText = el.label ? `"${el.label.slice(0, 45)}"` : `the ${el.tagName}`;
    return {
      targetSelector: el.selector,
      fallbackLabel: el.label,
      action: el.hasFileInput ? "file-upload" : isInput ? "focus" : "click",
      hint: isInput
        ? `Enter details in ${labelText}`
        : `Click ${labelText} to continue`,
      sensitivityClass: "normal",
    };
  });

  return {
    taskGoal,
    steps,
    source: "local",
    warning: "Local match — add your Gemini API key (⚙) for full AI guidance.",
  };
}

export function buildPrompt(
  snapshot: ScrubbedSnapshot,
  taskGoal: string,
  contextProvided = false
): string {
  const compactElements = snapshot.elements.map((e) => ({
    selector: e.selector,
    role: e.role,
    label: e.label,
    tagName: e.tagName,
    type: e.inputType,
    inViewport: e.inViewport,
    disabled: e.disabled,
    hasFileInput: e.hasFileInput,
  }));

  return `
You are PointWise, a step-by-step web navigation assistant.
The user's goal is: "${taskGoal || "Help the user complete the main action on this page"}".
Extra context already provided by user: ${contextProvided ? "YES (do NOT ask another clarifying question; set sufficient=true)" : "NO"}.

Current page: ${snapshot.url}
Page title: ${snapshot.title}
Visible interactive elements:
${JSON.stringify(compactElements, null, 2)}

First decide if the user's goal has sufficient details to give a helpful step-by-step plan on this page.
- If extra context is already YES, you MUST set "sufficient": true.
- Only set "sufficient": false if the goal is too vague or missing key details (e.g. "book bus ticket" without cities/date, or "buy on amazon" without what product).

Return ONLY a JSON object with this exact shape:
{
  "sufficient": true | false,
  "clarifyingQuestion": "<one concise question to ask the user if sufficient is false, otherwise omit or empty>",
  "steps": [
    {
      "targetSelector": "<exact selector copied verbatim from the elements list above>",
      "fallbackLabel": "<exact label from that element>",
      "action": "click" | "focus" | "scroll" | "file-upload" | "pause",
      "hint": "<clear, friendly instruction telling the user what to do next, max 120 chars>",
      "errorRecovery": "<optional fallback hint if element moved>",
      "sensitivityClass": "normal" | "captcha" | "otp" | "payment" | "legal"
    }
  ]
}

Rules:
- Copy targetSelector verbatim from the provided elements list. Never invent selectors.
- Include the NEXT 1 to 3 actionable steps visible on THIS page in logical order when sufficient is true.
- Never instruct entering passwords, card numbers, OTPs, or sensitive PII.
- Set sensitivityClass appropriately if a field involves captcha, otp, payment, or legal terms.
- Return valid JSON only — no markdown fences, no extra text.
`.trim();
}
