import { useEffect, useState } from "react";
import * as store from "./store.js";

function slugify(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

function readUpload(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error("Choose a PDF or image."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve({ data: reader.result, fileName: file.name });
    reader.onerror = () => reject(new Error("That file could not be read."));
    reader.readAsDataURL(file);
  });
}

export function PublicCoa({ slug }) {
  const [item, setItem] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    store.coaPublic(slug).then(setItem).catch((error) => setErr(error.message));
  }, [slug]);

  const current = item?.current;
  return (
    <main className="coa-public">
      <p className="eyebrow">The Deviant's Shelf</p>
      <h1>Certificate of analysis</h1>
      {err && <p className="err">{err}</p>}
      {!item && !err && <p className="muted">Opening the certificate…</p>}
      {item && (
        <article className="panel">
          <h2>{item.name}</h2>
          {item.verified && <p className="coa-flag">COA verified</p>}
          {current ? (
            <ul className="coa-meta">
              <li>Batch · {current.id}</li>
              <li>Purity · {current.purity}</li>
              <li>Date of analysis · {current.tested}</li>
            </ul>
          ) : (
            <p>No certificate is posted for this product yet.</p>
          )}
          {current && (
            <a className="btn gold" href={current.href} target="_blank" rel="noreferrer">Download certificate</a>
          )}
          {item.batches?.length > 1 && (
            <>
              <h3>Batch history</h3>
              <ul className="coa-history">
                {item.batches.map((batch) => (
                  <li key={batch.id}>
                    <span>{batch.id} · {batch.purity} · {batch.tested}{batch.current ? " · current" : ""}</span>
                    <a href={batch.href} target="_blank" rel="noreferrer">File</a>
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="tiny">Third-party analytical report. Research use only. Not a drug, supplement, or treatment.</p>
        </article>
      )}
    </main>
  );
}

export function CoaLibrary({ session }) {
  const [items, setItems] = useState([]);
  const [mode, setMode] = useState("");
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [batch, setBatch] = useState("");
  const [purity, setPurity] = useState("");
  const [tested, setTested] = useState("");
  const [file, setFile] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  async function load() {
    const rows = await store.coaList(session.deskPin);
    setItems(rows);
  }

  useEffect(() => {
    load().catch((error) => setErr(error.message));
  }, [session]);

  function reset() {
    setMode("");
    setSlug("");
    setName("");
    setEditSlug("");
    setBatch("");
    setPurity("");
    setTested("");
    setFile(null);
    setErr("");
    setSlugTouched(false);
  }

  function openEdit(item) {
    setMode("edit");
    setSlug(item.slug);
    setName(item.name);
    setEditSlug(item.slug);
    setErr("");
  }

  function openBatch(item) {
    setMode("batch");
    setSlug(item.slug);
    setName(item.name);
    setBatch("");
    setPurity("");
    setTested("");
    setFile(null);
    setErr("");
  }

  function openReplace(item) {
    setMode("replace");
    setSlug(item.slug);
    setName(item.name);
    setFile(null);
    setErr("");
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      let rows;
      if (mode === "add") {
        const upload = await readUpload(file);
        rows = await store.coaSave({
          deskPin: session.deskPin,
          name,
          slug: editSlug || slugify(name),
          batch,
          purity,
          tested,
          data: upload.data,
          fileName: upload.fileName,
        });
      } else if (mode === "edit") {
        rows = await store.coaSave({
          deskPin: session.deskPin,
          currentSlug: slug,
          slug: editSlug,
          name,
        });
      } else if (mode === "batch") {
        const upload = await readUpload(file);
        rows = await store.coaBatch({
          deskPin: session.deskPin,
          slug,
          batch,
          purity,
          tested,
          data: upload.data,
          fileName: upload.fileName,
        });
      } else if (mode === "replace") {
        const upload = await readUpload(file);
        rows = await store.coaReplace({
          deskPin: session.deskPin,
          slug,
          data: upload.data,
          fileName: upload.fileName,
        });
      }
      setItems(rows || []);
      reset();
    } catch (error) {
      setErr(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function copy(url) {
    const full = `${window.location.origin}${url}`;
    try {
      await navigator.clipboard.writeText(full);
      setCopied(url);
    } catch {
      setCopied("");
    }
  }

  return (
    <section className="wrap">
      <h2>COA Library</h2>
      <p className="muted">Current certificates, batch history, and the public short link for each product. Customers never see this desk.</p>
      {err && <p className="err">{err}</p>}
      <button className="btn gold" type="button" onClick={() => { reset(); setMode("add"); }}>Add New Product</button>

      {mode === "add" && (
        <form className="panel" onSubmit={submit}>
          <h3>Add new product</h3>
          <label>Product name</label>
          <input value={name} onChange={(e) => { setName(e.target.value); if (!slugTouched) setEditSlug(slugify(e.target.value)); }} required />
          <label>Short URL slug</label>
          <input value={editSlug} onChange={(e) => { setSlugTouched(true); setEditSlug(slugify(e.target.value)); }} required />
          <p className="tiny">{editSlug ? `${window.location.origin}/c/${editSlug}` : "The short link is filled from the name. You can change it."}</p>
          <label>Initial batch ID</label>
          <input value={batch} onChange={(e) => setBatch(e.target.value)} required />
          <label>Purity %</label>
          <input value={purity} onChange={(e) => setPurity(e.target.value)} placeholder="99.9%" required />
          <label>Date of analysis</label>
          <input type="date" value={tested} onChange={(e) => setTested(e.target.value)} required />
          <label>COA file</label>
          <input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={(e) => setFile(e.target.files?.[0] || null)} required />
          <button className="btn gold" type="submit" disabled={busy}>{busy ? "Saving…" : "Create public page"}</button>
          <button className="tinybtn" type="button" onClick={reset}>Cancel</button>
        </form>
      )}

      {mode === "edit" && (
        <form className="panel" onSubmit={submit}>
          <h3>Edit product info</h3>
          <label>Product name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
          <label>Short URL slug</label>
          <input value={editSlug} onChange={(e) => setEditSlug(slugify(e.target.value))} required />
          <p className="tiny">The old short link keeps working.</p>
          <button className="btn gold" type="submit" disabled={busy}>{busy ? "Saving…" : "Save product"}</button>
          <button className="tinybtn" type="button" onClick={reset}>Cancel</button>
        </form>
      )}

      {mode === "batch" && (
        <form className="panel" onSubmit={submit}>
          <h3>Add new batch · {name}</h3>
          <label>Batch ID</label>
          <input value={batch} onChange={(e) => setBatch(e.target.value)} required />
          <label>Purity %</label>
          <input value={purity} onChange={(e) => setPurity(e.target.value)} placeholder="99.9%" required />
          <label>Date of analysis</label>
          <input type="date" value={tested} onChange={(e) => setTested(e.target.value)} required />
          <label>COA file</label>
          <input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={(e) => setFile(e.target.files?.[0] || null)} required />
          <button className="btn gold" type="submit" disabled={busy}>{busy ? "Saving…" : "Make this the current batch"}</button>
          <button className="tinybtn" type="button" onClick={reset}>Cancel</button>
        </form>
      )}

      {mode === "replace" && (
        <form className="panel" onSubmit={submit}>
          <h3>Replace COA · {name}</h3>
          <p className="tiny">The short link stays the same. Older batches stay in the history.</p>
          <label>New file</label>
          <input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={(e) => setFile(e.target.files?.[0] || null)} required />
          <button className="btn gold" type="submit" disabled={busy}>{busy ? "Saving…" : "Replace file"}</button>
          <button className="tinybtn" type="button" onClick={reset}>Cancel</button>
        </form>
      )}

      <div className="coa-list">
        {items.map((item) => (
          <article className="panel coa-row" key={item.slug}>
            <div>
              <h3>{item.name}</h3>
              <p className={item.verified ? "coa-flag" : "tiny"}>{item.verified ? "COA verified" : "No certificate yet"}</p>
              <ul className="coa-meta">
                <li>Batch · {item.current?.id || "—"}</li>
                <li>Purity · {item.current?.purity || "—"}</li>
                <li>Date · {item.current?.tested || "—"}</li>
              </ul>
              <button className="tinybtn coa-link" type="button" onClick={() => copy(item.shortUrl)}>
                {copied === item.shortUrl ? "Copied" : item.shortUrl}
              </button>
            </div>
            <div className="coa-actions">
              <button className="btn slim" type="button" onClick={() => openBatch(item)}>Add New Batch</button>
              <button className="btn slim" type="button" onClick={() => openReplace(item)} disabled={!item.current}>Replace COA</button>
              <button className="btn slim" type="button" onClick={() => openEdit(item)}>Edit Product Info</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
