// ============================================================
// PointWise — AI Agent & Grounded Plan Generator
// Runs exclusively in the service worker (or test suite).
// Exposes `guide_page` ONLY as an AI-callable tool so the AI
// fetches live webpage DOM context only when needed to make
// decisions and produce strictly grounded action plans.
// ============================================================

import type { GuidanceFailure, Plan, ScrubbedSnapshot, SnapshotElement, Step } from "./types.js";

const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash"] as const;

export interface AgentRunOptions {
  taskGoal: string;
  pageUrl?: string;
  contextProvided?: boolean;
  apiKeyOverride?: string;
  /** Called ONLY by the AI when it invokes the `guide_page` tool */
  guidePage: () => Promise<ScrubbedSnapshot | null>;
}

interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
}

interface GeminiContent {
  role: "user" | "model" | "function";
  parts: GeminiPart[];
}

export async function getStoredApiKey(): Promise<string> {
  if (typeof chrome === "undefined" || !chrome.storage?.local) return "";
  return new Promise((resolve) => {
    chrome.storage.local.get("gc_api_key", (r) => {
      resolve(((r["gc_api_key"] as string) ?? "").trim());
    });
  });
}

const GUIDE_PAGE_TOOL = {
  functionDeclarations: [
    {
      name: "guide_page",
      description:
        "Inspects the currently open website's scrubbed interactive elements (buttons, links, inputs, forms) to gather context before deciding on clarifying questions or creating a grounded Plan of Action.",
      parameters: {
        type: "OBJECT",
        properties: {
          reason: {
            type: "STRING",
            description: "Brief reason why page context is needed to decide next steps.",
          },
        },
        required: ["reason"],
      },
    },
  ],
};

/**
 * Runs the AI decision loop. `guidePage()` is ONLY executed when the
 * AI requests page context via the `guide_page` tool call.
 */
