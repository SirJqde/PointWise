// ============================================================
// Intent-Driven Base Search Router — v3
//
// Resolution pipeline:
//   Stage 1 — Static Allowlist (instant, highest trust)
//   Stage 2 — DuckDuckGo Instant Answer (fallback, any domain)
//   Stage 3 — Multi-signal verification (DNS + CT + HSTS)
// ============================================================

import { verifyDomain, type DetailedVerificationResult } from "./verifier.js";

export type { DetailedVerificationResult };

// ── Static Allowlist ──────────────────────────────────────────
// Covers government portals AND official commercial/utility
// services that citizens commonly need help with.

const ALLOWLIST: { keywords: string[]; domain: string; label: string }[] = [

  // ── India — Government ────────────────────────────────────
  { keywords: ["income tax", "itr", "file tax return", "tax filing india"], domain: "www.incometax.gov.in", label: "Income Tax Department India" },
  { keywords: ["passport india", "renew passport india", "apply passport india", "passport seva"], domain: "www.passportindia.gov.in", label: "Passport Seva India" },
  { keywords: ["pan card", "pan number", "nsdl pan", "apply pan"], domain: "www.onlineservices.nsdl.com", label: "NSDL PAN Services" },
  { keywords: ["aadhaar", "aadhar update", "uidai", "enroll aadhaar"], domain: "myaadhaar.uidai.gov.in", label: "MyAadhaar (UIDAI)" },
  { keywords: ["epfo", "pf balance", "provident fund", "employee provident fund", "pf withdrawal"], domain: "www.epfindia.gov.in", label: "EPFO India" },
  { keywords: ["gst registration", "gst portal india", "gstin", "gst return"], domain: "www.gst.gov.in", label: "GST Portal India" },
  { keywords: ["voter id", "voter registration india", "election commission india", "eci voter"], domain: "voters.eci.gov.in", label: "Election Commission of India" },
  { keywords: ["digilocker", "digital locker india", "digital documents india"], domain: "www.digilocker.gov.in", label: "DigiLocker India" },
  { keywords: ["national scholarship india", "nsp scholarship", "pm scholarship india"], domain: "scholarships.gov.in", label: "National Scholarship Portal" },
  { keywords: ["pm kisan", "pmkisan", "farmer subsidy india"], domain: "pmkisan.gov.in", label: "PM-KISAN" },
  { keywords: ["ration card india", "food security india", "nfsa"], domain: "nfsa.gov.in", label: "National Food Security Portal" },
  { keywords: ["court case status india", "ecourts", "case status high court"], domain: "ecourts.gov.in", label: "eCourts India" },
  { keywords: ["company registration india", "mca21", "ministry of corporate affairs", "mca portal"], domain: "www.mca.gov.in", label: "Ministry of Corporate Affairs" },
  { keywords: ["udyam registration", "msme registration india", "udyog aadhar"], domain: "udyamregistration.gov.in", label: "Udyam Registration" },
  { keywords: ["ayushman bharat", "pmjay", "health card india", "pm jan arogya"], domain: "pmjay.gov.in", label: "Ayushman Bharat PM-JAY" },
  { keywords: ["jeevan pramaan", "pension certificate india", "life certificate"], domain: "jeevanpramaan.gov.in", label: "Jeevan Pramaan" },
  { keywords: ["umang app", "umang portal india"], domain: "web.umang.gov.in", label: "UMANG India" },
  { keywords: ["national portal india", "government services india", "india gov"], domain: "www.india.gov.in", label: "National Portal of India" },
  { keywords: ["e shram", "eshram card", "unorganised worker india"], domain: "eshram.gov.in", label: "e-Shram Portal" },
  { keywords: ["pm svamitva", "property card india"], domain: "svamitva.gov.in", label: "SVAMITVA Scheme" },
  { keywords: ["cowin", "covid vaccine certificate india", "vaccination certificate india"], domain: "www.cowin.gov.in", label: "CoWIN India" },

  // ── India — Transport & Travel ────────────────────────────
  { keywords: ["irctc", "train ticket india", "train booking india", "indian railways ticket", "book train"], domain: "www.irctc.co.in", label: "IRCTC Rail Connect" },
  { keywords: ["driving licence india", "dl apply india", "sarathi", "vehicle registration india", "parivahan", "rc renewal", "driving license application"], domain: "parivahan.gov.in", label: "Parivahan Sewa (DL/RC)" },
  { keywords: ["redbus", "book bus india", "bus ticket india", "bus booking india"], domain: "www.redbus.in", label: "RedBus" },
  { keywords: ["abhibus", "abhi bus"], domain: "www.abhibus.com", label: "AbhiBus" },
  { keywords: ["ksrtc bus", "ksrtc ticket", "karnataka bus"], domain: "www.ksrtc.in", label: "KSRTC Karnataka" },
  { keywords: ["apsrtc bus", "andhra pradesh bus", "ap bus ticket"], domain: "www.apsrtconline.in", label: "APSRTC Online" },
  { keywords: ["msrtc bus", "maharashtra bus", "shivneri bus", "pune bus"], domain: "www.msrtcets.in", label: "MSRTC Maharashtra" },
  { keywords: ["upsrtc bus", "uttar pradesh bus", "up roadways"], domain: "www.upsrtconline.co.in", label: "UPSRTC UP Roadways" },
  { keywords: ["hrtc bus", "himachal bus", "hp bus booking"], domain: "www.hrtchp.com", label: "HRTC Himachal Pradesh" },
  { keywords: ["tsrtc bus", "telangana bus", "ts bus ticket"], domain: "www.tsrtconline.in", label: "TSRTC Telangana" },
  { keywords: ["tnstc bus", "tamil nadu bus", "setc bus"], domain: "www.tnstc.in", label: "TNSTC Tamil Nadu" },
  { keywords: ["gsrtc bus", "gujarat bus", "gujarat roadways"], domain: "www.gsrtc.in", label: "GSRTC Gujarat" },
  { keywords: ["rsrtc bus", "rajasthan bus", "rajasthan roadways"], domain: "www.rsrtc.rajasthan.gov.in", label: "RSRTC Rajasthan" },
  { keywords: ["dtc bus delhi", "delhi bus pass", "delhi transport"], domain: "www.dtc.delhi.gov.in", label: "DTC Delhi" },
  { keywords: ["pepsu bus", "punjab bus", "punjab roadways"], domain: "www.prtcpunjab.in", label: "PRTC Punjab" },
  { keywords: ["fly air india", "air india booking", "air india flight"], domain: "www.airindia.in", label: "Air India" },
  { keywords: ["indigo flight", "indigo booking", "book indigo"], domain: "www.goindigo.in", label: "IndiGo Airlines" },
  { keywords: ["spicejet flight", "spicejet booking"], domain: "www.spicejet.com", label: "SpiceJet" },
  { keywords: ["vistara flight", "vistara booking"], domain: "www.airvistara.com", label: "Vistara Airlines" },
  { keywords: ["makemytrip flight", "makemytrip hotel", "mmt booking"], domain: "www.makemytrip.com", label: "MakeMyTrip" },
  { keywords: ["cleartrip booking", "cleartrip flight"], domain: "www.cleartrip.com", label: "Cleartrip" },
  { keywords: ["ixigo train", "ixigo bus", "ixigo booking"], domain: "www.ixigo.com", label: "ixigo" },

  // ── India — Banking & Finance ─────────────────────────────
  { keywords: ["sbi net banking", "sbi online banking", "state bank of india login"], domain: "www.onlinesbi.sbi", label: "SBI Net Banking" },
  { keywords: ["hdfc net banking", "hdfc bank login", "hdfc netbanking"], domain: "netbanking.hdfcbank.com", label: "HDFC NetBanking" },
  { keywords: ["icici net banking", "icici bank login", "icici netbanking"], domain: "www.icicibank.com", label: "ICICI Bank" },
  { keywords: ["axis net banking", "axis bank login", "axis netbanking"], domain: "www.axisbank.com", label: "Axis Bank" },
  { keywords: ["paytm payment", "paytm wallet", "paytm upi"], domain: "paytm.com", label: "Paytm" },
  { keywords: ["phonepe payment", "phonepe upi"], domain: "www.phonepe.com", label: "PhonePe" },
  { keywords: ["google pay india", "gpay upi"], domain: "pay.google.com", label: "Google Pay India" },

  // ── India — Utilities & Services ─────────────────────────
  { keywords: ["gas booking india", "hp gas", "indane gas", "bharat gas", "lpg refill india"], domain: "www.mylpg.in", label: "MyLPG Portal (HP/Indane/Bharat Gas)" },
  { keywords: ["electricity bill india", "power bill india", "bses bill", "bescom bill", "discom bill"], domain: "www.payurban.in", label: "PayUrban (Electricity Bills)" },
  { keywords: ["water bill india", "municipal water bill"], domain: "www.payurban.in", label: "PayUrban (Municipal Bills)" },
  { keywords: ["amazon india", "amazon.in shopping", "amazon india order"], domain: "www.amazon.in", label: "Amazon India" },
  { keywords: ["flipkart", "flipkart shopping", "flipkart order"], domain: "www.flipkart.com", label: "Flipkart" },
  { keywords: ["meesho", "meesho order"], domain: "www.meesho.com", label: "Meesho" },
  { keywords: ["naukri job", "naukri apply", "find job india"], domain: "www.naukri.com", label: "Naukri.com" },
  { keywords: ["linkedin job", "linkedin apply india"], domain: "www.linkedin.com", label: "LinkedIn" },
  { keywords: ["swiggy order food", "swiggy delivery"], domain: "www.swiggy.com", label: "Swiggy" },
  { keywords: ["zomato order food", "zomato delivery"], domain: "www.zomato.com", label: "Zomato" },
  { keywords: ["bigbasket grocery", "bigbasket order"], domain: "www.bigbasket.com", label: "BigBasket" },

  // ── USA ───────────────────────────────────────────────────
  { keywords: ["social security usa", "ssa benefits", "social security card usa"], domain: "www.ssa.gov", label: "Social Security Administration" },
  { keywords: ["us passport", "renew passport usa", "passport application usa"], domain: "travel.state.gov", label: "US State Dept Travel (Passport)" },
  { keywords: ["irs tax", "file federal taxes usa", "us tax return", "irs.gov"], domain: "www.irs.gov", label: "IRS (US Tax)" },
  { keywords: ["fafsa", "federal student aid usa", "student loan usa"], domain: "studentaid.gov", label: "Federal Student Aid (FAFSA)" },
  { keywords: ["usa jobs", "usajobs", "federal job application usa"], domain: "www.usajobs.gov", label: "USAJobs" },
  { keywords: ["medicare usa", "medicaid usa"], domain: "www.medicare.gov", label: "Medicare.gov" },
  { keywords: ["green card", "immigration usa", "uscis", "visa usa"], domain: "www.uscis.gov", label: "USCIS Immigration" },
  { keywords: ["veterans benefits usa", "va benefits", "gi bill"], domain: "www.va.gov", label: "US Department of Veterans Affairs" },
  { keywords: ["food stamps usa", "snap benefits usa"], domain: "www.fns.usda.gov/snap", label: "SNAP (Food Stamps)" },
  { keywords: ["vote usa", "voter registration usa"], domain: "vote.gov", label: "Vote.gov" },
  { keywords: ["greyhound bus usa", "greyhound ticket"], domain: "www.greyhound.com", label: "Greyhound Bus (USA)" },
  { keywords: ["amtrak train usa", "amtrak ticket"], domain: "www.amtrak.com", label: "Amtrak (USA Trains)" },
  { keywords: ["flixbus usa", "flixbus booking"], domain: "www.flixbus.com", label: "FlixBus USA" },
  { keywords: ["dmv appointment usa", "driver license usa", "vehicle registration usa"], domain: "www.usa.gov/motor-vehicle-services", label: "USA.gov DMV Guide" },

  // ── UK ────────────────────────────────────────────────────
  { keywords: ["uk passport", "renew passport uk", "hmpo"], domain: "www.gov.uk/apply-renew-passport", label: "HMPO UK Passport" },
  { keywords: ["universal credit uk", "benefits uk", "dwp uk"], domain: "www.gov.uk/universal-credit", label: "Universal Credit (UK)" },
  { keywords: ["self assessment uk", "hmrc tax uk", "uk tax return", "national insurance uk"], domain: "www.gov.uk/self-assessment-tax-returns", label: "HMRC Self Assessment (UK)" },
  { keywords: ["driving licence uk", "dvla uk", "vehicle tax uk"], domain: "www.gov.uk/browse/driving", label: "DVLA / Driving (UK)" },
  { keywords: ["uk visa", "settle in uk", "immigration uk"], domain: "www.gov.uk/browse/visas-immigration", label: "UK Visas & Immigration" },
  { keywords: ["nhs uk", "book gp uk", "nhs appointment uk"], domain: "www.nhs.uk", label: "NHS UK" },
  { keywords: ["national express bus uk", "national express ticket"], domain: "www.nationalexpress.com", label: "National Express UK" },
  { keywords: ["megabus uk", "megabus booking"], domain: "uk.megabus.com", label: "Megabus UK" },
  { keywords: ["trainline uk", "train ticket uk", "book train uk"], domain: "www.thetrainline.com", label: "Trainline UK" },

  // ── Australia ─────────────────────────────────────────────
  { keywords: ["centrelink australia", "mygov australia"], domain: "www.centrelink.gov.au", label: "Centrelink (Australia)" },
  { keywords: ["tax return australia", "ato australia", "australian taxation"], domain: "www.ato.gov.au", label: "Australian Taxation Office" },
  { keywords: ["passport australia", "australian passport"], domain: "www.passports.gov.au", label: "Australian Passports" },
  { keywords: ["visa australia", "immigration australia", "home affairs australia"], domain: "immi.homeaffairs.gov.au", label: "Australian Home Affairs (Visa)" },
  { keywords: ["greyhound australia bus", "australia bus booking"], domain: "www.greyhound.com.au", label: "Greyhound Australia" },

  // ── Canada ────────────────────────────────────────────────
  { keywords: ["cra tax canada", "income tax canada", "tax return canada"], domain: "www.canada.ca/en/revenue-agency.html", label: "CRA (Canada Revenue Agency)" },
  { keywords: ["passport canada", "canadian passport"], domain: "www.canada.ca/en/immigration-refugees-citizenship/services/canadian-passports.html", label: "Passport Canada" },
  { keywords: ["immigration canada", "express entry canada", "ircc canada"], domain: "www.canada.ca/en/immigration-refugees-citizenship.html", label: "IRCC (Canada Immigration)" },
  { keywords: ["flixbus canada", "greyhound canada bus"], domain: "www.flixbus.ca", label: "FlixBus Canada" },

  // ── Singapore ─────────────────────────────────────────────
  { keywords: ["singpass singapore", "singpass login"], domain: "www.singpass.gov.sg", label: "SingPass Singapore" },
  { keywords: ["cpf singapore", "central provident fund singapore"], domain: "www.cpf.gov.sg", label: "CPF Board Singapore" },
  { keywords: ["iras singapore", "income tax singapore"], domain: "www.iras.gov.sg", label: "IRAS (Singapore Tax)" },
  { keywords: ["mom singapore", "work pass singapore"], domain: "www.mom.gov.sg", label: "MOM Singapore" },
  { keywords: ["hdb flat singapore", "hdb portal"], domain: "www.hdb.gov.sg", label: "HDB Singapore" },
];

