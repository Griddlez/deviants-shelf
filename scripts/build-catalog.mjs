import { mkdir, readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

const W = 1240;
const H = 1754;
const outDir = "/tmp/catalog-new";

const schools = [
  {
    file: "01-Emberforge",
    name: "Emberforge",
    mood: "Volcanic alchemy. Ember-charged vitality. The furnace within.",
    bg: "#140c09",
    band: "#3a160c",
    ink: "#f6e2cc",
    mute: "#c9a88a",
    line: "#e0893a",
    gold: "#e2b56a",
    items: [
      ["Ember's Fast", "Retatrutide", "The Triple-Flame Conduit.", [["5 mg", "$45"], ["20 mg", "$80", "COA"]]],
      ["Dante's Key", "5-Amino-1MQ", "The Ember-Key Catalyst.", [["50 mg", "$50", "COA"]]],
      ["Furnace Runner", "MOTS-c", "A swift ember-sprite carried by the inner flame.", [["20 mg", "$65"]]],
      ["Eternal Spark", "NAD+", "A foundational ember-essence for the fire of life.", [["100 mg", "$30"], ["500 mg", "$45", "COA"]]],
      ["Knight's Draft", "CJC-1295 + Ipamorelin", "The Dual-Spark Ascender.", [["5 mg + 5 mg", "$60", "COA"]]],
    ],
  },
  {
    file: "02-Verdant-Restoration",
    name: "Verdant Restoration",
    mood: "Druidic regeneration. Moss-parchment sigils. The green weave.",
    bg: "#0c1410",
    band: "#143028",
    ink: "#e7f3ea",
    mute: "#a9cbb8",
    line: "#3dba8a",
    gold: "#d5e7c4",
    items: [
      ["Mender's Thread", "BPC-157", "The Living Thread.", [["5 mg", "$35"], ["10 mg", "$45", "COA"]]],
      ["Brook's Renewal", "TB-500", "The Renewal Current.", [["5 mg", "$45"]]],
      ["Pain-Eater's Blessing", "ARA-290", "A moss-sigil for storms beneath the skin.", [["10 mg", "$40", "COA"]]],
      ["Norn's Salve", "KPV", "The Purity Trigram.", [["10 mg", "$50", "COA"]]],
      ["Copperleaf Dew", "GHK-Cu", "The Copperleaf Rejuvenant.", [["100 mg", "$45", "COA"]]],
    ],
  },
  {
    file: "03-Astral-Insight",
    name: "Astral Insight",
    mood: "Indigo nebula. Star-rune clarity. Mind-aligned alchemy.",
    bg: "#100c18",
    band: "#221838",
    ink: "#f1eaff",
    mute: "#b7a6d6",
    line: "#8d6bff",
    gold: "#d7c6ff",
    items: [
      ["Dreamcurrent", "Pinealon", "The Memory Lantern.", [["10 mg", "$40", "COA"]]],
      ["Twilight Weave", "Epithalon", "The Time-Thread Weaver.", [["10 mg", "$30"]]],
      ["Serenity Bell", "Selank", "The Calm Constellation.", [["5 mg", "$35"]]],
      ["Dawn Sight", "Semax", "The Focus Star.", [["5 mg", "$40", "COA"]]],
    ],
  },
  {
    file: "04-Rosefire-Enchantment",
    name: "Rosefire Enchantment",
    mood: "Magenta velvet. Candlelit allure. Passion sigils.",
    bg: "#160c10",
    band: "#3a1824",
    ink: "#ffe8f0",
    mute: "#e0b0c2",
    line: "#e07aa8",
    gold: "#f0c9a0",
    items: [
      ["Ember's Kiss", "PT-141", "The Ember of Desire.", [["10 mg", "$30", "COA"]]],
    ],
  },
  {
    file: "05-Ironwright-Utility",
    name: "Ironwright Utility",
    mood: "Forged steel. Cool glow. Workshop precision.",
    bg: "#101214",
    band: "#1c2228",
    ink: "#e7eef2",
    mute: "#aeb8c0",
    line: "#8aa0b0",
    gold: "#d5dbe0",
    items: [
      ["Clear Vessel", "Bacteriostatic water", "The Clear Solvent.", [["10 ml", "$7"]]],
      ["Beginner's Alchemy Kit", "Water, 10 syringes, 20 wipes", "The Workshop Arsenal.", [["kit", "$15"]]],
    ],
  },
];

function esc(value) {
  return String(value).replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">");
}

