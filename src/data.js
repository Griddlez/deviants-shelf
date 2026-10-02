export const CONFIG = {
  shopName: "The Deviant's Shelf",
  tagline: "A small apothecary for people who already know where to look.",
  receiptHours: 24,
  pay: {
    note: "No payment is taken in the app. Send the exact order total, then attach the receipt on Active Orders.",
    ownerName: "Brandon Melton",
    venmo: "@B-Melt",
    cashApp: "$Slycinder",
    chime: "$Brandon-Melton-44",
  },
  shipping: [
    { id: "usps", label: "USPS", detail: "3–5 days", price: 12 },
    { id: "fedex2", label: "FedEx 2 Day", detail: "2 Day Air", price: 20 },
    { id: "overnight", label: "FedEx Overnight", detail: "Overnight", price: 60 },
  ],
};

const CODE_BOOK = {
  "F&F30": { kind: "percent", amount: 30, label: "Friends and family" },
  HNDLVR: { kind: "ship", label: "Hand delivery" },
  "4DAKNG": { kind: "percent", amount: 10, label: "Military" },
};

export function quoteOrder(sub, shipId, rawCodes) {
  const prices = Object.fromEntries(CONFIG.shipping.map((row) => [row.id, row.price]));
  const codes = [];
  for (const raw of rawCodes || []) {
    const key = String(raw || "").trim().toUpperCase();
    if (!key || codes.includes(key)) continue;
    if (!CODE_BOOK[key]) return { error: "That code is not on the shelf." };
    if (codes.length >= 2) return { error: "Two codes is the limit." };
    codes.push(key);
  }
  let percent = 0;
  let hand = false;
  const labels = [];
  for (const key of codes) {
    const row = CODE_BOOK[key];
    labels.push(row.label);
    if (row.kind === "percent") percent += row.amount;
    if (row.kind === "ship") hand = true;
  }
  const base = Math.max(0, Number(sub) || 0);
  const discount = Math.round((base * percent) / 100);
  if (!Object.prototype.hasOwnProperty.call(prices, shipId)) return { error: "Pick a shipping speed." };
  const shipPrice = hand ? 0 : prices[shipId];
  return {
    error: "",
    codes,
    labels,
    discount,
    hand,
    shipPrice,
    total: Math.max(0, base - discount + shipPrice),
  };
}

