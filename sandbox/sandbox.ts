// ============================================================
// PointWise — Sandbox (isolated reasoning context)
// Receives scrubbed snapshots + apiKey via postMessage,
// calls Gemini AI, returns a Plan.
// ============================================================

import { buildAgentSystemPrompt } from "../lib/ai-planner.js";
import type { ScrubbedSnapshot, Plan, Step } from "../lib/types.js";

const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

window.addEventListener("message", async (event) => {
  if (event.data?.type !== "SNAPSHOT_READY") return;
  const snapshot: ScrubbedSnapshot = event.data.snapshot;
  const taskGoal: string = event.data.taskGoal ?? "";
  const apiKey: string = event.data.apiKey ?? "";

  try {
    const plan = await callGeminiFromSandbox(snapshot, taskGoal, apiKey);
    event.source?.postMessage(
      { type: "PLAN_READY", plan },
      { targetOrigin: "*" }
    );
  } catch (err) {
    console.error("[PointWise sandbox] Plan generation failed:", err);
    event.source?.postMessage(
      { type: "PLAN_ERROR", message: String(err) },
      { targetOrigin: "*" }
    );
  }
});

async function callGeminiFromSandbox(
  snapshot: ScrubbedSnapshot,
  taskGoal: string,
  apiKey: string
): Promise<Plan> {
  if (!apiKey) throw new Error("No API key provided");

  const prompt = `${buildAgentSystemPrompt(taskGoal, snapshot.url, true)}\n\nPage Elements:\n${JSON.stringify(snapshot.elements)}`;
  const res = await fetch(`${GEMINI_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        maxOutputTokens: 1024,
      },
    }),
  });

  if (!res.ok) throw new Error(`Gemini API error ${res.status}`);
  const json = await res.json();
  const raw: string = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  const parsed = JSON.parse(cleaned) as { steps?: Step[] };
  return { taskGoal, steps: parsed.steps ?? [] };
}
