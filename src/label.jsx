import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import * as store from "./store.js";
import { PRODUCTS } from "./data.js";

const W = 472;
const H = 263;

const THEME_BY_ID = {
  r3: "emberforge", amq: "emberforge", mot: "emberforge", nad: "emberforge", cjc: "emberforge",
  bpc: "verdant", tb5: "verdant", ghk: "verdant", kpv: "verdant", ara: "verdant",
  sem: "astral", sel: "astral", pin: "astral", epi: "astral",
  pt: "rosefire",
  bac: "ironwright", kit: "ironwright",
};

const FRAMES = {
  emberforge: { src: "/art/labels/ember.jpg", qr: [0.655, 0.368, 0.889, 0.800] },
  verdant: { src: "/art/labels/verdant.jpg", qr: [0.664, 0.377, 0.880, 0.787] },
  astral: { src: "/art/labels/astral.jpg", qr: [0.675, 0.355, 0.893, 0.768] },
  rosefire: { src: "/art/labels/rose.jpg", qr: [0.636, 0.362, 0.869, 0.789] },
  ironwright: { src: "/art/labels/iron.jpg", qr: [0.60, 0.38, 0.86, 0.76] },
};

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

function fit(ctx, text, font, max) {
  let size = font.size;
  while (size > font.min) {
    ctx.font = font.style.replace("SIZE", String(size));
    if (ctx.measureText(text).width <= max) return size;
    size -= 1;
  }
  ctx.font = font.style.replace("SIZE", String(font.min));
  return font.min;
}

function schoolFor(item) {
  if (!item) return "emberforge";
  const slug = String(item.slug || "").toLowerCase();
  const name = String(item.name || "").toLowerCase();
  for (const product of PRODUCTS) {
    const id = product.id.toLowerCase();
    const code = String(product.code || "").toLowerCase();
    if (slug === id || slug === code || slug.startsWith(`${code}-`) || slug.startsWith(`${id}-`)) {
      return THEME_BY_ID[product.id] || "emberforge";
    }
    const needles = [product.name, product.charge, product.code]
      .map((value) => String(value || "").toLowerCase())
      .filter((value) => value.length > 2);
    if (needles.some((needle) => name.includes(needle))) return THEME_BY_ID[product.id] || "emberforge";
  }
  return "emberforge";
}

