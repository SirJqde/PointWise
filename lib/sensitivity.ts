// ============================================================
// Sensitivity Detector — classifies DOM elements / page regions
// into the sensitivity classes the pause gate uses.
// ============================================================

import type { SensitivityClass } from "./types.js";

interface SensitivityRule {
  class: SensitivityClass;
  /** Match against element's outerHTML or surrounding text (lowercased) */
  patterns: RegExp[];
  /** Match against iframe src */
  iframeSrcPatterns?: RegExp[];
}

const RULES: SensitivityRule[] = [
  {
    class: "captcha",
    patterns: [/captcha/i, /challenge/i, /prove.*human/i],
    iframeSrcPatterns: [
      /recaptcha/i,
      /hcaptcha\.com/i,
      /turnstile\.cloudflare\.com/i,
      /altcha\.org/i,
    ],
  },
  {
    class: "otp",
    patterns: [/one.?time/i, /\botp\b/i, /verification.?code/i, /auth.*code/i],
  },
  {
    class: "payment",
    patterns: [/credit.?card/i, /card.?number/i, /cvv|cvc/i, /upi\b/i, /pay now/i],
    iframeSrcPatterns: [
      /stripe\.com/i,
      /razorpay\.com/i,
      /braintreegateway\.com/i,
      /paypal\.com/i,
      /payu\./i,
    ],
  },
  {
    class: "legal",
    patterns: [/i agree/i, /terms.*condition/i, /declaration/i, /i hereby/i, /consent/i],
  },
];

/**
 * Classifies a target element and its context.
 * Accepts the element's label/outerHTML and optionally the surrounding section text.
 */
export function detectSensitivity(
  elementText: string,
  surroundingText: string,
  iframeSrcs: string[] = []
): SensitivityClass {
  const haystack = `${elementText} ${surroundingText}`.toLowerCase();

  for (const rule of RULES) {
    const textMatch = rule.patterns.some((re) => re.test(haystack));
    const iframeMatch =
      rule.iframeSrcPatterns?.some((re) => iframeSrcs.some((src) => re.test(src))) ?? false;

    if (textMatch || iframeMatch) {
      return rule.class;
    }
  }

  return "normal";
}
