import { useState } from "react";
import { PRODUCTS } from "./data.js";
import { FLAVOR, ROW_ORDER } from "./flavor.js";

/* Drop a photo later by adding a line here, for example:
   r3: "/art/vials/r3.jpg",
   "r3-bottle": "/art/vials/r3-bottle.jpg",
   The file itself goes in public/art/vials/. */
export const VIAL_PHOTOS = {};

const TONE = {
  r3: "ember",
  amq: "ember",
  pt: "flame",
  bac: "spring",
  mot: "lantern",
  nad: "lantern",
  sem: "mind",
  sel: "mind",
  pin: "mind",
  cjc: "mind",
  bpc: "mend",
  tb5: "mend",
  ghk: "mend",
  kpv: "mend",
  ara: "mend",
  epi: "mend",
  kit: "bench",
};

const FEATURED = ["r3", "bpc", "cjc", "tb5", "pt", "bac"];

function money(n) {
  return `$${n}`;
}

function enrich(product) {
  const flavor = FLAVOR[product.id] || { row: "The shelf", note: "", line: product.blurb };
  return { ...product, row: flavor.row, note: flavor.note, line: flavor.line || product.blurb, tone: TONE[product.id] || "ember" };
}

function lotFor(product, library) {
  for (const size of product.sizes) {
    const live = library[size.sku];
    if (live?.current) {
      return { id: live.current.id, purity: live.current.purity, tested: live.current.tested, href: live.current.href, page: live.shortUrl, slug: live.slug };
    }
    if (size.coa?.batch) {
      return { id: size.coa.batch, purity: size.coa.purity, tested: size.coa.tested, href: size.coa.file, page: "", slug: "" };
    }
  }
  return null;
}

function inStock(stock, sku) {
  return !(typeof stock?.[sku] === "number" && stock[sku] < 1);
}

export function Vial({ id, tone, photo }) {
  const src = photo || VIAL_PHOTOS[id];
  if (src) return <img className="vial-photo" src={src} alt="" />;
  return (
    <div className={`vial tone-${tone}`} aria-hidden="true">
      <span className="vial-cap" />
      <span className="vial-neck" />
      <span className="vial-glass"><span className="vial-liquid" /></span>
    </div>
  );
}

function titleSize(title) {
  const n = title.length;
  if (n > 22) return "4.8cqw";
  if (n > 16) return "5.6cqw";
  if (n > 13) return "6.5cqw";
  return "7.62cqw";
}

function purityLine(lot) {
  if (!lot?.purity) return "";
  return `${String(lot.purity).replace(/\s*purity\s*/i, "")} Purity (HPLC Verified)`;
}

/* The shield is the real ornament cut from the card, not a redrawn icon. */
export function CoaBadge({ show }) {
  if (!show) return null;
  return <img className="coa-shield" src="/art/card/badge.png" alt="COA Verified" />;
}

export function ProductCard({ product, library, stock, onOpen, onAdd, photo, sku: skuProp, onSku }) {
  const lot = lotFor(product, library);
  const first = product.sizes.find((row) => inStock(stock, row.sku)) || product.sizes[0];
  const [localSku, setLocalSku] = useState(first.sku);
  const sku = skuProp || localSku;
  const size = product.sizes.find((row) => row.sku === sku) || product.sizes[0];
  const soldOut = !inStock(stock, size.sku);
  const src = photo || VIAL_PHOTOS[product.id];
  const title = product.charge || product.name;
  const compound = product.charge && product.charge !== product.name ? product.name : "";
  const purity = purityLine(lot);

  function choose(next) {
    setLocalSku(next);
    if (onSku) onSku(next);
  }

  return (
    <article className="product-card">
      {/* Gold frame, leather header, candlelit window, parchment, and the Add Potion plaque. */}
      <img className="product-card-plate" src="/art/card/base.jpg" alt="" />
      <button className="product-card-open" type="button" onClick={() => onOpen(product.id)} aria-label={`Open ${title}`} />
      {/* Vial slot. Leave VIAL_PHOTOS empty and the painted bottle stays. A photo covers that window. */}
      <div className={src ? "product-card-vial has-photo" : "product-card-vial"}>
        {src ? <img src={src} alt="" /> : null}
      </div>
      <CoaBadge show={!!lot} />
      <p className="product-card-title" style={{ fontSize: titleSize(title) }}>{title}</p>
      {compound ? <p className="product-card-compound" style={{ fontSize: compound.length > 24 ? "2.45cqw" : compound.length > 16 ? "2.85cqw" : "3.3cqw" }}>{compound}</p> : null}
      {purity ? <p className="product-card-purity">{purity}</p> : null}
      <div className={product.sizes.length < 2 ? "product-card-rows one" : "product-card-rows"}>
        {product.sizes.map((row) => (
          <button
            key={row.sku}
            type="button"
            className={row.sku === sku ? "on" : ""}
            onClick={() => choose(row.sku)}
          >
            <span>Batch: {row.sku}</span>
            <b>{money(row.vial)}</b>
          </button>
        ))}
      </div>
      <button
        className="product-card-add"
        type="button"
        disabled={soldOut}
        onClick={() => onAdd(size, product)}
      >
        {soldOut ? "None on the shelf" : "Add Potion"}
      </button>
      <p className="product-card-flavor" style={{ fontSize: (product.line || "").length > 48 ? "2.55cqw" : "3.15cqw" }}>{product.line}</p>
    </article>
  );
}