export async function runAiPlanner(options: AgentRunOptions): Promise<Plan> {
  const apiKey = options.apiKeyOverride ?? (await getStoredApiKey());
  if (!apiKey) {
    return {
      taskGoal: options.taskGoal,
      steps: [],
      error: "Gemini API key is required for AI page guidance. Add it in ⚙ API Key.",
      recovery: "api-key",
    };
  }

  const contextProvided = Boolean(options.contextProvided);
  let latestSnapshot: ScrubbedSnapshot | null = null;

  const initialPrompt = buildAgentSystemPrompt(
    options.taskGoal,
    options.pageUrl ?? "",
    contextProvided
  );

  const contents: GeminiContent[] = [
    { role: "user", parts: [{ text: initialPrompt }] },
  ];

  let failure: GuidanceFailure = {
    message: "Gemini couldn’t prepare a plan. Try again.",
    recovery: "retry",
  };

  for (const model of GEMINI_MODELS) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    let modelUnavailable = false;

    // Allow up to 3 turns (e.g., Turn 1: AI calls guide_page -> Turn 2: AI decides/plans)
    for (let turn = 0; turn < 3; turn++) {
      try {
        const res = await fetch(`${endpoint}?key=${encodeURIComponent(apiKey)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents,
            tools: [GUIDE_PAGE_TOOL],
            generationConfig: {
              temperature: 0.15,
              maxOutputTokens: 1024,
            },
          }),
          signal: AbortSignal.timeout(14_000),
        });

        if (res.status === 404) {
          modelUnavailable = true;
          break;
        }

        if (!res.ok) {
          const body = res.status === 400 ? await res.text().catch(() => "") : "";
          if (res.status === 401 || res.status === 403 || /API_KEY_INVALID|API key not valid/i.test(body)) {
            failure = {
              message: "Gemini rejected the API key or its permissions. Update it in the PointWise popup, then try again.",
              recovery: "api-key",
            };
          } else if (res.status === 429) {
            failure.message = "Gemini’s request limit was reached. Wait a moment, then try again.";
          }
          break;
        }

        const json = (await res.json()) as {
          candidates?: { content?: { parts?: GeminiPart[] } }[];
        };

        const parts = json?.candidates?.[0]?.content?.parts ?? [];
        const fnCall = parts.find((p) => p.functionCall?.name === "guide_page")?.functionCall;

        if (fnCall) {
          contents.push({ role: "model", parts });
          latestSnapshot = await options.guidePage();

          if (!latestSnapshot || latestSnapshot.elements.length === 0) {
            return {
              taskGoal: options.taskGoal,
              steps: [],
              error: "No interactive elements were found on this page yet.",
              recovery: "rescan",
            };
          }

          const compactElements = latestSnapshot.elements.map((e) => ({
            selector: e.selector,
            role: e.role,
            label: e.label,
            tagName: e.tagName,
            type: e.inputType,
            inViewport: e.inViewport,
            disabled: e.disabled,
            hasFileInput: e.hasFileInput,
          }));

          contents.push({
            role: "function",
            parts: [
              {
                functionResponse: {
                  name: "guide_page",
                  response: {
                    url: latestSnapshot.url,
                    title: latestSnapshot.title,
                    elements: compactElements,
                  },
                },
              },
            ],
          });
          continue;
        }

        const textPart = parts.map((p) => p.text ?? "").join("").trim();
        if (!textPart) {
          throw new Error("Empty response from Gemini");
        }

        const parsed = parseAiJson(textPart);

        if (
          !contextProvided &&
          parsed.sufficient === false &&
          typeof parsed.clarifyingQuestion === "string" &&
          parsed.clarifyingQuestion.trim()
        ) {
          return {
            taskGoal: options.taskGoal,
            steps: [],
            needsContext: true,
            clarifyingQuestion: parsed.clarifyingQuestion.trim(),
          };
        }

        // Never accept steps unless the AI actually inspected the page via guide_page
        if (!latestSnapshot) {
          latestSnapshot = await options.guidePage();
          if (!latestSnapshot || latestSnapshot.elements.length === 0) {
            return {
              taskGoal: options.taskGoal,
              steps: [],
              error: "No interactive elements found on this page.",
              recovery: "rescan",
            };
          }

          contents.push({ role: "model", parts: [{ text: textPart }] });
          contents.push({
            role: "user",
            parts: [
              {
                text: `Before outputting steps, ground every selector strictly in the actual page elements returned below:\n${JSON.stringify(
                  {
                    url: latestSnapshot.url,
                    title: latestSnapshot.title,
                    elements: latestSnapshot.elements.map((e) => ({
                      selector: e.selector,
                      label: e.label,
                      tagName: e.tagName,
                      role: e.role,
                    })),
                  },
                  null,
                  2
                )}`,
              },
            ],
          });
          continue;
        }

        const groundedSteps = normalizeAndGroundSteps(
          parsed.steps ?? [],
          latestSnapshot.elements
        );

        if (groundedSteps.length > 0) {
          return { taskGoal: options.taskGoal, steps: groundedSteps };
        }

        return {
          taskGoal: options.taskGoal,
          steps: [],
          error: "Could not find matching interactive elements for this task on the page.",
          recovery: "rescan",
        };
      } catch {
        break;
      }
    }

    if (modelUnavailable) continue;
    break;
  }

  return {
    taskGoal: options.taskGoal,
    steps: [],
    error: failure.message,
    recovery: failure.recovery,
  };
}

function parseAiJson(raw: string): {
  sufficient?: boolean;
  clarifyingQuestion?: string;
  steps?: Step[];
} {
  const stripped = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  const firstBrace = stripped.indexOf("{");
  const lastBrace = stripped.lastIndexOf("}");
  const jsonSlice =
    firstBrace !== -1 && lastBrace > firstBrace
      ? stripped.slice(firstBrace, lastBrace + 1)
      : stripped;
  return JSON.parse(jsonSlice) as {
    sufficient?: boolean;
    clarifyingQuestion?: string;
    steps?: Step[];
  };
}

/**
 * Strictly grounds every AI step against actual elements present in the
 * snapshot returned by `guide_page` — preventing hallucinated selectors.
 */
export function normalizeAndGroundSteps(
  steps: Step[],
  elements: SnapshotElement[]
): Step[] {
  const bySelector = new Map(elements.map((el) => [el.selector, el]));

  const valid: Step[] = [];
  for (const s of steps) {
    if (!s || typeof s.targetSelector !== "string" || !s.hint) continue;
    const sel = s.targetSelector.trim();
    let matched = bySelector.get(sel);

    // Allow exact fallback label match if selector whitespace shifted
    if (!matched && s.fallbackLabel) {
      const targetLbl = s.fallbackLabel.trim().toLowerCase();
      if (targetLbl) {
        matched = elements.find((el) => el.label.trim().toLowerCase() === targetLbl);
      }
    }

    if (!matched) continue; // Reject any hallucinated element not on the page

    const step: Step = {
      targetSelector: matched.selector,
      action: s.action || "click",
      hint: s.hint.slice(0, 140),
      sensitivityClass: s.sensitivityClass || "normal",
    };
    if (matched.label) step.fallbackLabel = matched.label;
    if (s.errorRecovery !== undefined) step.errorRecovery = s.errorRecovery;

    valid.push(step);
    if (valid.length >= 4) break;
  }

  return valid;
}

export function buildAgentSystemPrompt(
  taskGoal: string,
  pageUrl: string,
  contextProvided: boolean
): string {
  return `
You are PointWise, a step-by-step web navigation assistant.
User's goal: "${taskGoal || "Help the user complete their task"}"
Current URL: ${pageUrl || "unknown"}
Extra context already provided by user: ${contextProvided ? "YES (do NOT ask another clarifying question; set sufficient=true)" : "NO"}.

Process:
1. Call the \`guide_page\` tool to inspect the actual interactive elements on the page so you have full context before deciding.
2. Once you have the page elements from \`guide_page\`:
   - If extra context is NO and key details are still missing to pick the right steps (e.g. pass type, origin/destination, product name), return JSON with "sufficient": false and a single concise "clarifyingQuestion".
   - Otherwise, return JSON with "sufficient": true and 1 to 3 grounded "steps" using ONLY exact selectors copied verbatim from \`guide_page\`.

Return strictly valid JSON (no markdown fences) in your final message:
{
  "sufficient": true | false,
  "clarifyingQuestion": "<one concise question if sufficient is false>",
  "steps": [
    {
      "targetSelector": "<exact selector from guide_page elements>",
      "fallbackLabel": "<exact label from that element>",
      "action": "click" | "focus" | "scroll" | "file-upload" | "pause",
      "hint": "<clear, short instruction for the user, max 120 chars>",
      "errorRecovery": "<optional hint>",
      "sensitivityClass": "normal" | "captcha" | "otp" | "payment" | "legal"
    }
  ]
}

Rules:
- Never invent or guess CSS selectors. Only copy exact selectors returned by \`guide_page\`.
- Never ask users to share passwords, OTPs, or payment details.
`.trim();
}
