import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtMessage, Plan, SessionGraph } from "../lib/types.js";

const planner = vi.hoisted(() => vi.fn());
vi.mock("../lib/ai-planner.js", () => ({ runAiPlanner: planner }));

const firstUrl = "https://example.test/start";
const nextUrl = "https://example.test/next";
const plan: Plan = {
  taskGoal: "Task",
  steps: [{ targetSelector: "#next", hint: "Click Next", action: "click", sensitivityClass: "normal" }],
};

type MessageHandler = (
  message: ExtMessage,
  sender: chrome.runtime.MessageSender,
  respond: (value: unknown) => void,
) => void;

function event<T>() {
  let handler: T;
  return { addListener: (fn: T) => { handler = fn; }, get handler() { return handler; } };
}

function mockChrome() {
  let session: SessionGraph | undefined;
  const messages = event<MessageHandler>();
  const completed = event<(details: { tabId: number; frameId: number; url: string }) => void>();
  const tabs = new Map([
    [1, { id: 1, url: firstUrl, status: "complete", active: true }],
    [2, { id: 2, url: nextUrl, status: "complete", active: false }],
  ]);
  const sendMessage = vi.fn(async (_tabId: number, _message: ExtMessage) => ({ ok: true }));
  const update = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("chrome", {
    storage: {
      session: {
        get: async () => structuredClone({ pointwise_session: session }),
        set: async (value: { pointwise_session: SessionGraph }) => {
          session = structuredClone(value.pointwise_session);
        },
        remove: async () => { session = undefined; },
      },
    },
    runtime: { onMessage: messages, onInstalled: event(), onStartup: event() },
    action: { setIcon: vi.fn().mockResolvedValue(undefined) },
    tabs: {
      get: async (id: number) => tabs.get(id),
      query: async () => [tabs.get(1)],
      update,
      sendMessage,
      onRemoved: event(),
    },
    webNavigation: {
      onCommitted: event(),
      onCompleted: completed,
      onHistoryStateUpdated: event(),
      onReferenceFragmentUpdated: event(),
    },
  });

  return {
    tabs,
    sendMessage,
    update,
    completed,
    get session() { return session; },
    send: (message: ExtMessage, sender: chrome.runtime.MessageSender = {}) =>
      new Promise((resolve) => messages.handler(message, sender, resolve)),
  };
}

async function start(browser: ReturnType<typeof mockChrome>) {
  await browser.send({ type: "ENABLE_SEARCH" });
  await browser.send({ type: "TOGGLE_ON", taskGoal: "Task", targetUrl: firstUrl });
}

