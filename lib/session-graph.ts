// ============================================================
// Session Graph — multi-domain task state, persisted in
// chrome.storage.session (memory-only, cleared on browser close).
// ============================================================

import type { SessionGraph, SessionNode } from "./types.js";

const STORAGE_KEY = "guidecursor_session";

function uid(): string {
  return crypto.randomUUID();
}

export async function createSession(taskGoal: string, tabId: number, origin: string): Promise<SessionGraph> {
  const graph: SessionGraph = {
    id: uid(),
    taskGoal,
    nodes: [{ tabId, origin, stepIndex: 0, timestamp: Date.now() }],
    createdAt: Date.now(),
  };
  await chrome.storage.session.set({ [STORAGE_KEY]: graph });
  return graph;
}

export async function loadSession(): Promise<SessionGraph | null> {
  const result = await chrome.storage.session.get(STORAGE_KEY);
  return (result[STORAGE_KEY] as SessionGraph) ?? null;
}

export async function pushNavigation(tabId: number, origin: string): Promise<SessionGraph | null> {
  const graph = await loadSession();
  if (!graph) return null;

  const last = graph.nodes.at(-1);
  const node: SessionNode = {
    tabId,
    origin,
    stepIndex: last?.stepIndex ?? 0,
    timestamp: Date.now(),
  };
  graph.nodes.push(node);
  await chrome.storage.session.set({ [STORAGE_KEY]: graph });
  return graph;
}

export async function advanceStep(stepIndex: number): Promise<void> {
  const graph = await loadSession();
  if (!graph) return;
  const last = graph.nodes.at(-1);
  if (last) last.stepIndex = stepIndex;
  await chrome.storage.session.set({ [STORAGE_KEY]: graph });
}

export async function clearSession(): Promise<void> {
  await chrome.storage.session.remove(STORAGE_KEY);
}
