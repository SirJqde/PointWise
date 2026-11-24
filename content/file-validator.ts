// ============================================================
// Pre-flight File Validator — 100% client-side, in-memory.
// Hooks into <input type="file"> elements to validate MIME type,
// byte size, image dimensions, and optionally resize locally.
// Zero bytes are ever transmitted off device.
// ============================================================

export interface ValidationConstraints {
  /** Allowed MIME types (e.g. ["image/jpeg", "image/png", "application/pdf"]) */
  allowedMimes: string[];
  /** Maximum file size in bytes */
  maxBytes?: number;
  /** For images: maximum width in pixels */
  maxWidth?: number;
  /** For images: maximum height in pixels */
  maxHeight?: number;
}

export interface ValidationResult {
  ok: boolean;
  actualMime?: string;
  sizeBytes?: number;
  width?: number;
  height?: number;
  errors: string[];
  resizedBlob?: Blob;   // only if resize was requested and succeeded
}

// Magic bytes for common formats
const MAGIC: Record<string, number[][]> = {
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  "image/png": [[0x89, 0x50, 0x4e, 0x47]],
  "image/gif": [[0x47, 0x49, 0x46, 0x38]],
  "image/webp": [[0x52, 0x49, 0x46, 0x46]],  // "RIFF"
  "application/pdf": [[0x25, 0x50, 0x44, 0x46]],  // "%PDF"
  "application/zip": [[0x50, 0x4b, 0x03, 0x04]],
};

/**
 * Validates a File object against constraints entirely in-memory.
 * Does NOT transmit the file anywhere.
 */
export async function validateFile(
  file: File,
  constraints: ValidationConstraints,
  offerResize = false
): Promise<ValidationResult> {
  const errors: string[] = [];
  const result: ValidationResult = { ok: false, sizeBytes: file.size, errors };

  // 1. True MIME via magic bytes
  const header = await readHeader(file, 8);
  const actualMime = detectMime(header);
  result.actualMime = actualMime ?? file.type;

  if (actualMime && !constraints.allowedMimes.includes(actualMime)) {
    errors.push(
      `File format not accepted. Detected: ${actualMime}. ` +
      `Allowed: ${constraints.allowedMimes.join(", ")}.`
    );
  }

  // 2. Size check
  if (constraints.maxBytes && file.size > constraints.maxBytes) {
    errors.push(
      `File too large: ${formatBytes(file.size)}. ` +
      `Maximum: ${formatBytes(constraints.maxBytes)}.`
    );
  }

  // 3. Image dimension check
  if (actualMime?.startsWith("image/") && (constraints.maxWidth || constraints.maxHeight)) {
    const dims = await getImageDimensions(file);
    result.width = dims.width;
    result.height = dims.height;

    const tooWide = constraints.maxWidth && dims.width > constraints.maxWidth;
    const tooTall = constraints.maxHeight && dims.height > constraints.maxHeight;

    if (tooWide || tooTall) {
      if (offerResize) {
        const targetW = constraints.maxWidth ?? dims.width;
        const targetH = constraints.maxHeight ?? dims.height;
        result.resizedBlob = await resizeImage(file, targetW, targetH);
        // Clear dimension errors if resize succeeded
        if (result.resizedBlob) {
          result.ok = errors.length === 0;
          return result;
        }
      }
      errors.push(
        `Image too large: ${dims.width}×${dims.height}px. ` +
        `Maximum: ${constraints.maxWidth ?? "∞"}×${constraints.maxHeight ?? "∞"}px.`
      );
    }
  }

  result.ok = errors.length === 0;
  return result;
}

// ── Hooks ─────────────────────────────────────────────────────

/**
 * Attaches validation to all current and future <input type="file"> elements.
 * Returns a cleanup function.
 */
export function hookFileInputs(
  getConstraints: (input: HTMLInputElement) => ValidationConstraints | null,
  onResult: (input: HTMLInputElement, result: ValidationResult) => void
): () => void {
  function attachToInput(input: HTMLInputElement): void {
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;
      const constraints = getConstraints(input);
      if (!constraints) return;
      const result = await validateFile(file, constraints, true);
      onResult(input, result);
    });
  }

  // Attach to existing
  document.querySelectorAll<HTMLInputElement>("input[type=file]").forEach(attachToInput);

  // Watch for dynamically added inputs
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      m.addedNodes.forEach((node) => {
        if (node instanceof HTMLInputElement && node.type === "file") {
          attachToInput(node);
        }
        if (node instanceof HTMLElement) {
          node.querySelectorAll<HTMLInputElement>("input[type=file]").forEach(attachToInput);
        }
      });
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  return () => observer.disconnect();
}

// ── Internal Helpers ───────────────────────────────────────────

async function readHeader(file: File, bytes: number): Promise<Uint8Array> {
  const slice = file.slice(0, bytes);
  const buf = await slice.arrayBuffer();
  return new Uint8Array(buf);
}

function detectMime(header: Uint8Array): string | null {
  for (const [mime, signatures] of Object.entries(MAGIC)) {
    for (const sig of signatures) {
      if (sig.every((byte, i) => header[i] === byte)) return mime;
    }
  }
  return null;
}

async function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve({ width: img.naturalWidth, height: img.naturalHeight }); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not decode image")); };
    img.src = url;
  });
}

async function resizeImage(file: File, maxW: number, maxH: number): Promise<Blob | undefined> {
  try {
    const dims = await getImageDimensions(file);
    const scale = Math.min(maxW / dims.width, maxH / dims.height, 1);
    const w = Math.round(dims.width * scale);
    const h = Math.round(dims.height * scale);

    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext("2d")!;
    const bitmap = await createImageBitmap(file);
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();

    return await canvas.convertToBlob({ type: file.type, quality: 0.92 });
  } catch {
    return undefined;
  }
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 ** 2).toFixed(1)} MB`;
}
