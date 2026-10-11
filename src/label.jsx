import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import * as store from "./store.js";
import { PRODUCTS } from "./data.js";

const W = 472;
const H = 236;

const THEME_BY_ID = {
  r3: "emberforge", amq: "emberforge", mot: "emberforge", nad: "emberforge", cjc: "emberforge",
  bpc: "verdant", tb5: "verdant", ghk: "verdant", kpv: "verdant", ara: "verdant",
  sem: "astral", sel: "astral", pin: "astral", epi: "astral",
  pt: "rosefire",
  bac: "ironwright", kit: "ironwright",
};

const FRAMES = {
  emberforge: { src: "/art/labels/ember.jpg", qr: [0.655, 0.368, 0.889, 0.800] },
  verdant: { src: "/art/labels/verdant.jpg", qr: [0.656, 0.368, 0.894, 0.800] },
  astral: { src: "/art/labels/astral.jpg", qr: [0.675, 0.355, 0.893, 0.768] },
  rosefire: { src: "/art/labels/rose.jpg", qr: [0.636, 0.362, 0.869, 0.789] },
  ironwright: { src: "/art/labels/iron.jpg", qr: [0.60, 0.38, 0.86, 0.76] },
};

const PLAIN = new Set(["bac", "kit"]);

const SCHOOLS = [
  ["emberforge", "Emberforge"],
  ["verdant", "Verdant Restoration"],
  ["astral", "Astral Insight"],
  ["rosefire", "Rosefire Enchantment"],
  ["ironwright", "Ironwright Utility"],
];

function splitSize(name) {
  const match = String(name || "").match(/(\d+(?:\.\d+)?\s*(?:mg|ml|mcg|iu|kit))\s*$/i);
  if (!match) return { name: String(name || "").trim(), size: "" };
  return {
    name: String(name || "").slice(0, match.index).trim(),
    size: match[1].replace(/\s+/g, " "),
  };
}

function purityLine(purity) {
  const raw = String(purity || "").trim();
  if (!raw) return "";
  const shown = /%/.test(raw) ? raw : `${raw}%`;
  return `${shown} Purity (HPLC Verified)`;
}

function productFor(item) {
  if (!item) return null;
  if (item.productId && THEME_BY_ID[item.productId]) {
    return PRODUCTS.find((product) => product.id === item.productId) || null;
  }
  const slug = String(item.slug || "").toLowerCase();
  const name = String(item.name || "").toLowerCase();
  for (const product of PRODUCTS) {
    const id = product.id.toLowerCase();
    const code = String(product.code || "").toLowerCase();
    if (slug === id || slug === code || slug.startsWith(`${code}-`) || slug.startsWith(`${id}-`)) return product;
    const needles = [product.name, product.charge, product.code]
      .map((value) => String(value || "").toLowerCase())
      .filter((value) => value.length > 2);
    if (needles.some((needle) => name.includes(needle))) return product;
  }
  return null;
}

function schoolFor(item) {
  const product = productFor(item);
  return (product && THEME_BY_ID[product.id]) || "emberforge";
}

