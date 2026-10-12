import { useEffect, useState } from "react";

const CLAIMED = "shelf-welcome";
const LATER = "shelf-welcome-later";
const WAIT = 90_000;

export function ShelfOffer() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (localStorage.getItem(CLAIMED) || sessionStorage.getItem(LATER)) return undefined;
    const started = Number(sessionStorage.getItem("shelf-welcome-at") || 0) || Date.now();
    sessionStorage.setItem("shelf-welcome-at", String(started));
    const left = Math.max(0, WAIT - (Date.now() - started));
    const timer = setTimeout(() => setOpen(true), left);
    return () => clearTimeout(timer);
  }, []);

  function close() {
    sessionStorage.setItem(LATER, "1");
    setOpen(false);
  }

  async function claim(event) {
    event.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const saved = await fetch("/api/book", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "subscribe", email }),
      });
      const data = await saved.json().catch(() => ({}));
      if (!saved.ok) throw new Error(data.error || "The shelf could not take that address.");
      if (!data.already) {
        const sent = await fetch("/api/mail", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ kind: "welcome", email }),
        });
        const note = await sent.json().catch(() => ({}));
        if (!sent.ok) throw new Error(note.error || "The letter could not be sent.");
      }
      localStorage.setItem(CLAIMED, "1");
      setCode(data.code || "WELCOME10");
    } catch (error) {
      setErr(error.message);
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="offer-shade" role="presentation" onClick={close}>
      <div className="offer-card" role="dialog" aria-modal="true" aria-label="Unlock the shelf" onClick={(event) => event.stopPropagation()}>
        <button className="offer-x" type="button" onClick={close} aria-label="Close">×</button>
        <img src="/art/offer-gate.webp?v=3" alt="" />
        {code ? (
          <div className="offer-done">
            <p>The letter is on its way.</p>
            <p>Your mark is <b>{code}</b></p>
            <p>It takes 10% off the first order.</p>
          </div>
        ) : (
          <form className="offer-form" onSubmit={claim}>
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="Email address"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-label="Email address"
            />
            <button type="submit" disabled={busy}>{busy ? "…" : "CLAIM 10% OFF"}</button>
          </form>
        )}
        {err && <p className="offer-err">{err}</p>}
      </div>
    </div>
  );
}