function frame(bg, gold) {
  return `
    <rect width="${W}" height="${H}" fill="${bg}"/>
    <rect x="36" y="36" width="${W - 72}" height="${H - 72}" fill="none" stroke="${gold}" stroke-width="2" opacity="0.85"/>
    <rect x="48" y="48" width="${W - 96}" height="${H - 96}" fill="none" stroke="${gold}" stroke-width="1" opacity="0.35"/>
  `;
}

function footer(gold, mute) {
  return `
    <text x="620" y="1668" text-anchor="middle" fill="${mute}" font-family="Liberation Serif" font-size="22">Research use only. Not for human use. 21+.</text>
    <text x="620" y="1704" text-anchor="middle" fill="${gold}" font-family="Liberation Serif" font-size="22">thedeviantsshelf.com</text>
  `;
}

function cover() {
  const cards = [
    ["Emberforge", "Volcanic alchemy. The furnace within.", "#e0893a"],
    ["Verdant Restoration", "Druidic regeneration. The green weave.", "#3dba8a"],
    ["Astral Insight", "Star-rune clarity. Mind-aligned alchemy.", "#8d6bff"],
    ["Rosefire Enchantment", "Candlelit allure. Passion sigils.", "#e07aa8"],
    ["Ironwright Utility", "Forged steel. Workshop precision.", "#9eb0be"],
  ];
  const cardSvg = cards.map(([name, line, color], i) => {
    const y = 430 + i * 118;
    return `
      <rect x="110" y="${y}" width="1020" height="100" rx="8" fill="#1a140f" stroke="${color}" stroke-width="2"/>
      <rect x="110" y="${y}" width="10" height="100" fill="${color}"/>
      <text x="150" y="${y + 42}" fill="#f6e7d2" font-family="Liberation Serif" font-size="36">${esc(name)}</text>
      <text x="150" y="${y + 76}" fill="#c9b39a" font-family="Liberation Serif" font-size="24">${esc(line)}</text>
    `;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${frame("#120e0b", "#e2b56a")}
  <text x="620" y="130" text-anchor="middle" fill="#e2b56a" font-family="Liberation Serif" font-size="22" letter-spacing="6">RESEARCH CATALOG</text>
  <text x="620" y="230" text-anchor="middle" fill="#f8efe4" font-family="Liberation Serif" font-size="68">The Deviant's Shelf</text>
  <text x="620" y="290" text-anchor="middle" fill="#d9c2a4" font-family="Liberation Serif" font-size="28">A vault of crafted elixirs for seasoned alchemists.</text>
  <text x="620" y="360" text-anchor="middle" fill="#e2b56a" font-family="Liberation Serif" font-size="24">Five schools. Every vial named, sized, and priced.</text>
  ${cardSvg}
  <text x="620" y="1080" text-anchor="middle" fill="#e2b56a" font-family="Liberation Serif" font-size="28">Shipping from the US</text>
  <text x="250" y="1140" fill="#f6e7d2" font-family="Liberation Serif" font-size="26">USPS</text>
  <text x="560" y="1140" fill="#f6e7d2" font-family="Liberation Serif" font-size="26">$9.99</text>
  <text x="700" y="1140" fill="#f6e7d2" font-family="Liberation Serif" font-size="26">UPS Ground</text>
  <text x="990" y="1140" fill="#f6e7d2" font-family="Liberation Serif" font-size="26">$14.99</text>
  <text x="250" y="1190" fill="#f6e7d2" font-family="Liberation Serif" font-size="26">UPS 2nd Day Air</text>
  <text x="560" y="1190" fill="#f6e7d2" font-family="Liberation Serif" font-size="26">$19.99</text>
  <text x="700" y="1190" fill="#f6e7d2" font-family="Liberation Serif" font-size="26">UPS Next Day Air</text>
  <text x="990" y="1190" fill="#f6e7d2" font-family="Liberation Serif" font-size="26">$59.99</text>
  <text x="620" y="1260" text-anchor="middle" fill="#c9b39a" font-family="Liberation Serif" font-size="22">Next Day Air must be purchased by 2pm Eastern. Hand delivery is by code.</text>
  <text x="160" y="1360" fill="#e2b56a" font-family="Liberation Serif" font-size="28">Before you order</text>
  <text x="160" y="1416" fill="#f6e7d2" font-family="Liberation Serif" font-size="24">Place the order on the shelf. Payment is sent off the shelf.</text>
  <text x="160" y="1456" fill="#f6e7d2" font-family="Liberation Serif" font-size="24">Attach the receipt to the ticket. A marked row has a COA on file.</text>
  <text x="160" y="1496" fill="#f6e7d2" font-family="Liberation Serif" font-size="24">Prices can change. The shelf page is the price that is charged.</text>
  <text x="160" y="1560" fill="#c9b39a" font-family="Liberation Serif" font-size="24">Research use only. Not for human consumption. No medical advice. 21+.</text>
  <text x="620" y="1660" text-anchor="middle" fill="#e2b56a" font-family="Liberation Serif" font-size="26">thedeviantsshelf.com</text>
</svg>`;
}

function schoolPage(school) {
  let y = 250;
  const blocks = school.items.map(([relic, compound, epithet, sizes]) => {
    const height = 118 + sizes.length * 52;
    const top = y;
    const sizeRows = sizes.map(([size, price, coa], index) => {
      const rowY = top + 118 + index * 52;
      return `
        <text x="150" y="${rowY}" fill="${school.mute}" font-family="Liberation Serif" font-size="28">${esc(size)}</text>
        <text x="900" y="${rowY}" text-anchor="end" fill="${school.ink}" font-family="Liberation Serif" font-size="32">${esc(price)}</text>
        ${coa ? `<text x="940" y="${rowY}" fill="${school.gold}" font-family="Liberation Serif" font-size="22">${esc(coa)}</text>` : ""}
      `;
    }).join("");
    y += height + 36;
    return `
      <text x="120" y="${top + 36}" fill="${school.ink}" font-family="Liberation Serif" font-size="40">${esc(relic)}</text>
      <text x="1100" y="${top + 36}" text-anchor="end" fill="${school.mute}" font-family="Liberation Serif" font-size="26">${esc(compound)}</text>
      <text x="120" y="${top + 74}" fill="${school.gold}" font-family="Liberation Serif" font-size="24" font-style="italic">${esc(epithet)}</text>
      <line x1="120" y1="${top + 90}" x2="1120" y2="${top + 90}" stroke="${school.line}" stroke-width="1" opacity="0.7"/>
      ${sizeRows}
    `;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${frame(school.bg, school.gold)}
  <rect x="72" y="78" width="1096" height="120" fill="${school.band}"/>
  <text x="110" y="132" fill="${school.ink}" font-family="Liberation Serif" font-size="48">${esc(school.name)}</text>
  <text x="110" y="174" fill="${school.gold}" font-family="Liberation Serif" font-size="24">${esc(school.mood)}</text>
  ${blocks}
  <text x="120" y="1588" fill="${school.mute}" font-family="Liberation Serif" font-size="22">COA means a certificate is on the shelf for that size. Prices are per vial.</text>
  ${footer(school.gold, school.mute)}
</svg>`;
}

await mkdir(outDir, { recursive: true });
const pages = [["00-Cover", cover()], ...schools.map((school) => [school.file, schoolPage(school)])];
const pngs = [];
for (const [name, svg] of pages) {
  const svgPath = `${outDir}/${name}.svg`;
  const pngPath = `${outDir}/${name}.jpg`;
  await writeFile(svgPath, svg);
  await sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toFile(pngPath);
  pngs.push(pngPath);
  console.log(pngPath);
}
console.log("pages", pngs.length);
