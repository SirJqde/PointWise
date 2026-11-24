// ============================================================
// PointWise — Session Graph & Power State
// Persisted in chrome.storage.session (memory-only, survives
// popup close & tab reloads, cleared when browser closes).
// ============================================================

import type {
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

export async function setPowerOn(
  taskGoal = "",
  guiding = false,
  resetContext = false
): Promise<SessionGraph> {
  const existing = await loadSession();
  const goalChanged = Boolean(taskGoal && existing?.taskGoal && taskGoal !== existing.taskGoal);

  const graph: SessionGraph = existing
    ? {
        ...existing,
        on: true,
        guiding: guiding || existing.guiding,
        taskGoal: taskGoal || existing.taskGoal,
      }
    : {
        id: uid(),
        on: true,
        guiding,
        taskGoal,
        nodes: [],
        createdAt: Date.now(),
      };

  if (resetContext || goalChanged) {
    delete graph.contextProvided;
    delete graph.contextQuestion;
  }

  await chrome.storage.session.set({ [SESSION_STORAGE_KEY]: graph });
  return graph;
}

export async function saveSearchResults(
  lastQuery: string,
  lastResults: SearchResultItem[]
): Promise<void> {
  const existing = await loadSession();
  if (!existing || !existing.on) return;
  existing.lastQuery = lastQuery;
  existing.lastResults = lastResults;
  existing.taskGoal = lastQuery;
  delete existing.contextProvided;
  delete existing.contextQuestion;
  await chrome.storage.session.set({ [SESSION_STORAGE_KEY]: existing });
}

export async function setContextQuestion(question: string): Promise<void> {
  const existing = await loadSession();
  if (!existing || !existing.on) return;
  existing.contextQuestion = question;
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
  await chrome.storage.session.set({ [SESSION_STORAGE_KEY]: existing });
  return existing;
}

export async function createSession(
  taskGoal: string,
  tabId: number,
  origin: string,
  resetContext = false
): Promise<SessionGraph> {
  const existing = await loadSession();
  const node: SessionNode = {
    tabId,
    origin,
    stepIndex: 0,
    timestamp: Date.now(),
  };
  const graph: SessionGraph = {
    id: existing?.id ?? uid(),
    on: true,
    guiding: true,
    taskGoal: taskGoal || existing?.taskGoal || "",
    nodes: [node],
    createdAt: existing?.createdAt ?? Date.now(),
  };
  if (existing?.lastQuery !== undefined) graph.lastQuery = existing.lastQuery;
  if (existing?.lastResults !== undefined) graph.lastResults = existing.lastResults;
  if (!resetContext && existing?.contextProvided !== undefined) {
    graph.contextProvided = existing.contextProvided;
  }
  await chrome.storage.session.set({ [SESSION_STORAGE_KEY]: graph });
  return graph;
}

export async function pushNavigation(
  tabId: number,
  origin: string
): Promise<SessionGraph | null> {
  const graph = await loadSession();
  if (!graph || !graph.on) return null;

  const last = graph.nodes.at(-1);
  const node: SessionNode = {
    tabId,
    origin,
    stepIndex: last?.stepIndex ?? 0,
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
  if (last) last.stepIndex = stepIndex;
  await chrome.storage.session.set({ [SESSION_STORAGE_KEY]: graph });
}

export async function clearSession(): Promise<void> {
  await chrome.storage.session.remove(SESSION_STORAGE_KEY);
}