async function paint(canvas, { name, flavor, purity, batch, size, slug, path, proof, theme, plain }) {
  const frameSpec = FRAMES[theme] || FRAMES.emberforge;
  const ctx = canvas.getContext("2d");
  canvas.width = W;
  canvas.height = H;
  ctx.clearRect(0, 0, W, H);
  const frame = await loadImage(frameSpec.src);
  const dx = 0;
  const dy = 0;
  const dw = W;
  const dh = H;
  if (proof) {
    const silver = await loadImage("/art/label-silver.jpg");
    ctx.drawImage(silver, 0, 0, W, H);
    ctx.globalCompositeOperation = "multiply";
    ctx.drawImage(frame, 0, 0, W, H);
    ctx.globalCompositeOperation = "source-over";
  } else {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(frame, 0, 0, W, H);
  }

  const [fx0, fy0, fx1, fy1] = frameSpec.qr;
  const qx0 = dx + fx0 * dw;
  const qy0 = dy + fy0 * dh;
  const qx1 = dx + fx1 * dw;
  const qy1 = dy + fy1 * dh;
  if (!plain) {
    const url = `https://thedeviantsshelf.com${path.startsWith("/") ? path : `/c/${path}`}`;
    const qr = QRCode.create(url, { errorCorrectionLevel: "H" });
    const n = qr.modules.size;
    const pad = 3;
    const side = Math.min(qx1 - qx0, qy1 - qy0) - pad * 2;
    const mod = side / n;
    const qrX = qx0 + (qx1 - qx0 - side) / 2;
    const qrY = qy0 + (qy1 - qy0 - side) / 2;
    ctx.fillStyle = "#000";
    for (let y = 0; y < n; y += 1) {
      for (let x = 0; x < n; x += 1) {
        if (qr.modules.get(x, y)) {
          ctx.fillRect(Math.round(qrX + x * mod), Math.round(qrY + y * mod), Math.ceil(mod), Math.ceil(mod));
        }
      }
    }
  }

  await document.fonts.load("700 32px Cinzel");
  ctx.fillStyle = "#000";
  ctx.textBaseline = "top";
  ctx.textAlign = "center";
  const left = Math.round(dx + (plain ? 0.14 : 0.11) * dw);
  const rightText = plain ? Math.round(dx + 0.86 * dw) : Math.round(qx0 - 8);
  const top = Math.round(dy + 0.40 * dh);
  const bottom = Math.round(Math.min(H - 6, dy + 0.82 * dh));
  const column = Math.max(40, rightText - left);
  const mid = (left + rightText) / 2;
  const maxH = Math.max(40, bottom - top);
  const pure = plain ? "" : purityLine(purity);
  const sizeText = size === "kit" ? "Kit" : (size || "");
  const batchText = `Batch #${batch || "—"}  •  ${sizeText || "—"} Vial`;
  const lines = [
    flavor ? { text: flavor, style: "700 SIZEpx Cinzel, serif", scale: 0.78, gap: 2 } : null,
    { text: name || "Product", style: "700 SIZEpx Cinzel, serif", scale: 1, gap: 5 },
    !plain && pure ? { text: pure, style: "italic SIZEpx 'Times New Roman', serif", scale: 0.58, gap: 4 } : null,
    plain
      ? (sizeText ? { text: sizeText, style: "bold SIZEpx 'Times New Roman', serif", scale: 0.62, gap: 8 } : null)
      : { text: batchText, style: "bold SIZEpx 'Times New Roman', serif", scale: 0.58, gap: 8 },
    { text: "Research Use Only", style: "italic SIZEpx 'Times New Roman', serif", scale: 0.48, gap: 2 },
    { text: "Not for Human Consumption", style: "italic SIZEpx 'Times New Roman', serif", scale: 0.48, gap: 0 },
  ].filter(Boolean);
  let base = 34;
  let sizes = lines.map((line) => Math.max(8, Math.round(base * line.scale)));
  while (base > 8) {
    sizes = lines.map((line) => Math.max(8, Math.round(base * line.scale)));
    let h = 0;
    let wide = false;
    lines.forEach((line, i) => {
      ctx.font = line.style.replace("SIZE", String(sizes[i]));
      if (ctx.measureText(line.text).width > column) wide = true;
      h += sizes[i] + line.gap;
    });
    if (!wide && h <= maxH) break;
    base -= 1;
  }
  let block = 0;
  lines.forEach((line, i) => { block += sizes[i] + line.gap; });
  let y = top + Math.max(0, (maxH - block) / 2);
  lines.forEach((line, i) => {
    ctx.font = line.style.replace("SIZE", String(sizes[i]));
    ctx.fillText(line.text, mid, y);
    y += sizes[i] + line.gap;
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("The label frame could not be loaded."));
    img.src = src;
  });
}

