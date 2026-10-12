// Five schools. Compound names stay on the vials. Flavor text is the school line.
export const ROW_ORDER = [
  "Emberforge",
  "Verdant Restoration",
  "Astral Insight",
  "Rosefire Enchantment",
  "Ironwright Utility",
];

const EMBER = "Volcanic alchemy. Ember-charged vitality. The furnace within.";
const VERDANT = "Druidic regeneration. Moss-parchment sigils. The green weave.";
const ASTRAL = "Indigo nebula. Star-rune clarity. Mind-aligned alchemy.";
const ROSE = "Magenta velvet. Candlelit allure. Passion sigils.";
const IRON = "Forged steel. Cool glow. Workshop precision.";

export const FLAVOR = {
  amq: { row: ROW_ORDER[0], note: EMBER, line: "“The Ember-Key Catalyst.” A spark-ignition compound said to quiet the inner soot and let the furnace burn cleaner, hotter, brighter.", desc: "NNMT research compound. The forge keeps this key for studies of a fire that burns clean instead of choking on its own ash." },
  r3: { row: ROW_ORDER[0], note: EMBER, line: "“The Triple-Flame Conduit.” A rare tri-sigil reagent that channels three ember currents at once.", desc: "Triple agonist research analog. Three currents share one crucible. The shelf studies how they move when they are asked to burn as one." },
  mot: { row: ROW_ORDER[0], note: EMBER, line: "“The Furnace Runner.” A swift ember-sprite peptide carried by the inner flame.", desc: "Mitochondrial-derived peptide. A coal sent running from the hearth into the far rooms of the cell." },
  nad: { row: ROW_ORDER[0], note: EMBER, line: "“The Eternal Spark.” A foundational ember-essence treasured for sustaining the fire of life.", desc: "Nicotinamide adenine dinucleotide. The coal that is not allowed to go out. Every lasting fire on this shelf starts here." },
  cjc: { row: ROW_ORDER[0], note: EMBER, line: "“The Dual-Spark Ascender.” Two catalysts braided together — one stokes the flame, the other lifts it skyward.", desc: "GHRH fragment plus ghrelin analog. A paired draught from the same forge: one spark feeds the flame, the other asks it to climb." },
  bpc: { row: ROW_ORDER[1], note: VERDANT, line: "“The Living Thread.” A regenerative stitch-peptide used to mend the weave of flesh.", desc: "Pentadecapeptide research standard. Green thread for places where the weave of flesh has pulled apart." },
  tb5: { row: ROW_ORDER[1], note: VERDANT, line: "“The Renewal Current.” A swift-moving restoration agent guiding repair with quiet precision.", desc: "Thymosin β4 fragment. A slow river under the moss, studied where repair has to travel without tearing what is already whole." },
  ara: { row: ROW_ORDER[1], note: VERDANT, line: "“The Pain-Eater’s Blessing.” A gentle moss-sigil compound said to calm storms beneath the skin.", desc: "Cibinetide analog. Moss laid over an old storm. Kept for work on pain that has settled under the surface and will not leave." },
  kpv: { row: ROW_ORDER[1], note: VERDANT, line: "“The Purity Trigram.” A tiny tri-glyph peptide revered for its cleansing aura.", desc: "α-MSH fragment. Three small marks, used where the body has been asked to clear what it has been holding." },
  ghk: { row: ROW_ORDER[1], note: VERDANT, line: "“The Copperleaf Rejuvenant.” A blue-green sigil bound to copper essence, renewing the living surface.", desc: "Copper tripeptide. Dew gathered on a copper leaf, studied where the living surface is ready to be made new." },
  pin: { row: ROW_ORDER[2], note: ASTRAL, line: "“The Memory Lantern.” A soft-glowing astral peptide used to illuminate forgotten pathways.", desc: "Tripeptide bioregulator. A small lantern for corridors the mind has stopped walking. Kept for studies of recall." },
  epi: { row: ROW_ORDER[2], note: ASTRAL, line: "“The Time-Thread Weaver.” A rare astral compound believed to harmonize cellular cycles.", desc: "Pineal tetrapeptide. Night thread on a silver loom. Studied where a cell is trying to remember its own clock." },
  sel: { row: ROW_ORDER[2], note: ASTRAL, line: "“The Calm Constellation.” A soothing nebula-sigil peptide that quiets mental storms.", desc: "Tuftsin analog. A still sky after weather. Used where thought will not settle on its own." },
  sem: { row: ROW_ORDER[2], note: ASTRAL, line: "“The Focus Star.” A bright astral agent used to sharpen attention and mental precision.", desc: "ACTH fragment analog. The first star before dawn. Kept for studies of a clear line of sight." },
  pt: { row: ROW_ORDER[3], note: ROSE, line: "“The Ember of Desire.” A warm rose-gold enchantment peptide said to awaken the inner flame of attraction.", desc: "Bremelanotide analog. A candle left burning in a closed room. Studied where attraction is the question on the table." },
  bac: { row: ROW_ORDER[4], note: IRON, line: "“The Clear Solvent.” A neutral purification medium used to prepare and stabilize mixtures.", desc: "Reconstitution water. The blank page of the workshop. It carries nothing of its own, so the mixture can." },
  kit: { row: ROW_ORDER[4], note: IRON, line: "“The Workshop Arsenal.” Tools and vessels used to mix, measure, and refine craft.", desc: "Bacteriostatic water, ten syringes, and twenty wipes. The initiate’s bench: measure, mix, and keep the work clean." },
};
