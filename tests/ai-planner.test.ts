// ============================================================
// Tests — ai-planner.test.ts
// Verifies prompt sufficiency checks, Gemini AI planning,
// context follow-up handling, error fallback, and local matching.
// ============================================================

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  checkLocalSufficiency,
  generateLocalPlan,
  generatePlan,
} from "../lib/ai-planner.js";
import type { ScrubbedSnapshot } from "../lib/types.js";

const SAMPLE_SNAPSHOT: ScrubbedSnapshot = {
  url: "https://www.redbus.in/",
  title: "Book Bus Tickets Online",
  elements: [
    {
      selector: "#src",
      role: "textbox",
      label: "From",
      tagName: "input",
      inputType: "text",
      rect: { x: 100, y: 200, width: 180, height: 42 },
      visible: true,
      inViewport: true,
      disabled: false,
    },
    {
      selector: "#dest",
      role: "textbox",
      label: "To",
      tagName: "input",
      inputType: "text",
      rect: { x: 300, y: 200, width: 180, height: 42 },
      visible: true,
      inViewport: true,
      disabled: false,
    },
    {
      selector: "#search_button",
      role: "button",
      label: "SEARCH BUSES",
      tagName: "button",
      rect: { x: 520, y: 200, width: 150, height: 42 },
      visible: true,
      inViewport: true,
      disabled: false,
    },
  ],
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("checkLocalSufficiency", () => {
  it("flags vague travel prompt missing origin/destination", () => {
    const res = checkLocalSufficiency(SAMPLE_SNAPSHOT, "Book a bus ticket");
    expect(res.sufficient).toBe(false);
    expect(res.question).toBeTruthy();
  });

  it("passes travel prompt once origin and destination are included", () => {
    const res = checkLocalSufficiency(
      SAMPLE_SNAPSHOT,
      "Book a bus ticket from Pune to Mumbai tomorrow"
    );
    expect(res.sufficient).toBe(true);
  });

  it("asks pass-type question (not travel route) for 'apply for a bmtc bus pass'", () => {
    const res = checkLocalSufficiency(SAMPLE_SNAPSHOT, "apply for a bmtc bus pass");
    expect(res.sufficient).toBe(false);
    expect(res.question?.toLowerCase()).toContain("pass type");
  });

  it("treats 'apply for a student bmtc bus pass' as sufficient", () => {
    const res = checkLocalSufficiency(SAMPLE_SNAPSHOT, "apply for a student bmtc bus pass");
    expect(res.sufficient).toBe(true);
  });

  it("flags overly short generic prompts", () => {
    const res = checkLocalSufficiency(SAMPLE_SNAPSHOT, "help");
    expect(res.sufficient).toBe(false);
    expect(res.question).toBeTruthy();
  });
});

describe("generateLocalPlan", () => {
  it("picks visible actionable elements matching the task goal", () => {
    const plan = generateLocalPlan(
      SAMPLE_SNAPSHOT,
      "Book a bus ticket from Pune to Mumbai"
    );
    expect(plan.source).toBe("local");
    expect(plan.steps.length).toBeGreaterThan(0);
    expect(plan.steps[0]?.targetSelector).toBeTruthy();
    expect(
      plan.steps.some(
        (s) => s.targetSelector === "#search_button" || s.targetSelector === "#src"
      )
    ).toBe(true);
  });

  it("ignores disabled elements", () => {
    const snap: ScrubbedSnapshot = {
      url: "https://example.com",
      title: "Example",
      elements: [
        {
          selector: "#disabled-btn",
          role: "button",
          label: "Search",
          tagName: "button",
          rect: { x: 0, y: 0, width: 100, height: 40 },
          visible: true,
          inViewport: true,
          disabled: true,
        },
        {
          selector: "#active-btn",
          role: "button",
          label: "Continue",
          tagName: "button",
          rect: { x: 0, y: 60, width: 100, height: 40 },
          visible: true,
          inViewport: true,
          disabled: false,
        },
      ],
    };

    const plan = generateLocalPlan(snap, "Search for records");
    expect(plan.steps.map((s) => s.targetSelector)).not.toContain("#disabled-btn");
    expect(plan.steps[0]?.targetSelector).toBe("#active-btn");
  });
});

describe("generatePlan — sufficiency & Gemini integration", () => {
  it("asks for additional context locally when no API key and prompt lacks details", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const plan = await generatePlan(SAMPLE_SNAPSHOT, "Book a bus ticket", {
      apiKeyOverride: "",
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(plan.needsContext).toBe(true);
    expect(plan.clarifyingQuestion).toBeTruthy();
  });

  it("skips sufficiency question and returns local plan once contextProvided is true", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const plan = await generatePlan(
      SAMPLE_SNAPSHOT,
      "Book a bus ticket — Pune to Mumbai",
      { apiKeyOverride: "", contextProvided: true }
    );
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(plan.needsContext).toBeUndefined();
    expect(plan.source).toBe("local");
    expect(plan.steps.length).toBeGreaterThan(0);
  });

  it("surfaces clarifyingQuestion when Gemini marks sufficient=false", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      sufficient: false,
                      clarifyingQuestion: "Which cities and date are you travelling?",
                      steps: [],
                    }),
                  },
                ],
              },
            },
          ],
        }),
      })
    );

    const plan = await generatePlan(SAMPLE_SNAPSHOT, "Book a bus ticket", {
      apiKeyOverride: "AIzaFakeKey123",
    });
    expect(plan.needsContext).toBe(true);
    expect(plan.clarifyingQuestion).toContain("cities");
  });

  it("calls Gemini API when an API key is provided and parses JSON steps", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      sufficient: true,
                      steps: [
                        {
                          targetSelector: "#src",
                          action: "focus",
                          hint: "Enter your departure city here.",
                          sensitivityClass: "normal",
                        },
                        {
                          targetSelector: "#search_button",
                          action: "click",
                          hint: "Click SEARCH BUSES to view routes.",
                          sensitivityClass: "normal",
                        },
                      ],
                    }),
                  },
                ],
              },
            },
          ],
        }),
      })
    );

    const plan = await generatePlan(
      SAMPLE_SNAPSHOT,
      "Book a bus ticket from Pune to Mumbai",
      { apiKeyOverride: "AIzaFakeKey123" }
    );
    expect(plan.source).toBe("ai");
    expect(plan.steps).toHaveLength(2);
    expect(plan.steps[0]?.targetSelector).toBe("#src");
    expect(plan.steps[0]?.fallbackLabel).toBe("From");
  });

  it("handles Gemini responses wrapped in markdown fences", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: '```json\n{"sufficient":true,"steps":[{"targetSelector":"#dest","action":"focus","hint":"Enter destination","sensitivityClass":"normal"}]}\n```',
                  },
                ],
              },
            },
          ],
        }),
      })
    );

    const plan = await generatePlan(SAMPLE_SNAPSHOT, "Book bus Pune to Mumbai", {
      apiKeyOverride: "AIzaFakeKey123",
      contextProvided: true,
    });
    expect(plan.source).toBe("ai");
    expect(plan.steps[0]?.targetSelector).toBe("#dest");
  });

  it("gracefully falls back locally with warning if Gemini fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: async () => "API key invalid",
      })
    );

    const plan = await generatePlan(SAMPLE_SNAPSHOT, "Book bus Pune to Mumbai", {
      apiKeyOverride: "bad-key",
      contextProvided: true,
    });
    expect(plan.source).toBe("local");
    expect(plan.warning).toContain("AI unavailable");
    expect(plan.steps.length).toBeGreaterThan(0);
  });
});
