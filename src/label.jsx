import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import * as store from "./store.js";

const W = 591;
const H = 236;
const MM = 300 / 25.4;

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

async function paint(canvas, { name, purity, batch, size, slug, proof }) {
  const ctx = canvas.getContext("2d");
  canvas.width = W;
  canvas.height = H;
  ctx.fillStyle = proof ? "#d9d9dc" : "#ffffff";
  ctx.fillRect(0, 0, W, H);
  if (proof) {
    const silver = await loadImage("/art/label-silver.jpg");
    ctx.drawImage(silver, 0, 0, W, H);
  }
  const frame = await loadImage("/art/label-frame.png");
  ctx.drawImage(frame, 0, 0, W, H);

  const url = `HTTPS://THEDEVIANTSSHELF.COM/C/${String(slug || "").toUpperCase()}`;
  const qr = QRCode.create(url, { errorCorrectionLevel: "H" });
  const n = qr.modules.size;
  const mod = 3;
  const quiet = Math.round(MM);
  const gap = Math.round(2 * MM);
  const matrix = n * mod;
  const box = matrix + quiet * 2;
  const qrX = W - Math.round(2.4 * MM) - box;
  const qrY = 78;
  ctx.fillStyle = proof ? "#e8e8eb" : "#ffffff";
  ctx.fillRect(qrX, qrY, box, box);
  ctx.fillStyle = "#000";
  for (let y = 0; y < n; y += 1) {
    for (let x = 0; x < n; x += 1) {
      if (qr.modules.get(x, y)) {
        ctx.fillRect(qrX + quiet + x * mod, qrY + quiet + y * mod, mod + 1, mod + 1);
      }
    }
  }

  await document.fonts.load("700 32px Cinzel");
  ctx.fillStyle = "#000";
  ctx.textBaseline = "top";
  const left = 22;
  const rightText = qrX - gap;
  const column = rightText - left;

  const nameSize = fit(ctx, name || "Product", { size: 30, min: 16, style: "700 SIZEpx Cinzel, serif" }, column);
  ctx.font = `700 ${nameSize}px Cinzel, serif`;
  ctx.textAlign = "center";
  ctx.fillText(name || "Product", (left + rightText) / 2, qrY + 2);

  const pure = purityLine(purity);
  if (pure) {
    const subSize = fit(ctx, pure, { size: 15, min: 10, style: "italic SIZEpx 'Times New Roman', serif" }, column - 36);
    ctx.font = `italic ${subSize}px 'Times New Roman', serif`;
    const y = qrY + 42;
    ctx.fillText(pure, (left + rightText) / 2, y);
    const tw = ctx.measureText(pure).width;
    const mid = (left + rightText) / 2;
    ctx.fillRect(left, y + subSize / 2, Math.max(8, mid - tw / 2 - left - 8), 1);
    ctx.fillRect(mid + tw / 2 + 8, y + subSize / 2, Math.max(8, rightText - (mid + tw / 2 + 8)), 1);
  }

  const batchText = `Batch #${batch || "—"}  •  ${size || "—"} Vial`;
  const batchSize = fit(ctx, batchText, { size: 16, min: 11, style: "bold SIZEpx 'Times New Roman', serif" }, column);
  ctx.font = `bold ${batchSize}px 'Times New Roman', serif`;
  ctx.textAlign = "right";
  ctx.fillText(batchText, rightText, qrY + box / 2 - 6);

  const fine = "Research Use Only  •  Not for Human Consumption";
  ctx.font = "italic 12px 'Times New Roman', serif";
  ctx.textAlign = "center";
  const dsLeft = Math.round(W * 0.72);
  ctx.fillText(fine, (18 + dsLeft) / 2, H - 38);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("The label frame could not be loaded."));
    img.src = src;
  });
}

export function LabelMaker({ session }) {
  const proofRef = useRef(null);
  const [items, setItems] = useState([]);
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [purity, setPurity] = useState("");
  const [batch, setBatch] = useState("");
  const [size, setSize] = useState("");
  const [tested, setTested] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    store.coaList(session.deskPin).then((rows) => {
      setItems(rows);
      if (rows[0]) apply(rows[0]);
    }).catch((error) => setErr(error.message));
  }, [session]);

  function apply(item) {
    const parts = splitSize(item.name);
    setSlug(item.slug);
    setName(parts.name || item.name);
    setSize(parts.size);
    setPurity(item.current?.purity || "");
    setBatch(item.current?.id || "");
    setTested(item.current?.tested || "");
  }

  useEffect(() => {
    const canvas = proofRef.current;
    if (!canvas || !slug) return;
    paint(canvas, { name, purity, batch, size, slug, proof: true }).catch((error) => setErr(error.message));
  }, [name, purity, batch, size, slug]);

  async function download() {
    const canvas = document.createElement("canvas");
    await paint(canvas, { name, purity, batch, size, slug, proof: false });
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `${slug || "label"}-niimbot.png`;
    a.click();
  }

  const current = items.find((item) => item.slug === slug);

  return (
    <section className="wrap">
      <h2>Label Generator</h2>
      <p className="muted">50×20 mm black plate for Niimbot M2 silver holographic tape, 300 dpi. The rainbow is the tape. Print the downloaded file, not a screenshot of this preview.</p>
      {err && <p className="err">{err}</p>}
      <div className="panel label-desk">
        <label>Product</label>
        <select value={slug} onChange={(e) => apply(items.find((item) => item.slug === e.target.value))}>
          {items.map((item) => (
            <option key={item.slug} value={item.slug}>{item.name}</option>
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