function ProductView({ product, library, stock, onAdd, onBack, onOpen, admin, onPrintLabel, others }) {
  const [sku, setSku] = useState(product.sizes[0].sku);
  const [tab, setTab] = useState("description");
  const [bottle, setBottle] = useState(false);
  const size = product.sizes.find((row) => row.sku === sku) || product.sizes[0];
  const live = library[size.sku];
  const lot = live?.current
    ? { id: live.current.id, purity: live.current.purity, tested: live.current.tested, href: live.current.href, page: live.shortUrl, slug: live.slug }
    : size.coa?.batch
      ? { id: size.coa.batch, purity: size.coa.purity, tested: size.coa.tested, href: size.coa.file, page: "", slug: "" }
      : null;

  return (
    <section className="apothecary">
      <button className="back-link" type="button" onClick={onBack}>← Back to the shelf</button>
      <div className="product-top">
        <ProductCard
          product={product}
          library={library}
          stock={stock}
          onOpen={() => {}}
          onAdd={onAdd}
          photo={bottle ? VIAL_PHOTOS[`${product.id}-bottle`] : VIAL_PHOTOS[product.id]}
          sku={sku}
          onSku={setSku}
        />
        <div className="product-copy">
          <p className="potion-kicker">{product.row}</p>
          <h2>{product.charge || product.name}</h2>
          {product.charge && product.charge !== product.name && <p className="compound">{product.name}</p>}
          <p className="potion-line">{product.line}</p>
          <button className="text-link" type="button" onClick={() => setBottle((v) => !v)}>
            {bottle ? "View vial" : "View bottle details"}
          </button>
          {admin && live?.slug && (
            <button className="text-link" type="button" onClick={() => onPrintLabel(live.slug)}>Print label</button>
          )}
        </div>
      </div>

      <div className="rune-tabs">
        {["description", "ingredients", "coa", "usage"].map((key) => (
          <button key={key} type="button" className={tab === key ? "on" : ""} onClick={() => setTab(key)}>
            {key === "coa" ? "COA" : key[0].toUpperCase() + key.slice(1)}
          </button>
        ))}
      </div>
      <div className="parchment-block">
        {tab === "description" && <p>{product.blurb} {product.line}</p>}
        {tab === "ingredients" && (
          <p>{product.name}{size.mg !== "kit" ? `, ${size.mg} lyophilized vial` : ""}. Research material only. No fillers are listed on the certificate.</p>
        )}
        {tab === "coa" && (
          lot ? (
            <p>
              Batch {lot.id}. Purity {lot.purity}. Date of analysis {lot.tested}.
              {lot.page && <> <a href={lot.page}>Latest COA</a></>}
              {lot.href && <> · <a href={lot.href} target="_blank" rel="noreferrer">Open the file</a></>}
            </p>
          ) : <p>No certificate is posted for this lot yet.</p>
        )}
        {tab === "usage" && <p>Research use only. Not for human consumption. Handle, store, and log it the way your protocol requires.</p>}
      </div>

      <h3 className="band-title">Also on this row</h3>
      <div className="potion-grid">
        {others.map((item) => (
          <ProductCard key={item.id} product={item} library={library} stock={stock} onOpen={onOpen} onAdd={onAdd} />
        ))}
      </div>
    </section>
  );
}

