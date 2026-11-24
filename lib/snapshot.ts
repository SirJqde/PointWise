// ============================================================
// DOM Snapshot Builder — serialises the accessibility tree into
// a scrubbed JSON structure safe to send to the AI model.
// ============================================================

import { isSensitiveField, scrubText } from "./scrubber.js";
import type { ScrubbedSnapshot, SnapshotElement } from "./types.js";

export function buildSnapshot(): ScrubbedSnapshot {
  const elements: SnapshotElement[] = [];

  document.querySelectorAll<HTMLElement>(
    "a, button, input, select, textarea, label, [role], [tabindex]"
  ).forEach((el) => {
    // Skip hidden elements
    if (!isVisible(el)) return;

    const label = getLabel(el);
    const name = (el as HTMLInputElement).name ?? "";

    // Always exclude sensitive fields from snapshot
    if (isSensitiveField(label, name)) return;
    if ((el as HTMLInputElement).type === "password") return;

    const rect = el.getBoundingClientRect();
    elements.push({
      selector: buildSelector(el),
      role: el.getAttribute("role") ?? el.tagName.toLowerCase(),
      label: scrubText(label),
      tagName: el.tagName.toLowerCase(),
      rect: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) },
      visible: rect.width > 0 && rect.height > 0,
      disabled: (el as HTMLInputElement).disabled ?? false,
      hasFileInput: (el as HTMLInputElement).type === "file" || undefined,
    });
  });

  return {
    url: location.href,
    title: scrubText(document.title),
    elements,
  };
}

// ── Helpers ──────────────────────────────────────────────────

function isVisible(el: HTMLElement): boolean {
  const style = window.getComputedStyle(el);
  return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
}

function getLabel(el: HTMLElement): string {
  return (
    el.getAttribute("aria-label") ??
    el.getAttribute("placeholder") ??
    el.getAttribute("title") ??
    el.textContent?.trim().slice(0, 80) ??
    ""
  );
}

function buildSelector(el: HTMLElement): string {
  if (el.id) return `#${CSS.escape(el.id)}`;
  if (el.getAttribute("aria-label"))
    return `[aria-label="${el.getAttribute("aria-label")}"]`;
  // Fallback: tag + nth-child (not guaranteed stable across re-renders)
  const parent = el.parentElement;
  if (!parent) return el.tagName.toLowerCase();
  const siblings = Array.from(parent.children).filter((c) => c.tagName === el.tagName);
  const idx = siblings.indexOf(el) + 1;
  return `${buildSelector(parent as HTMLElement) } > ${el.tagName.toLowerCase()}:nth-of-type(${idx})`;
}
