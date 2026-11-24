// ============================================================
// Tests — file-validator.test.ts
// ============================================================

import { describe, it, expect } from "vitest";
import { validateFile } from "../content/file-validator";

// Helper: create a minimal File with specific magic bytes
function makeFile(bytes: number[], name: string, type: string): File {
  const buf = new Uint8Array(bytes);
  return new File([buf], name, { type });
}

const JPEG_MAGIC = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46];
const PNG_MAGIC  = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const PDF_MAGIC  = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34];

describe("validateFile — MIME detection", () => {
  it("accepts a real JPEG", async () => {
    const file = makeFile(JPEG_MAGIC, "photo.jpg", "image/jpeg");
    const result = await validateFile(file, { allowedMimes: ["image/jpeg"] });
    expect(result.errors.filter(e => e.includes("format"))).toHaveLength(0);
  });

  it("rejects a PNG disguised as JPEG", async () => {
    const file = makeFile(PNG_MAGIC, "photo.jpg", "image/jpeg");
    const result = await validateFile(file, { allowedMimes: ["image/jpeg"] });
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.includes("format"))).toBe(true);
  });

  it("accepts a PDF when PDF is allowed", async () => {
    const file = makeFile(PDF_MAGIC, "doc.pdf", "application/pdf");
    const result = await validateFile(file, { allowedMimes: ["application/pdf"] });
    expect(result.errors.filter(e => e.includes("format"))).toHaveLength(0);
  });
});

describe("validateFile — size limit", () => {
  it("rejects file exceeding maxBytes", async () => {
    const file = makeFile([...JPEG_MAGIC, ...new Array(2000).fill(0)], "big.jpg", "image/jpeg");
    const result = await validateFile(file, { allowedMimes: ["image/jpeg"], maxBytes: 100 });
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.includes("large"))).toBe(true);
  });

  it("accepts file within maxBytes", async () => {
    const file = makeFile(JPEG_MAGIC, "small.jpg", "image/jpeg");
    const result = await validateFile(file, { allowedMimes: ["image/jpeg"], maxBytes: 1_000_000 });
    expect(result.errors.filter(e => e.includes("large"))).toHaveLength(0);
  });
});
