// ============================================================
// PointWise — Session Graph & Power State
// Persisted in chrome.storage.session (memory-only, survives
// popup close & tab reloads, cleared when browser closes).
// ============================================================

import type {
  GuidanceFailure,
  GuidanceRequest,
  SearchResultItem,
  SessionGraph,
  SessionNode,
} from "./types.js";

export const SESSION_STORAGE_KEY = "pointwise_session";

function uid(): string {
  return crypto.randomUUID();
}

export async function loadSession(): Promise<SessionGraph | null> {
  const result = await chrome.storage.session.get(SESSION_STORAGE_KEY);
  const graph = result[SESSION_STORAGE_KEY] as SessionGraph | undefined;
  return graph ?? null;
}

export async function setPowerOn(): Promise<void> {
  const existing = await loadSession();
  if (existing?.on) return;
  const graph: SessionGraph = {
    id: uid(),
    on: true,
    guiding: false,
    taskGoal: "",
    nodes: [],
    createdAt: Date.now(),
  };
  await chrome.storage.session.set({ [SESSION_STORAGE_KEY]: graph });
}

export async function saveSearchResults(
  lastQuery: string,
  lastResults: SearchResultItem[]
): Promise<void> {
  const existing = await loadSession();
  if (!existing || !existing.on) return;
  existing.lastQuery = lastQuery;
  existing.lastResults = lastResults;
  await chrome.storage.session.set({ [SESSION_STORAGE_KEY]: existing });
}

export async function saveGuidanceRequest(request?: GuidanceRequest): Promise<void> {
  const graph = await loadSession();
  if (!graph?.on) return;
  if (request) {
    graph.request = request;
    const node = graph.nodes.at(-1);
    if (node) node.stepIndex = 0;
  } else {
    delete graph.request;
  }
  delete graph.contextQuestion;
  delete graph.contextRequestId;
  delete graph.guidanceFailure;
  await chrome.storage.session.set({ [SESSION_STORAGE_KEY]: graph });
}

export async function saveGuidanceFailure(failure: GuidanceFailure): Promise<void> {
  const graph = await loadSession();
  if (!graph?.on) return;
  graph.guidanceFailure = failure;
  await chrome.storage.session.set({ [SESSION_STORAGE_KEY]: graph });
}

export async function setContextQuestion(question: string, requestId: string): Promise<void> {
  const existing = await loadSession();
  if (!existing || !existing.on) return;
  existing.contextQuestion = question;
  existing.contextRequestId = requestId;
  await chrome.storage.session.set({ [SESSION_STORAGE_KEY]: existing });
}

export async function applyContextAnswer(answer: string): Promise<SessionGraph | null> {
  const existing = await loadSession();
  if (!existing || !existing.on) return null;

  const trimmed = answer.trim();
  if (trimmed) {
    existing.taskGoal = existing.taskGoal
      ? `${existing.taskGoal} — ${trimmed}`
      : trimmed;
  }
  existing.contextProvided = true;
  delete existing.contextQuestion;
  delete existing.contextRequestId;
  await chrome.storage.session.set({ [SESSION_STORAGE_KEY]: existing });
  return existing;
}

export async function createSession(
  taskGoal: string,
  tabId: number,
  origin: string
): Promise<SessionGraph> {
  const existing = await loadSession();
  const node: SessionNode = {
    tabId,
    origin,
    stepIndex: 0,
    timestamp: Date.now(),
  };
  const graph: SessionGraph = {
    id: uid(),
    on: true,
    guiding: true,
    tabId,
    taskGoal: taskGoal || existing?.taskGoal || "",
    nodes: [node],
    createdAt: existing?.createdAt ?? Date.now(),
  };
  if (existing?.lastQuery !== undefined) graph.lastQuery = existing.lastQuery;
  if (existing?.lastResults !== undefined) graph.lastResults = existing.lastResults;
  await chrome.storage.session.set({ [SESSION_STORAGE_KEY]: graph });
  return graph;
}

export async function pushNavigation(
  tabId: number,
  origin: string
): Promise<SessionGraph | null> {
  const graph = await loadSession();
  if (!graph?.on || graph.tabId !== tabId) return null;

  const node: SessionNode = {
    tabId,
    origin,
    stepIndex: 0,
    timestamp: Date.now(),
  };
  graph.nodes.push(node);
  await chrome.storage.session.set({ [SESSION_STORAGE_KEY]: graph });
  return graph;
}

export async function advanceStep(stepIndex: number): Promise<void> {
  const graph = await loadSession();
  if (!graph || !graph.on) return;
  const last = graph.nodes.at(-1);
  if (last) last.stepIndex = Math.max(last.stepIndex, stepIndex);
  await chrome.storage.session.set({ [SESSION_STORAGE_KEY]: graph });
}

export async function clearSession(): Promise<void> {
  await chrome.storage.session.remove(SESSION_STORAGE_KEY);
}
