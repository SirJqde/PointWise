// ============================================================
// Tests — ai-planner.test.ts
// Verifies AI-only `guide_page` tool invocation, strict
// selector grounding (no hallucinations), and context prompts.
// ============================================================

import { describe, it, expect, vi, afterEach } from "vitest";
import { normalizeAndGroundSteps, runAiPlanner } from "../lib/ai-planner.js";
import type { ScrubbedSnapshot } from "../lib/types.js";

const SAMPLE_SNAPSHOT: ScrubbedSnapshot = {
  url: "https://mybmtc.karnataka.gov.in/51/student-pass/en",
  title: "BMTC Bus Pass",
  elements: [
    {
      selector: "#pass-type",
      role: "combobox",
      label: "Select Pass Type",
      tagName: "select",
      rect: { x: 100, y: 200, width: 220, height: 40 },
      visible: true,
      inViewport: true,
      disabled: false,
    },
    {
      selector: "#apply-btn",
      role: "button",
      label: "Apply Online",
      tagName: "button",
      rect: { x: 100, y: 260, width: 160, height: 42 },
      visible: true,
      inViewport: true,
      disabled: false,
    },
  ],
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("normalizeAndGroundSteps", () => {
  it("keeps steps whose selectors exist in the snapshot and strips hallucinated ones", () => {
    const steps = normalizeAndGroundSteps(
      [
        {
          targetSelector: "#nonexistent-hallucinated-id",
          action: "click",
          hint: "Click fake button",
          sensitivityClass: "normal",
        },
        {
          targetSelector: "#apply-btn",
          action: "click",
          hint: "Click Apply Online to start your pass application.",
          sensitivityClass: "normal",
        },
      ],
      SAMPLE_SNAPSHOT.elements
    );

    expect(steps).toHaveLength(1);
    expect(steps[0]?.targetSelector).toBe("#apply-btn");
    expect(steps[0]?.fallbackLabel).toBe("Apply Online");
  });
});

describe("runAiPlanner — AI-only guidePage & grounding", () => {
  it("does not hallucinate local steps or call guidePage when API key is missing", async () => {
    const guidePageSpy = vi.fn(async () => SAMPLE_SNAPSHOT);

    const plan = await runAiPlanner({
      taskGoal: "apply for a bmtc bus pass",
      apiKeyOverride: "",
      guidePage: guidePageSpy,
    });

    expect(guidePageSpy).not.toHaveBeenCalled();
    expect(plan.steps).toHaveLength(0);
    expect(plan.error).toContain("API key");
    expect(JSON.stringify(plan)).not.toContain("Local match");
  });

  it("calls guidePage when AI invokes guide_page tool, then returns strictly grounded steps", async () => {
    const guidePageSpy = vi.fn(async () => SAMPLE_SNAPSHOT);
    let callCount = 0;

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        callCount++;
        if (callCount === 1) {
          // Turn 1: AI invokes guide_page tool to get page context
          return {
            ok: true,
            status: 200,
            json: async () => ({
              candidates: [
                {
                  content: {
                    parts: [
                      {
                        functionCall: {
                          name: "guide_page",
                          args: { reason: "Inspect available pass options on page" },
                        },
                      },
                    ],
                  },
                },
              ],
            }),
          };
        }

        // Turn 2: AI returns grounded plan (with one hallucinated selector that should be filtered out)
        return {
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
                            targetSelector: "#pass-type",
                            action: "click",
                            hint: "Choose Student Pass from the dropdown.",
                            sensitivityClass: "normal",
                          },
                          {
                            targetSelector: "#fake-button",
                            action: "click",
                            hint: "Hallucinated button",
                            sensitivityClass: "normal",
                          },
                          {
                            targetSelector: "#apply-btn",
                            action: "click",
                            hint: "Click Apply Online to continue.",
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
        };
      })
    );

    const plan = await runAiPlanner({
      taskGoal: "apply for a student bmtc bus pass",
      pageUrl: SAMPLE_SNAPSHOT.url,
      apiKeyOverride: "AIzaFakeKey123",
      guidePage: guidePageSpy,
    });

    expect(guidePageSpy).toHaveBeenCalledTimes(1);
    expect(plan.steps).toHaveLength(2);
    expect(plan.steps.map((s) => s.targetSelector)).toEqual(["#pass-type", "#apply-btn"]);
  });

  it("returns clarifyingQuestion when AI marks sufficient=false after inspecting page", async () => {
    const guidePageSpy = vi.fn(async () => SAMPLE_SNAPSHOT);
    let callCount = 0;

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              candidates: [
                {
                  content: {
                    parts: [
                      {
                        functionCall: {
                          name: "guide_page",
                          args: { reason: "Check pass categories on page" },
                        },
                      },
                    ],
                  },
                },
              ],
            }),
          };
        }
        return {
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
                        clarifyingQuestion: "Are you applying for a Student Pass or Monthly Pass?",
                        steps: [],
                      }),
                    },
                  ],
                },
              },
            ],
          }),
        };
      })
    );

    const plan = await runAiPlanner({
      taskGoal: "apply for a bmtc bus pass",
      pageUrl: SAMPLE_SNAPSHOT.url,
      apiKeyOverride: "AIzaFakeKey123",
      guidePage: guidePageSpy,
    });

    expect(guidePageSpy).toHaveBeenCalledTimes(1);
    expect(plan.needsContext).toBe(true);
    expect(plan.clarifyingQuestion).toContain("Student Pass");
    expect(plan.steps).toHaveLength(0);
  });

  it("returns clean error instead of hallucinating if Gemini API fails", async () => {
    const guidePageSpy = vi.fn(async () => SAMPLE_SNAPSHOT);

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 403,
        text: async () => "Invalid API key",
      }))
    );

    const plan = await runAiPlanner({
      taskGoal: "apply for a bmtc bus pass",
      apiKeyOverride: "bad-key",
      guidePage: guidePageSpy,
    });

    expect(plan.steps).toHaveLength(0);
    expect(plan.error).toContain("403");
  });
});