async function paint(canvas, { name, purity, batch, size, slug, proof, theme }) {
  const frameSpec = FRAMES[theme] || FRAMES.emberforge;
  const ctx = canvas.getContext("2d");
  canvas.width = W;
  canvas.height = H;
  ctx.clearRect(0, 0, W, H);
  const frame = await loadImage(frameSpec.src);
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

  const [qx0, qy0, qx1, qy1] = frameSpec.qr;
  const url = `HTTPS://THEDEVIANTSSHELF.COM/C/${String(slug || "").toUpperCase()}`;
  const qr = QRCode.create(url, { errorCorrectionLevel: "H" });
  const n = qr.modules.size;
  const boxW = (qx1 - qx0) * W;
  const boxH = (qy1 - qy0) * H;
  const inner = Math.min(boxW, boxH) * 0.84;
  const mod = Math.max(2, Math.floor(inner / n));
  const drawn = n * mod;
  const qrX = qx0 * W + (boxW - drawn) / 2;
  const qrY = qy0 * H + (boxH - drawn) / 2;
  ctx.fillStyle = "#000";
  for (let y = 0; y < n; y += 1) {
    for (let x = 0; x < n; x += 1) {
      if (qr.modules.get(x, y)) ctx.fillRect(qrX + x * mod, qrY + y * mod, mod, mod);
    }
  }

  await document.fonts.load("700 32px Cinzel");
  ctx.fillStyle = "#000";
  ctx.textBaseline = "top";
  ctx.textAlign = "center";
  const left = Math.round(0.12 * W);
  const rightText = Math.round((qx0 - 0.03) * W);
  const top = Math.round(0.43 * H);
  const bottom = Math.round(0.80 * H);
  const column = Math.max(40, rightText - left);
  const mid = (left + rightText) / 2;
  const nameSize = fit(ctx, name || "Product", { size: 20, min: 11, style: "700 SIZEpx Cinzel, serif" }, column);
  const pure = purityLine(purity);
  const batchText = `Batch #${batch || "—"}  •  ${size || "—"} Vial`;
  const subSize = pure
    ? fit(ctx, pure, { size: 12, min: 8, style: "italic SIZEpx 'Times New Roman', serif" }, column - 8)
    : 0;
  const batchSize = fit(ctx, batchText, { size: 13, min: 8, style: "bold SIZEpx 'Times New Roman', serif" }, column);
  const block = nameSize + 6 + (pure ? subSize + 6 : 0) + batchSize;
  const researchTop = bottom - 26;
  let y = top + Math.max(0, (researchTop - 6 - top - block) / 2);

  ctx.font = `700 ${nameSize}px Cinzel, serif`;
  ctx.fillText(name || "Product", mid, y);
  y += nameSize + 6;
  if (pure) {
    ctx.font = `italic ${subSize}px 'Times New Roman', serif`;
    ctx.fillText(pure, mid, y);
    y += subSize + 6;
  }
  ctx.font = `bold ${batchSize}px 'Times New Roman', serif`;
  ctx.fillText(batchText, mid, y);

  ["Research Use Only", "Not for Human Consumption"].forEach((line, i) => {
    const lineSize = fit(ctx, line, { size: 11, min: 8, style: "italic SIZEpx 'Times New Roman', serif" }, column);
    ctx.font = `italic ${lineSize}px 'Times New Roman', serif`;
    ctx.fillText(line, mid, researchTop + i * 13);
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
    const parts = splitSize(item.name);
    setSlug(item.slug);
    setName(parts.name || item.name);
    setSize(parts.size);
    setPurity(item.current?.purity || "");
    setBatch(item.current?.id || "");
    setTested(item.current?.tested || "");
    setTheme(schoolFor(item));
  }

  useEffect(() => {
    const canvas = proofRef.current;
    if (!canvas || !slug) return;
    paint(canvas, { name, purity, batch, size, slug, proof: true, theme }).catch((error) => setErr(error.message));
  }, [name, purity, batch, size, slug, theme]);

  async function download() {
    const canvas = document.createElement("canvas");
    await paint(canvas, { name, purity, batch, size, slug, proof: false, theme });
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `${slug || "label"}-niimbot.png`;
    a.click();
  }

  const current = items.find((item) => item.slug === slug);

  return (
    <section className="wrap">
      <h2>Label Generator</h2>
      <p className="muted">School plate for the Niimbot, 40 × 22 mm at 300 dpi. The rainbow is the tape. The name, batch, and code sit in the open field. Print the downloaded file, not a screenshot of this preview.</p>
      {err && <p className="err">{err}</p>}
      <div className="panel label-desk">
        <label>Product</label>
        <select value={slug} onChange={(e) => apply(items.find((item) => item.slug === e.target.value))}>
          {items.map((item) => (
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
        <label>Purity %</label>
        <input value={purity} onChange={(e) => setPurity(e.target.value)} />
        <label>Batch ID</label>
        <input value={batch} onChange={(e) => setBatch(e.target.value)} />
        <label>Vial size</label>
        <input value={size} onChange={(e) => setSize(e.target.value)} />
        <p className="tiny">Date of analysis · {tested || "—"} · This stays on the COA page the code opens.</p>
        <p className="tiny">{current ? `${window.location.origin}${current.shortUrl}` : "Pick a product that has a short link."}</p>
        {!current?.current && <p className="err">This product has no current certificate yet. Add a batch in the COA Library first.</p>}
        <canvas ref={proofRef} className="label-proof" width={W} height={H} />
        <button className="btn gold" type="button" onClick={download} disabled={!slug || !current?.current}>Download Niimbot PNG</button>
      </div>
    </section>
  );
}
