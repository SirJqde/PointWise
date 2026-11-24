// ============================================================
// DOM Snapshot Builder — serialises interactive elements into
// a scrubbed JSON structure safe to send to the AI model.
// ============================================================

import { isSensitiveField, scrubText } from "./scrubber.js";
import type { ScrubbedSnapshot, SnapshotElement } from "./types.js";

const MAX_ELEMENTS = 100;

export function buildSnapshot(): ScrubbedSnapshot {
  const rawElements: (SnapshotElement & { _priority: number })[] = [];
  const seenSelectors = new Set<string>();
  const vh = window.innerHeight || 800;
  const vw = window.innerWidth || 1280;

  document
    .querySelectorAll<HTMLElement>(
      'a[href], button, input, select, textarea, [role="button"], [role="link"], [role="textbox"], [role="combobox"], [role="searchbox"], [role="menuitem"], [role="tab"], [tabindex]'
    )
    .forEach((el) => {
      if (el.closest("#pointwise-host")) return;
      if (!isVisible(el)) return;

      const rect = el.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;

      const label = getLabel(el);
      const name = (el as HTMLInputElement).name ?? "";
      const inputType = (el as HTMLInputElement).type?.toLowerCase();

      // Always exclude sensitive fields from snapshot
      if (isSensitiveField(label, name)) return;
      if (inputType === "password" || inputType === "hidden") return;

      // Skip unlabeled empty anchors/tabindex wrappers unless they have a clear role/input
      const tag = el.tagName.toLowerCase();
      if (!label && tag !== "input" && tag !== "select" && tag !== "textarea") {
        return;
      }

      const selector = buildSelector(el);
      if (!selector || seenSelectors.has(selector)) return;
      seenSelectors.add(selector);

      const inViewport =
        rect.bottom >= 0 &&
        rect.right >= 0 &&
        rect.top <= vh &&
        rect.left <= vw;

      const isPrimaryControl =
        tag === "input" ||
        tag === "button" ||
        tag === "select" ||
        tag === "textarea" ||
        el.getAttribute("role") === "button";

      const priority = (inViewport ? 10 : 0) + (isPrimaryControl ? 5 : 0);

      const item: SnapshotElement & { _priority: number } = {
        selector,
        role: el.getAttribute("role") ?? tag,
        label: scrubText(label),
        tagName: tag,
        rect: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        },
        visible: true,
        inViewport,
        disabled: (el as HTMLInputElement).disabled ?? false,
        _priority: priority,
      };
      if (tag === "input" && inputType) item.inputType = inputType;
      if (inputType === "file") item.hasFileInput = true;
      rawElements.push(item);
    });

  rawElements.sort((a, b) => b._priority - a._priority);
  const elements: SnapshotElement[] = rawElements
    .slice(0, MAX_ELEMENTS)
    .map(({ _priority: _p, ...rest }) => rest);

  return {
    url: location.href,
    title: scrubText(document.title),
    elements,
  };
}

// ── Helpers ──────────────────────────────────────────────────

function isVisible(el: HTMLElement): boolean {
  if (el.getAttribute("aria-hidden") === "true") return false;
  const style = window.getComputedStyle(el);
  return (
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    parseFloat(style.opacity || "1") > 0.05
  );
}

function getLabel(el: HTMLElement): string {
  const id = el.id;
  const associatedLabel = id
    ? document.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(id)}"]`)?.textContent
    : undefined;

  return (
    el.getAttribute("aria-label") ??
    el.getAttribute("placeholder") ??
    associatedLabel?.trim() ??
    el.getAttribute("title") ??
    (el as HTMLInputElement).value?.trim?.() ??
    el.textContent?.replace(/\s+/g, " ").trim().slice(0, 80) ??
    ""
  );
}

function isUniqueSelector(sel: string): boolean {
  try {
    return document.querySelectorAll(sel).length === 1;
  } catch {
    return false;
  }
}

function attrSelector(attr: string, value: string): string {
  const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `[${attr}="${escaped}"]`;
}

function buildSelector(el: HTMLElement): string {
  if (el.id) {
    const idSel = `#${CSS.escape(el.id)}`;
    if (isUniqueSelector(idSel)) return idSel;
  }

  for (const attr of ["data-testid", "aria-label", "name", "placeholder"]) {
    const val = el.getAttribute(attr);
    if (val && val.length < 80) {
      const sel = `${el.tagName.toLowerCase()}${attrSelector(attr, val)}`;
      if (isUniqueSelector(sel)) return sel;
    }
  }

  return buildPathSelector(el);
}

function buildPathSelector(el: HTMLElement): string {
  const parts: string[] = [];
  let cur: HTMLElement | null = el;

  while (cur && cur.tagName.toLowerCase() !== "html") {
    if (cur.id) {
      const idSel = `#${CSS.escape(cur.id)}`;
      if (isUniqueSelector(idSel)) {
        parts.unshift(idSel);
        break;
      }
    }

    const parent: HTMLElement | null = cur.parentElement;
    const tag = cur.tagName.toLowerCase();
    if (!parent) {
      parts.unshift(tag);
      break;
    }

    const curTag = cur.tagName;
    const siblings = Array.from(parent.children).filter(
      (c: Element) => c.tagName === curTag
    );
    const idx = siblings.indexOf(cur) + 1;
    parts.unshift(siblings.length > 1 ? `${tag}:nth-of-type(${idx})` : tag);
    cur = parent;
  }

  return parts.join(" > ");
}