// ── DDG Fallback Search ───────────────────────────────────────

const DDG_API = "https://api.duckduckgo.com/";

interface DDGResponse {
  AbstractURL?: string;
  Results?: { FirstURL?: string }[];
  RelatedTopics?: { FirstURL?: string }[];
}

/** Heuristics for a plausible official/utility domain from DDG results */
function isPlausibleServiceDomain(url: string): boolean {
  try {
    const h = new URL(url).hostname;
    // Accept any resolvable domain except DDG's own pages
    return !h.includes("duckduckgo.com") && h.includes(".");
  } catch {
    return false;
  }
}

async function searchDDG(query: string): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      q: `${query} official site`,
      format: "json",
      no_html: "1",
      skip_disambig: "1",
      no_redirect: "1",
      t: "guidecursor",
    });
    const res = await fetch(`${DDG_API}?${params}`, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;

    const data = (await res.json()) as DDGResponse;

    // AbstractURL is typically the official website of the entity
    if (data.AbstractURL && isPlausibleServiceDomain(data.AbstractURL)) {
      return new URL(data.AbstractURL).hostname;
    }
    for (const r of data.Results ?? []) {
      if (r.FirstURL && isPlausibleServiceDomain(r.FirstURL)) {
        return new URL(r.FirstURL).hostname;
      }
    }
    return null;
  } catch {
    return null;
  }
}

// ── Helpers ───────────────────────────────────────────────────

function findAllowListMatch(query: string): { domain: string; label: string } | null {
  const q = query.toLowerCase();
  for (const entry of ALLOWLIST) {
    if (entry.keywords.some((kw) => q.includes(kw))) {
      return { domain: entry.domain, label: entry.label };
    }
  }
  return null;
}

// ── Public API ────────────────────────────────────────────────

export async function resolveIntent(taskDescription: string): Promise<DetailedVerificationResult> {
  const q = taskDescription.toLowerCase().trim();

  // Stage 1: Static allowlist
  const match = findAllowListMatch(q);
  if (match) {
    const verified = await verifyDomain(match.domain);
    return { ...verified, trustScore: Math.max(verified.trustScore, 70) };
  }

  // Stage 2: DDG fallback
  const ddgDomain = await searchDDG(q);
  if (ddgDomain) {
    const verified = await verifyDomain(ddgDomain);
    return {
      ...verified,
      warnings: ["Found via web search — not in verified registry. Review carefully.", ...verified.warnings],
    };
  }

  // Nothing found
  return { canonical: "", trustScore: 0, warnings: ["No verified site found. Please navigate manually."], signals: [] };
}
