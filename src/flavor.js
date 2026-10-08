// Five schools. Compound names stay on the vials. Flavor text is the school line.
export const ROW_ORDER = [
  "Emberforge — Metabolic School",
  "Verdant Restoration — Healing & Recovery School",
  "Astral Insight — Cognitive School",
  "Rosefire Enchantment — Libido School",
  "Ironwright Utility — Solvents & Accessories School",
];

const EMBER = "Volcanic alchemy. Ember-charged vitality. The furnace within.";
const VERDANT = "Druidic regeneration. Moss-parchment sigils. The green weave.";
const ASTRAL = "Indigo nebula. Star-rune clarity. Mind-aligned alchemy.";
const ROSE = "Magenta velvet. Candlelit allure. Passion sigils.";
const IRON = "Forged steel. Cool glow. Workshop precision.";

export const FLAVOR = {
  amq: { row: ROW_ORDER[0], note: EMBER, line: "“The Ember-Key Catalyst.” A spark-ignition compound said to quiet the inner soot and let the furnace burn cleaner, hotter, brighter." },
  r3: { row: ROW_ORDER[0], note: EMBER, line: "“The Triple-Flame Conduit.” A rare tri-sigil reagent that channels three ember currents at once." },
  mot: { row: ROW_ORDER[0], note: EMBER, line: "“The Furnace Runner.” A swift ember-sprite peptide carried by the inner flame." },
  nad: { row: ROW_ORDER[0], note: EMBER, line: "“The Eternal Spark.” A foundational ember-essence treasured for sustaining the fire of life." },
  cjc: { row: ROW_ORDER[0], note: EMBER, line: "“The Dual-Spark Ascender.” Two catalysts braided together — one stokes the flame, the other lifts it skyward." },
  bpc: { row: ROW_ORDER[1], note: VERDANT, line: "“The Living Thread.” A regenerative stitch-peptide used to mend the weave of flesh." },
  tb5: { row: ROW_ORDER[1], note: VERDANT, line: "“The Renewal Current.” A swift-moving restoration agent guiding repair with quiet precision." },
  ara: { row: ROW_ORDER[1], note: VERDANT, line: "“The Pain-Eater’s Blessing.” A gentle moss-sigil compound said to calm storms beneath the skin." },
  kpv: { row: ROW_ORDER[1], note: VERDANT, line: "“The Purity Trigram.” A tiny tri-glyph peptide revered for its cleansing aura." },
  ghk: { row: ROW_ORDER[1], note: VERDANT, line: "“The Copperleaf Rejuvenant.” A blue-green sigil bound to copper essence, renewing the living surface." },
  pin: { row: ROW_ORDER[2], note: ASTRAL, line: "“The Memory Lantern.” A soft-glowing astral peptide used to illuminate forgotten pathways." },
  epi: { row: ROW_ORDER[2], note: ASTRAL, line: "“The Time-Thread Weaver.” A rare astral compound believed to harmonize cellular cycles." },
  sel: { row: ROW_ORDER[2], note: ASTRAL, line: "“The Calm Constellation.” A soothing nebula-sigil peptide that quiets mental storms." },
  sem: { row: ROW_ORDER[2], note: ASTRAL, line: "“The Focus Star.” A bright astral agent used to sharpen attention and mental precision." },
  pt: { row: ROW_ORDER[3], note: ROSE, line: "“The Ember of Desire.” A warm rose-gold enchantment peptide said to awaken the inner flame of attraction." },
  bac: { row: ROW_ORDER[4], note: IRON, line: "“The Clear Solvent.” A neutral purification medium used to prepare and stabilize mixtures." },
  kit: { row: ROW_ORDER[4], note: IRON, line: "“The Workshop Arsenal.” Tools and vessels used to mix, measure, and refine craft." },
};
