// ============================================================
// PII Scrubber — strips personal data from DOM snapshots
// before they leave the content script context.
// NOTHING that matches these patterns ever reaches the AI model.
// ============================================================

/** Field name / aria-label / placeholder patterns that are always excluded */
const SENSITIVE_FIELD_PATTERNS: RegExp[] = [
  /password/i,
  /passcode/i,
  /pin\b/i,
  /credit.?card/i,
  /card.?number/i,
  /cvv|cvc|csc/i,
  /expir/i,
  /otp/i,
  /one.?time/i,
  /verification.?code/i,
  /aadhaar|aadhar/i,
  /pan.?number/i,
  /ssn|social.?security/i,
  /passport.?number/i,
  /date.?of.?birth|dob\b/i,
];

/** Regex patterns applied to text node content */
const PII_TEXT_PATTERNS: RegExp[] = [
  // Email
  /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,
  // Phone (Indian / international)
  /(\+?\d[\s\-]?){9,13}/g,
  // Aadhaar
  /\b\d{4}\s?\d{4}\s?\d{4}\b/g,
  // PAN
  /\b[A-Z]{5}\d{4}[A-Z]\b/g,
  // SSN
  /\b\d{3}-\d{2}-\d{4}\b/g,
];

const REDACTED = "[REDACTED]";
const MAX_TEXT_LENGTH = 120;

/**
 * Returns true if the element's identifying attributes suggest a sensitive field.
 */
export function isSensitiveField(label: string, name?: string): boolean {
  const haystack = `${label} ${name ?? ""}`;
  return SENSITIVE_FIELD_PATTERNS.some((re) => re.test(haystack));
}

/**
 * Scrubs PII from a free-form text string.
 * Also truncates long strings to avoid leaking verbose page content.
 */
export function scrubText(raw: string): string {
  let s = raw;
  for (const re of PII_TEXT_PATTERNS) {
    s = s.replace(re, REDACTED);
  }
  return s.length > MAX_TEXT_LENGTH ? s.slice(0, MAX_TEXT_LENGTH) + "…" : s;
}