export function LabelMaker({ session, presetSlug }) {
  const proofRef = useRef(null);
  const [items, setItems] = useState([]);
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [purity, setPurity] = useState("");
  const [batch, setBatch] = useState("");
  const [size, setSize] = useState("");
  const [tested, setTested] = useState("");
  const [theme, setTheme] = useState("emberforge");
  const [productId, setProductId] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    let stop = false;
    store.coaList(session.deskPin).then((rows) => {
      if (stop) return;
      setItems(rows);
      const pick = rows.find((row) => row.slug === presetSlug) || rows[0];
      if (pick) apply(pick);
    }).catch((error) => setErr(error.message));
    return () => { stop = true; };
  }, [session, presetSlug]);

  function apply(item) {
    const product = productFor(item);
    const parts = splitSize(item.name);
    setSlug(item.slug);
    setName(parts.name || item.name);
    setSize(parts.size || product?.sizes?.[0]?.mg || "");
    setPurity(item.current?.purity || "");
    setBatch(item.current?.id || "");
    setTested(item.current?.tested || "");
    setProductId(product?.id || item.productId || "");
    setTheme(schoolFor(item));
  }

  useEffect(() => {
    const canvas = proofRef.current;
    if (!canvas || !slug) return;
    const row = items.find((item) => item.slug === slug);
    const path = row?.shortUrl || `/c/${slug}`;
    const flavor = productId === "r3" ? "Ember's Fast" : "";
    paint(canvas, { name, flavor, purity, batch, size, slug, path, proof: true, theme, plain: PLAIN.has(productId) }).catch((error) => setErr(error.message));
  }, [name, purity, batch, size, slug, theme, productId, items]);

  async function download() {
    const canvas = document.createElement("canvas");
    const path = current?.shortUrl || `/c/${slug}`;
    const flavor = productId === "r3" ? "Ember's Fast" : "";
    await paint(canvas, { name, flavor, purity, batch, size, slug, path, proof: false, theme, plain: PLAIN.has(productId) });
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `${slug || "label"}-niimbot.png`;
    a.click();
  }

  const current = items.find((item) => item.slug === slug);
  const plain = PLAIN.has(productId);
  const options = [
    ...items,
    ...PRODUCTS
      .filter((product) => !items.some((item) => productFor(item)?.id === product.id))
      .map((product) => ({ slug: product.id, name: product.charge || product.name, productId: product.id })),
  ];

  return (
    <section className="wrap">
      <h2>Label Generator</h2>
      <p className="muted">40×20 mm plate for the Niimbot, 300 dpi. The rainbow is the tape. Print the downloaded file, not a screenshot of this preview.</p>
      {err && <p className="err">{err}</p>}
      <div className="panel label-desk">
        <label>Product</label>
        <select value={slug} onChange={(e) => apply(options.find((item) => item.slug === e.target.value))}>
          {options.map((item) => (
            <option key={item.slug} value={item.slug}>{item.name}</option>
          ))}
        </select>
        <label>School</label>
        <select value={theme} onChange={(e) => setTheme(e.target.value)}>
          {SCHOOLS.map(([id, label]) => (
            <option key={id} value={id}>{label}</option>
          ))}
        </select>
        <label>Product name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} />
        {!plain && (
          <>
            <label>Purity %</label>
            <input value={purity} onChange={(e) => setPurity(e.target.value)} />
            <label>Batch ID</label>
            <input value={batch} onChange={(e) => setBatch(e.target.value)} />
          </>
        )}
        <label>Vial size</label>
        <input value={size} onChange={(e) => setSize(e.target.value)} />
        {!plain && <p className="tiny">Date of analysis · {tested || "—"} · This stays on the COA page the code opens.</p>}
        {!plain && <p className="tiny">{current ? `${window.location.origin}${current.shortUrl}` : "Pick a product that has a short link."}</p>}
        {!plain && current && !current.current && <p className="err">This product has no current certificate yet. Add a batch in the COA Library first.</p>}
        <canvas ref={proofRef} className="label-proof" width={W} height={H} />
        <button className="btn gold" type="button" onClick={download} disabled={!slug || (!plain && !current?.current)}>Download Niimbot PNG</button>
      </div>
    </section>
  );
}