export function ShopFront({ library, stock, cartCount, onAdd, onBasket, onDownload, admin, onPrintLabel }) {
  const [openId, setOpenId] = useState("");
  const [q, setQ] = useState("");
  const [note, setNote] = useState("");
  const shelf = PRODUCTS.map(enrich);
  const open = shelf.find((item) => item.id === openId);
  const featured = FEATURED.map((id) => shelf.find((item) => item.id === id)).filter(Boolean);
  const needle = q.trim().toLowerCase();
  const shown = shelf.filter((item) => {
    const hay = `${item.code} ${item.charge || ""} ${item.name} ${item.sizes.map((size) => size.sku).join(" ")}`.toLowerCase();
    return hay.includes(needle);
  });
  const groups = [];
  for (const item of shown) {
    let group = groups.find((row) => row.row === item.row);
    if (!group) {
      group = { row: item.row, note: item.note, items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }
  groups.sort((a, b) => ROW_ORDER.indexOf(a.row) - ROW_ORDER.indexOf(b.row));

  function add(size, product) {
    onAdd({
      sku: size.sku,
      name: product.name,
      charge: product.charge || product.name,
      mg: size.mg,
      price: size.vial,
      qty: 1,
    });
  }

  if (open) {
    const others = shelf.filter((item) => item.row === open.row && item.id !== open.id).slice(0, 3);
    return (
      <ProductView
        product={open}
        library={library}
        stock={stock}
        onAdd={add}
        onBack={() => setOpenId("")}
        onOpen={setOpenId}
        admin={admin}
        onPrintLabel={onPrintLabel}
        others={others}
      />
    );
  }

  return (
    <section className="apothecary">
      {/* Hero */}
      <div className="hero-frame">
        <div className="hero-copy">
          <p className="eyebrow">The Deviant's Shelf</p>
          <h2>Potions, Peptides, and Arcane Enhancements</h2>
          <p>Research vials, kept on a small shelf. Certificates stay attached to the batch you are looking at.</p>
          <div className="hero-actions">
            <a className="potion-add" href="#shelf">Shop potions</a>
            <a className="potion-add alt" href="#featured">Shop peptides</a>
          </div>
        </div>
        <div className="ornate-frame hero-vial tone-ember">
          <Vial id="r3" tone="ember" />
        </div>
      </div>

      {/* Trust */}
      <ul className="trust-row">
        <li>COA verified</li>
        <li>Ships from the US</li>
        <li>Research use only</li>
      </ul>

      {/* Featured */}
      <h3 id="featured" className="band-title">Featured on the shelf</h3>
      <div className="potion-grid">
        {featured.map((item) => (
          <ProductCard key={item.id} product={item} library={library} stock={stock} onOpen={setOpenId} onAdd={add} />
        ))}
      </div>

      {/* Lore */}
      <div className="parchment-block lore">
        <h3>The shelf</h3>
        <p>A private apothecary for people who already know what they are looking for. Each vial keeps the name of the compound, the batch, and the certificate that belongs to it.</p>
      </div>

      {/* Full shelf */}
      <div className="shelf-tools" id="shelf">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the shelf" />
        <button className="potion-add alt" type="button" onClick={() => cartCount && onBasket()}>
          {cartCount === 0 ? "Basket is empty" : cartCount === 1 ? "1 in the basket" : `${cartCount} in the basket`}
        </button>
        <button
          className="text-link"
          type="button"
          onClick={async () => {
            try {
              setNote("");
              await onDownload();
            } catch (error) {
              setNote(error.message);
            }
          }}
        >
          Download the catalog
        </button>
      </div>
      {note && <p className="err">{note}</p>}
      {groups.map((group) => (
        <div key={group.row}>
          <h3 className="band-title">{group.row}</h3>
          {group.note && <p className="row-note">{group.note}</p>}
          <div className="potion-grid">
            {group.items.map((item) => (
              <ProductCard key={item.id} product={item} library={library} stock={stock} onOpen={setOpenId} onAdd={add} />
            ))}
          </div>
        </div>
      ))}

      <footer className="stone-foot">
        <a href="#featured">Peptides</a>
        <a href="#shelf">The shelf</a>
        <a href="https://discord.gg/fGspu7HD7" target="_blank" rel="noreferrer">Discord</a>
      </footer>
    </section>
  );
}