export const PRODUCTS = [
  {
    id: "kit",
    code: "KIT",
    name: "Beginner alchemy kit",
    blurb: "Bac water · 10 syringes · 20 wipes.",
    sizes: [{ sku: "KIT-1", mg: "kit", vial: 15 }],
  },
  {
    id: "r3",
    code: "R3",
    name: "Retatrutide",
    blurb: "Triple agonist research analog.",
    sizes: [
      { sku: "R3-5", mg: "5 mg", vial: 45 },
      { sku: "R3-20", mg: "20 mg", vial: 80, coa: { lab: "Krause Analytical", batch: "212022", tested: "Sep 1, 2026", purity: ">99.9%", file: "/coa/R3-20.pdf" } },
    ],
  },
  {
    id: "amq",
    code: "AMQ",
    name: "5-Amino-1MQ",
    blurb: "NNMT research compound.",
    sizes: [{ sku: "AMQ-50", mg: "50 mg", vial: 50, coa: { lab: "Krause Analytical", batch: "212014", tested: "Sep 1, 2026", purity: "99.9%", file: "/coa/AMQ-50.pdf" } }],
  },
  {
    id: "bpc",
    code: "BPC",
    name: "BPC-157",
    blurb: "Pentadecapeptide research standard.",
    sizes: [
      { sku: "BPC-5", mg: "5 mg", vial: 35 },
      { sku: "BPC-10", mg: "10 mg", vial: 45, coa: { lab: "Krause Analytical", batch: "212028", tested: "Sep 1, 2026", purity: "99.4%", file: "/coa/BPC-10.pdf" } },
    ],
  },
  {
    id: "tb5",
    code: "TB5",
    name: "TB-500",
    blurb: "Thymosin β4 fragment.",
    sizes: [{ sku: "TB5-5", mg: "5 mg", vial: 45 }],
  },
  {
    id: "mot",
    code: "MOT",
    name: "MOTS-c",
    blurb: "Mitochondrial-derived peptide.",
    sizes: [{ sku: "MOT-20", mg: "20 mg", vial: 65 }],
  },
  {
    id: "kpv",
    code: "KPV",
    name: "KPV",
    blurb: "α-MSH fragment.",
    sizes: [{ sku: "KPV-10", mg: "10 mg", vial: 50, coa: { lab: "BTL Testing", batch: "KPV010-012604A", tested: "Apr 28, 2026", purity: "99.8%", file: "/coa/KPV-10.pdf" } }],
  },
  {
    id: "ara",
    code: "ARA",
    name: "ARA-290",
    blurb: "Cibinetide analog.",
    sizes: [{ sku: "ARA-10", mg: "10 mg", vial: 40, coa: { lab: "Krause Analytical", batch: "212008", tested: "Sep 1, 2026", purity: "98.4%", file: "/coa/ARA-10.pdf" } }],
  },
  {
    id: "cjc",
    code: "CJC",
    name: "CJC-1295 + Ipamorelin",
    blurb: "GHRH fragment + ghrelin analog.",
    sizes: [{ sku: "CJC-5-5", mg: "5 mg + 5 mg", vial: 60, coa: { lab: "Krause Analytical", batch: "212026", tested: "Sep 4, 2026", purity: "99.2%", file: "/coa/CJC-5-5.pdf" } }],
  },
  {
    id: "pin",
    code: "PIN",
    name: "Pinealon",
    blurb: "Tripeptide bioregulator.",
    sizes: [{ sku: "PIN-10", mg: "10 mg", vial: 40, coa: { lab: "Krause Analytical", batch: "203757", tested: "Apr 22, 2026", purity: "99.6%", file: "/coa/PIN-10.pdf" } }],
  },
  {
    id: "epi",
    code: "EPI",
    name: "Epithalon",
    blurb: "Pineal tetrapeptide.",
    sizes: [{ sku: "EPI-10", mg: "10 mg", vial: 30 }],
  },
  {
    id: "sel",
    code: "SEL",
    name: "Selank",
    blurb: "Tuftsin analog.",
    sizes: [{ sku: "SEL-5", mg: "5 mg", vial: 35 }],
  },
  {
    id: "sem",
    code: "SEM",
    name: "Semax",
    blurb: "ACTH fragment analog.",
    sizes: [{ sku: "SEM-10", mg: "10 mg", vial: 40, coa: { lab: "BTL Testing", batch: "SMX010-012604A", tested: "Apr 28, 2026", purity: "99.8%", file: "/coa/SEM-10.pdf" } }],
  },
  {
    id: "nad",
    code: "NAD",
    name: "NAD+",
    blurb: "Nicotinamide adenine dinucleotide.",
    sizes: [
      { sku: "NAD-100", mg: "100 mg", vial: 30 },
      { sku: "NAD-500", mg: "500 mg", vial: 45, coa: { lab: "Krause Analytical", batch: "201770", tested: "Mar 9, 2026", purity: "99.89%", file: "/coa/NAD-500.pdf" } },
    ],
  },
  {
    id: "pt",
    code: "PT",
    name: "PT-141",
    blurb: "Bremelanotide analog.",
    sizes: [{ sku: "PT-10", mg: "10 mg", vial: 30, coa: { lab: "BTL Testing", batch: "PT1010-012604A", tested: "Apr 28, 2026", purity: "99.9%", file: "/coa/PT-10.pdf" } }],
  },
  {
    id: "ghk",
    code: "GHK",
    name: "GHK-Cu",
    blurb: "Copper tripeptide.",
    sizes: [{ sku: "GHK-100", mg: "100 mg", vial: 45, coa: { lab: "Krause Analytical", batch: "203764", tested: "Apr 22, 2026", purity: ">99.9%", file: "/coa/GHK-100.pdf" } }],
  },
  {
    id: "bac",
    code: "BAC",
    name: "Bacteriostatic water",
    blurb: "Null Spring — reconstitution water.",
    sizes: [{ sku: "BAC-10", mg: "10 ml", vial: 7 }],
  },
];