describe("guidance session", () => {
  beforeEach(() => {
    vi.resetModules();
    planner.mockReset().mockResolvedValue(plan);
    let nextId = 0;
    vi.stubGlobal("crypto", { randomUUID: () => String(++nextId) });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("guides the current tab without navigating when no search result is supplied", async () => {
    const browser = mockChrome();
    await import("../background/service-worker.js");
    await browser.send({ type: "ENABLE_SEARCH" });
    const result = await browser.send({ type: "TOGGLE_ON", taskGoal: "Read this page" });
    expect(result).toEqual({ ok: true });
    expect(browser.update).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(planner).toHaveBeenCalledWith(expect.objectContaining({
      taskGoal: "Read this page", pageUrl: firstUrl,
    })));
  });

  it("still navigates to a chosen search result in the selected tab", async () => {
    const browser = mockChrome();
    await import("../background/service-worker.js");
    await browser.send({ type: "ENABLE_SEARCH" });
    await browser.send({ type: "TOGGLE_ON", taskGoal: "Task", targetUrl: nextUrl });
    expect(browser.update).toHaveBeenCalledWith(1, { url: nextUrl });
    expect(planner).not.toHaveBeenCalled();
    browser.tabs.get(1)!.url = nextUrl;
    browser.completed.handler({ tabId: 1, frameId: 0, url: nextUrl });
    await vi.waitFor(() => expect(planner).toHaveBeenCalledWith(expect.objectContaining({
      taskGoal: "Task", pageUrl: nextUrl,
    })));
  });

  it("explains why the active browser settings page cannot be guided", async () => {
    const browser = mockChrome();
    browser.tabs.get(1)!.url = "chrome://settings/";
    await import("../background/service-worker.js");
    await browser.send({ type: "ENABLE_SEARCH" });
    expect(await browser.send({ type: "TOGGLE_ON", taskGoal: "Change a setting" }))
      .toEqual({ error: expect.stringContaining("Open a website") });
    expect(browser.session?.guiding).toBe(false);
    expect(planner).not.toHaveBeenCalled();
  });

  it("keeps the task available when a plan fails and retries it from the popup", async () => {
    const browser = mockChrome();
    planner.mockResolvedValueOnce({
      taskGoal: "Task", steps: [], error: "Gemini couldn’t prepare a plan.", recovery: "retry",
    });
    await import("../background/service-worker.js");
    await start(browser);
    await vi.waitFor(() => expect(browser.session?.guidanceFailure?.recovery).toBe("retry"));
    const requestId = browser.session?.request?.id;
    expect(requestId).toBeDefined();
    expect(await browser.send({ type: "RESCAN", requestId: requestId! })).toEqual({ ok: true });
    await vi.waitFor(() => expect(planner).toHaveBeenCalledTimes(2));
    expect(planner).toHaveBeenLastCalledWith(expect.objectContaining({
      taskGoal: "Task", pageUrl: firstUrl,
    }));
    expect(browser.session?.guidanceFailure).toBeUndefined();
  });

  it("ignores navigation in an unrelated tab", async () => {
    const browser = mockChrome();
    await import("../background/service-worker.js");
    await start(browser);
    browser.completed.handler({ tabId: 2, frameId: 0, url: nextUrl });
    await browser.send({ type: "GET_SESSION_STATE" });
    expect(planner).toHaveBeenCalledTimes(1);
    expect(browser.session?.tabId).toBe(1);
  });

  it("drops the previous page's plan when navigation starts a new request", async () => {
    const browser = mockChrome();
    let resolveOld!: (value: Plan) => void;
    planner.mockImplementationOnce(() => new Promise<Plan>((resolve) => { resolveOld = resolve; }));
    await import("../background/service-worker.js");
    await start(browser);
    await vi.waitFor(() => expect(planner).toHaveBeenCalledTimes(1));
    const oldRequest = browser.session?.request?.id;
    const tab = browser.tabs.get(1)!;
    tab.url = nextUrl;
    browser.completed.handler({ tabId: 1, frameId: 0, url: nextUrl });
    await vi.waitFor(() => expect(planner).toHaveBeenCalledTimes(2));
    resolveOld(plan);
    await browser.send({ type: "GET_SESSION_STATE" });
    const published = browser.sendMessage.mock.calls
      .map(([, message]) => message)
      .filter((message) => message.type === "PLAN_READY");
    expect(published.map((message) => message.requestId)).toEqual([browser.session?.request?.id]);
    expect(published[0]?.requestId).not.toBe(oldRequest);
  });

  it("restores the current request after the worker restarts and rejects other tabs' progress", async () => {
    const browser = mockChrome();
    await import("../background/service-worker.js");
    await start(browser);
    await vi.waitFor(() => expect(browser.sendMessage.mock.calls.some(
      ([, message]) => message.type === "PLAN_READY",
    )).toBe(true));
    const requestId = browser.session?.request?.id;
    expect(requestId).toBeDefined();
    expect(browser.session?.nodes.at(-1)?.stepIndex).toBe(0);

    vi.resetModules();
    await import("../background/service-worker.js");
    const complete = { type: "STEP_COMPLETE", requestId: requestId!, stepIndex: 0 } as const;
    await browser.send(complete, { tab: { id: 2 } as chrome.tabs.Tab, frameId: 0, url: firstUrl });
    expect(browser.session?.nodes.at(-1)?.stepIndex).toBe(0);
    await browser.send(complete, { tab: { id: 1 } as chrome.tabs.Tab, frameId: 0, url: firstUrl });
    expect(browser.session?.nodes.at(-1)?.stepIndex).toBe(1);
  });
});
