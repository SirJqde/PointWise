// ============================================================
// Sandbox — isolated reasoning context.
// Receives scrubbed snapshots, calls AI model, returns Plan.
// NO access to real DOM, no cookies, no credentials.
// ============================================================

import type { ScrubbedSnapshot, Plan, Step } from "../lib/types.js";

const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

// API key must be injected via chrome.storage (never hardcoded)
async function getApiKey(): Promise<string> {
  return new Promise((resolve) => {
    chrome.storage.local.get("gc_api_key", (r) => resolve(r["gc_api_key"] ?? ""));
  });
}

window.addEventListener("message", async (event) => {
  if (event.data?.type !== "SNAPSHOT_READY") return;
  const snapshot: ScrubbedSnapshot = event.data.snapshot;
  const taskGoal: string = event.data.taskGoal ?? "";

  try {
    const plan = await generatePlan(snapshot, taskGoal);
    event.source?.postMessage({ type: "PLAN_READY", plan }, { targetOrigin: event.origin });
  } catch (err) {
    console.error("[GuideCursor sandbox] Plan generation failed:", err);
  }
});

async function generatePlan(snapshot: ScrubbedSnapshot, taskGoal: string): Promise<Plan> {
  const apiKey = await getApiKey();

  const prompt = buildPrompt(snapshot, taskGoal);

  const res = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", maxOutputTokens: 1024 },
    }),
  });

  if (!res.ok) throw new Error(`API error ${res.status}`);
  const json = await res.json();
  const raw = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";

  const parsed = JSON.parse(raw) as { steps?: Step[] };
  return { taskGoal, steps: parsed.steps ?? [] };
}

function buildPrompt(snapshot: ScrubbedSnapshot, taskGoal: string): string {
  return `
You are a step-by-step web navigation assistant. The user wants to: "${taskGoal}".

Here is a scrubbed snapshot of the current page (${snapshot.url}):
${JSON.stringify({ title: snapshot.title, elements: snapshot.elements }, null, 2)}

Return a JSON object with this exact shape:
{
  "steps": [
    {
      "targetSelector": "<CSS selector of the element the user should interact with next>",
      "action": "click" | "focus" | "scroll" | "file-upload" | "pause",
      "hint": "<plain-English instruction for the user, max 120 chars>",
      "errorRecovery": "<what to show if the element isn't found, optional>",
      "sensitivityClass": "normal" | "captcha" | "otp" | "payment" | "legal"
    }
  ]
}

Rules:
- Only include the NEXT 1-3 steps visible on this page. Do not plan future pages.
- Never ask the user to enter passwords, card numbers, OTPs, or any sensitive data.
- For any form field collecting sensitive data, set sensitivityClass appropriately.
- Prefer aria-label selectors over positional selectors.
- Keep hints friendly and concise.
- Return only valid JSON — no markdown fences, no commentary.
`.trim();
}
