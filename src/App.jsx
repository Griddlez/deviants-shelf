import { useEffect, useRef, useState } from "react";
import { CONFIG, PRODUCTS, quoteOrder } from "./data.js";
import { FLAVOR, ROW_ORDER } from "./flavor.js";
import * as store from "./store.js";
import { notify } from "./mail.js";


function usualFrom(orders) {
  const last = [...(orders || [])]
    .filter((order) => order.status !== "expired" && (order.items || []).length)
    .sort((a, b) => (b.placedAt || 0) - (a.placedAt || 0))[0];
  if (!last) return [];
  return last.items.map((line) => ({
    sku: line.sku,
    name: line.name,
    mg: line.mg,
    price: line.price,
    qty: line.qty,
  }));
}

function pathAt(status) {
  if (status === "unpaid") return 1;
  if (status === "review") return 2;
  if (status === "processing" || status === "shipped") return 3;
  if (status === "sent" || status === "history") return 4;
  return 0;
}

function OrderPath({ at }) {
  const steps = ["Place it", "Send the total", "Attach the receipt", "We pack it", "You get tracking"];
  return (
    <ol className="path">
      {steps.map((label, i) => (
        <li key={label} className={i < at ? "done" : i === at ? "on" : ""}>{label}</li>
      ))}
    </ol>
  );
}

function money(n) {
  return `$${Number(n).toFixed(0)}`;
}

function guessCarrier(order) {
  if (order.carrier === "fedex" || order.carrier === "usps") return order.carrier;
  if (order.shipping?.id === "fedex2" || order.shipping?.id === "overnight") return "fedex";
  return "usps";
}

function trackHref(order) {
  const n = encodeURIComponent(String(order.tracking || "").trim());
  if (guessCarrier(order) === "fedex") return `https://www.fedex.com/fedextrack/?trknbr=${n}`;
  return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${n}`;
}

function when(at) {
  if (!at) return "";
  return new Date(at).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function remainingMs(order) {
  const end = order.placedAt + CONFIG.receiptHours * 3600 * 1000;
  return end - Date.now();
}

function fmtRemain(ms) {
  if (ms <= 0) return "expired";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export default function App() {
  const [tick, setTick] = useState(0);
  const [session, setSession] = useState(() => store.getState().session);
  const [tab, setTab] = useState("catalog");
  const [openId, setOpenId] = useState("");
  const [cart, setCart] = useState(() => store.getState().cart);
  const [orders, setOrders] = useState([]);
  const [stock, setStock] = useState({});
  const [pay, setPay] = useState({});
  const [flow, setFlow] = useState(null);
  const [flash, setFlash] = useState(null);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (!session) return undefined;
    let stop = false;
    let seen = null;
    async function pull(force) {
      const current = store.getState().session;
      if (!current || stop) return;
      try {
        const ping = await store.ping(current);
        const rev = Number(ping.rev) || 0;
        if (Date.now() < hold.current) return;
        if (!force && seen === rev) return;
        seen = rev;
        const data = await store.listOrders(current);
        const next = data.orders || [];
        setOrders((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
        setStock(data.stock || {});
        setPay(data.pay || {});
      } catch {
        /* keep the list already on screen */
      }
    }
    pull(true);
    const timer = setInterval(() => pull(false), 1000);
    const onShow = () => {
      if (document.visibilityState === "visible") pull(true);
    };
    document.addEventListener("visibilitychange", onShow);
    return () => {
      stop = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, [session]);

  const hold = useRef(0);

  function commitCart(next) {
    store.setCart(next);
    setCart(next);
    const current = store.getState().session;
    if (current && !current.admin) store.saveCart(current, next).catch(() => {});
  }

  function patchOrder(id, patch) {
    hold.current = Date.now() + 2500;
    setOrders((prev) => prev.map((order) => (order.id === id ? { ...order, ...patch } : order)));
  }

  async function refresh() {
    const s = store.getState();
    setSession(s.session);
    setCart(s.cart);
    if (!s.session) {
      setOrders([]);
      return;
    }
    try {
      const data = await store.listOrders(s.session);
      setOrders(data.orders || []);
      setStock(data.stock || {});
      setPay(data.pay || {});
    } catch {
      setOrders([]);
    }
  }

  if (!session) {
    return <Gate onIn={refresh} />;
  }

  const visible = session.admin
    ? orders
    : orders.filter((o) => String(o.account) === String(session.account));
  const live = visible.filter((o) => o.status !== "history" && o.status !== "expired");
  const past = visible.filter((o) => o.status === "history" || o.status === "expired");

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <div className="logo-frame">
            <img className="logo" src="/art/logo.jpg" alt="The Deviant's Shelf" />
          </div>
        </div>
        <div className="top-actions">
          <button className="btn gold" onClick={() => { setTab("order"); setFlow({ step: "ship" }); }}>
            Place Order
          </button>
          <button className="acct" type="button" onClick={() => setTab("account")}>
            Account No. {session.account} · {session.name}
          </button>
        </div>
      </header>

      <nav className="tabs">
        <button className={tab === "catalog" ? "on" : ""} onClick={() => setTab("catalog")}>Catalog</button>
        <button className={tab === "active" ? "on" : ""} onClick={() => setTab("active")}>
          Active Orders{live.length ? ` (${live.length})` : ""}
        </button>
        <button className={tab === "history" ? "on" : ""} onClick={() => setTab("history")}>History</button>
        <button className={tab === "account" ? "on" : ""} onClick={() => setTab("account")}>Card</button>
        {session.admin && (
          <button className={tab === "admin" ? "on" : ""} onClick={() => setTab("admin")}>Desk</button>
        )}
      </nav>

      {tab === "catalog" && (
        <Catalog
          openId={openId}
          setOpenId={setOpenId}
          cart={cart}
          stock={stock}
          onBasket={() => { setTab("order"); setFlow({ step: "ship" }); }}
          onAdd={(line) => {
            const left = stock[line.sku];
            const have = cart.find((item) => item.sku === line.sku)?.qty || 0;
            if (typeof left === "number" && have + 1 > left) return;
            const next = cart.some((item) => item.sku === line.sku)
              ? cart.map((item) => (item.sku === line.sku ? { ...item, qty: item.qty + 1 } : item))
              : [...cart, line];
            commitCart(next);
          }}
        />
      )}

      {tab === "active" && (
        <OrderList
          tick={tick}
          title="Active Orders"
          subtitle={session.admin ? "Every open ticket. Change the status here. This list updates on its own." : "Orders in the queue or on the way."}
          orders={live}
          session={session}
          onChange={refresh}
          patchOrder={patchOrder}
          setFlash={setFlash}
        />
      )}

      {tab === "history" && (
        <OrderList
          tick={tick}
          title="History"
          subtitle={session.admin ? "Closed and expired tickets." : "Closed and expired tickets."}
          orders={past}
          session={session}
          onChange={refresh}
          patchOrder={patchOrder}
          setFlash={setFlash}
        />
      )}

      {tab === "account" && <AccountCard session={session} onSaved={refresh} />}

      {tab === "admin" && session.admin && (
          <AdminDesk session={session} stock={stock} pay={pay} onStock={setStock} onPay={setPay} />
        )}

      {(tab === "order" || flow) && tab === "order" && (
        <PlaceOrder
          session={session}
          cart={cart}
          setCart={commitCart}
          usual={session.admin ? [] : usualFrom(visible)}
          onClose={() => { setFlow(null); setTab("catalog"); }}
          onPlaced={(order) => {
            refresh();
            setFlow(null);
            setTab("active");
            setFlash(order);
          }}
        />
      )}

      {flash && <PlacedModal order={flash} pay={pay} onClose={() => setFlash(null)} />}

      <footer className="foot">
        <button className="ghost" onClick={() => { store.clearSession(); refresh(); }}>Sign out</button>
        <span>Research use only. Nothing here is a medicine.</span>
      </footer>
    </div>
  );
}

function inviteFromUrl() {
  const raw = new URLSearchParams(window.location.search).get("card") || "";
  const match = raw.match(/^(\d+)\.(\d{4,8})$/);
  if (!match) return null;
  return { account: match[1], pin: match[2] };
}

function doorFromUrl() {
  const path = window.location.pathname.match(/^\/invite\/link\/([A-Za-z0-9]+)$/);
  if (path) return path[1];
  return new URLSearchParams(window.location.search).get("invite") || "";
}

function freshPin() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function Gate({ onIn }) {
  const invite = inviteFromUrl();
  const door = doorFromUrl();
  const [view, setView] = useState(door || invite ? "claim" : "welcome");
  const [open, setOpen] = useState(false);
  const [adult, setAdult] = useState(false);
  const [name, setName] = useState("");
  const [pin, setPin] = useState(invite?.pin || "");
  const [err, setErr] = useState("");

  async function signIn(e) {
    e.preventDefault();
    try {
      const claimed = await store.signInCard({ name, pin });
      store.setSession({
        name: claimed.name,
        account: claimed.account,
        admin: false,
        pin: pin.replace(/\s/g, ""),
        email: claimed.email || "",
        address: claimed.address || null,
        templates: claimed.templates || [],
      });
      if (Array.isArray(claimed.cart)) store.setCart(claimed.cart);
      onIn();
    } catch (error) {
      setErr(error.message);
    }
  }

  async function openDesk(e) {
    e.preventDefault();
    const display = name.trim().slice(0, 24);
    if (!display) {
      setErr("Type your name.");
      return;
    }
    try {
      await store.deskDoor(pin.replace(/\s/g, ""));
      store.setSession({ name: display, account: "0", admin: true, deskPin: pin.replace(/\s/g, "") });
      onIn();
    } catch (error) {
      setErr(error.message);
    }
  }

  async function claim(e) {
    e.preventDefault();
    if (!adult) {
      setErr("You have to be 21 or older to claim an invitation.");
      return;
    }
    try {
      const claimed = door
        ? await store.joinCard({ token: door, pin, name })
        : await store.claimCard({ account: invite.account, pin, name });
      store.setSession({
        name: claimed.name,
        account: claimed.account,
        admin: false,
        pin: pin.replace(/\s/g, ""),
        email: claimed.email || "",
        address: claimed.address || null,
        templates: claimed.templates || [],
      });
      if (Array.isArray(claimed.cart)) store.setCart(claimed.cart);
      window.history.replaceState({}, "", "/");
      onIn();
    } catch (error) {
      setErr(error.message);
    }
  }

  return (
    <div className="gate">
      {view === "claim" && (door || invite) && (
        <>
          {!open ? (
            <div className="scroll-shut">
              <p className="eyebrow">An invitation from</p>
              <p className="lede">{CONFIG.shopName}</p>
              <button className="roll-btn" type="button" aria-label="Tap the seal" onClick={() => { setOpen(true); if (!pin) setPin(freshPin()); }} />
              <p className="scroll-hint">Tap the seal</p>
              <p className="tiny">An invitation has been sealed for you.</p>
            </div>
          ) : (
            <form className="invite" onSubmit={claim}>
              <div className="sheet">
                <p className="script-title">You are invited</p>
                <p className="script">Write your name. Choose a gate code. The door will know you.</p>
                <label>Name on invitation</label>
                <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} placeholder="Your name" required />
                <label>Gate code</label>
                <p className="fine">Four to eight digits. Keep this one, or write your own.</p>
                <div className="row-btns">
                  <input value={pin} onChange={(e) => setPin(e.target.value)} inputMode="numeric" autoComplete="off" />
                  <button className="btn slim" type="button" onClick={() => setPin(freshPin())}>New gate code</button>
                </div>
                {err && <p className="err">{err}</p>}
                <label className="check">
                  <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} />
                  You are 21 or older.
                </label>
                <button className="btn gold wide" type="submit" disabled={!adult}>Claim your invitation</button>
                <p className="fine">The name is kept as you write it. Sign in later with that name and gate code.</p>
              </div>
            </form>
          )}
        </>
      )}

      {view === "welcome" && (
        <>
          <img className="logo" src="/art/logo.jpg" alt="The Deviant's Shelf" />
          <p className="lede">Have you been invited?</p>
          <p className="muted">This shelf is invitation-only. Open the invitation and tap the seal. Already claimed? Sign in with the name on the invitation and your gate code.</p>
          <button className="btn gold wide" type="button" onClick={() => { setView("signin"); setErr(""); }}>Sign in</button>
          <button className="tinybtn" type="button" onClick={() => { setView("desk"); setErr(""); setPin(""); }}>Shop desk</button>
        </>
      )}

      {view === "signin" && (
        <form className="panel" onSubmit={signIn}>
          <p className="eyebrow">Sign in</p>
          <label>Name on invitation</label>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} placeholder="Your name" required />
          <label>Gate code</label>
          <input value={pin} onChange={(e) => setPin(e.target.value)} inputMode="numeric" placeholder="••••••" autoComplete="off" />
          {err && <p className="err">{err}</p>}
          <button className="btn gold wide" type="submit">Sign in</button>
          <button className="tinybtn" type="button" onClick={() => { setView("welcome"); setErr(""); }}>Back</button>
        </form>
      )}

      {view === "desk" && (
        <form className="panel" onSubmit={openDesk}>
          <p className="eyebrow">Shop desk</p>
          <p className="muted">Account no. 0. This door is only yours.</p>
          <label>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} placeholder="Your name" required />
          <label>Desk PIN</label>
          <input value={pin} onChange={(e) => setPin(e.target.value)} inputMode="numeric" placeholder="••••" autoComplete="off" />
          {err && <p className="err">{err}</p>}
          <button className="btn gold wide" type="submit">Open the desk</button>
          <button className="tinybtn" type="button" onClick={() => { setView("welcome"); setErr(""); }}>Back</button>
        </form>
      )}
    </div>
  );
}

function Catalog({ openId, setOpenId, cart, onAdd, onBasket, stock }) {
  const [q, setQ] = useState("");
  const [coa, setCoa] = useState(null);
  const list = PRODUCTS.filter((p) => {
    const hay = `${p.code} ${p.name} ${p.sizes.map((s) => s.sku).join(" ")}`.toLowerCase();
    return hay.includes(q.trim().toLowerCase());
  }).map((p) => {
    const f = FLAVOR[p.id] || { row: "The shelf", note: "", line: p.blurb };
    return { ...p, row: f.row, note: f.note, line: f.line || p.blurb };
  });
  const groups = [];
  for (const p of list) {
    let g = groups.find((x) => x.row === p.row);
    if (!g) {
      g = { row: p.row, note: p.note, items: [] };
      groups.push(g);
    }
    g.items.push(p);
  }
  groups.sort((a, b) => ROW_ORDER.indexOf(a.row) - ROW_ORDER.indexOf(b.row));
  const count = cart.reduce((n, l) => n + l.qty, 0);

  return (
    <section className="wrap">
      <h2>Catalog</h2>
      <p className="muted">Current availability and pricing. The kit is one kit. Everything else is one vial.</p>
      <div className="tools">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products" />
        <button className="btn slim basket" type="button" onClick={() => count && onBasket()}>
          <img className="basket-mark" src="data:image/png;base64,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" alt="" />
          {count === 0 ? "Basket is empty" : count === 1 ? "1 in the basket" : `${count} in the basket`}
        </button>
      </div>
      {groups.map((g) => (
        <div key={g.row}>
          <header className="shelf-row">
            <h3>{g.row}</h3>
            {g.note && <p>{g.note}</p>}
          </header>
          {g.items.map((p) => (
        <article key={p.id} className={openId === p.id ? "acc open" : "acc"}>
          <button className="acc-h" onClick={() => setOpenId(openId === p.id ? "" : p.id)}>
            <span>{openId === p.id ? "▼" : "▶"} {p.name}</span>
            <em>{p.code}</em>
          </button>
          {openId === p.id && (
            <div className="acc-b">
              <p className="blurb">{p.line}</p>
              {p.sizes.map((s) => (
                <div className="row" key={s.sku}>
                  <div className="sku-line">
                    <b className="sku">{s.sku}</b> <span className="mg">{s.mg}</span>
                    {s.coa?.file && (
                      <button
                        className="btn slim coa"
                        onClick={() => setCoa({ ...s, name: p.name })}
                      >
                        COA
                      </button>
                    )}
                  </div>
                  <div className="row-r">
                    <span>{money(s.vial)}</span>
                    {typeof stock?.[s.sku] === "number" && stock[s.sku] <= 3 && <span className="tiny">{stock[s.sku] === 0 ? "None on the shelf" : `${stock[s.sku]} left`}</span>}
                    <button
                      className="btn slim"
                      disabled={typeof stock?.[s.sku] === "number" && stock[s.sku] < 1}
                      onClick={() =>
                        onAdd({
                          sku: s.sku,
                          name: p.name,
                          mg: s.mg,
                          price: s.vial,
                          qty: 1,
                        })
                      }
                    >
                      {p.id === "kit" ? "Add kit" : "Add potion"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
          ))}
        </div>
      ))}
      {coa && <CoaModal item={coa} onClose={() => setCoa(null)} />}
    </section>
  );
}

function CoaModal({ item, onClose }) {
  const c = item.coa;
  const file = c?.file || "";
  const image = /\.(png|jpe?g|webp)$/i.test(file);
  const local = file.startsWith("/");

  return (
    <div className="modal" onClick={onClose}>
      <div className="panel modal-card coa-card" onClick={(e) => e.stopPropagation()}>
        <p className="eyebrow">Certificate of analysis</p>
        <h3>{item.name}</h3>
        <p className="muted">{item.sku} · {item.mg}</p>
        {c && (c.file || c.lab || c.batch || c.tested || c.purity) ? (
          <>
            <ul className="coa-meta">
              {c.lab && <li>Lab · {c.lab}</li>}
              {c.batch && <li>Batch · {c.batch}</li>}
              {c.tested && <li>Tested · {c.tested}</li>}
              {c.purity && <li>Purity · {c.purity}</li>}
            </ul>
            {file && local && image && <img className="coa-img" src={file} alt={`COA ${item.sku}`} />}
            {file && local && !image && (
              <iframe className="coa-frame" title={`COA ${item.sku}`} src={file} />
            )}
            {file && (
              <a className="btn" href={file} target="_blank" rel="noreferrer">Open certificate</a>
            )}
          </>
        ) : (
          <p>No certificate is posted for this lot yet.</p>
        )}
        <p className="tiny">Third-party analytical report. Research use only. Not a guarantee of fitness for any use.</p>
        <button className="btn gold wide" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

function SlideConfirm({ done, onDone }) {
  const track = useRef(null);
  const drag = useRef(null);
  const pos = useRef(0);
  const [x, setX] = useState(0);

  function limit() {
    const el = track.current;
    return el ? Math.max(0, el.clientWidth - 56) : 0;
  }

  function down(e) {
    if (done) return;
    drag.current = { start: e.clientX, base: pos.current };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function move(e) {
    if (!drag.current || done) return;
    const next = Math.min(limit(), Math.max(0, drag.current.base + (e.clientX - drag.current.start)));
    pos.current = next;
    setX(next);
  }

  function up() {
    if (!drag.current || done) return;
    drag.current = null;
    const end = limit();
    if (pos.current >= end - 8 && end > 0) {
      pos.current = end;
      setX(end);
      onDone();
    } else {
      pos.current = 0;
      setX(0);
    }
  }

  return (
    <div className={"slider" + (done ? " done" : "")} ref={track}>
      <div className="slider-fill" style={{ width: done ? "100%" : x + 48 }} />
      <span className="slider-label">{done ? "Confirmed" : "Slide to confirm"}</span>
      <div
        className="slider-knob"
        style={done ? { left: "auto", right: 4 } : { transform: `translateX(${x}px)` }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      >
        {done ? "✓" : "→"}
      </div>
    </div>
  );
}

function PlaceOrder({ session, cart, setCart, onClose, onPlaced, usual }) {
  const [step, setStep] = useState("ship");
  const [shipId, setShipId] = useState("usps");
  const savedAddress = session.address || {};
  const [contact, setContact] = useState({
    fullName: savedAddress.fullName || "",
    line1: savedAddress.line1 || "",
    line2: savedAddress.line2 || "",
    city: savedAddress.city || "",
    state: savedAddress.state || "",
    zip: savedAddress.zip || "",
    email: session.email || "",
  });
  const [keepAddress, setKeepAddress] = useState(true);
  const [templates, setTemplates] = useState(session.templates || []);
  const [ruo, setRuo] = useState(false);
  const [slid, setSlid] = useState(false);
  const [codes, setCodes] = useState([]);
  const [draft, setDraft] = useState("");
  const [codeErr, setCodeErr] = useState("");

  const ship = CONFIG.shipping.find((s) => s.id === shipId);
  const sub = cart.reduce((n, l) => n + l.price * l.qty, 0);
  const quote = quoteOrder(sub, shipId, codes);
  const total = quote.total ?? sub + (ship?.price || 0);

  function addCode() {
    const key = draft.trim().toUpperCase();
    if (!key) return;
    if (codes.includes(key)) {
      setCodeErr("That code is already on this order.");
      return;
    }
    const next = quoteOrder(sub, shipId, [...codes, key]);
    if (next.error) {
      setCodeErr(next.error);
      return;
    }
    setCodes(next.codes);
    setDraft("");
    setCodeErr("");
  }

  const [err, setErr] = useState("");

  async function place() {
    if (!ruo || !slid || !cart.length) return;
    try {
      const order = await store.placeOrder({
        name: session.name,
        pin: session.pin,
        order: {
          items: cart,
          shipping: { ...ship, price: quote.shipPrice, label: quote.hand ? "Hand delivery" : ship.label, detail: quote.hand ? "No shipping fee" : ship.detail },
          contact,
          codes: quote.codes,
          sub,
          total,
        },
      });
      setCart([]);
      if (keepAddress && !session.admin) {
        store.saveCard({
          name: session.name,
          pin: session.pin,
          email: contact.email || session.email || "",
          address: contact,
        }).then((saved) => {
          const current = store.getState().session;
          if (current) store.setSession({ ...current, email: saved.email || current.email, address: saved.address || contact });
        }).catch(() => {});
      }
      notify("received", order);
      onPlaced(order);
    } catch (error) {
      setErr(error.message);
    }
  }

  return (
    <section className="wrap">
      <button className="btn" onClick={onClose}>Return home</button>
      <h2>Place Order</h2>
      <p className="muted">Choose a shipping speed, add items, then review.</p>
      <p className="pill">US-Warehouse order</p>

      {step === "ship" && (
        <>
          <OrderPath at={0} />
          <h3 className="label">Shipping</h3>
          {!!usual?.length && (
            <button className="btn slim" type="button" onClick={() => setCart(usual)}>Give me the Usual</button>
          )}
          <div className="ships">
            {CONFIG.shipping.map((s) => (
              <button
                key={s.id}
                className={shipId === s.id ? "ship on" : "ship"}
                onClick={() => setShipId(s.id)}
              >
                <b>{s.label}</b>
                <span>{s.detail}</span>
                <strong>{money(s.price)}</strong>
              </button>
            ))}
          </div>
          {!!templates.length && (
            <div className="row-btns">
              {templates.map((item) => (
                <button key={item.id} className="btn slim" type="button" onClick={() => setCart(item.items || [])}>{item.label}</button>
              ))}
            </div>
          )}
          <CartBox cart={cart} setCart={setCart} session={session} onTemplates={setTemplates} />
          <p className="muted">Order total (before shipping) {money(sub)}</p>
          <button className="btn gold wide" disabled={!cart.length} onClick={() => setStep("review")}>
            Review Order
          </button>
        </>
      )}

      {step === "review" && (
        <div className="panel">
          <h3>Review order</h3>
          {cart.map((l, i) => (
            <div className="line" key={i}>
              <span>{l.name} · {l.sku} · {l.mg} ×{l.qty}</span>
              <b>{money(l.price * l.qty)}</b>
            </div>
          ))}
          <div className="line"><span>Subtotal</span><b>{money(sub)}</b></div>
          {quote.discount > 0 && (
            <div className="line"><span>Discount · {quote.labels.filter((label) => label !== "Hand delivery").join(" · ")}</span><b>−{money(quote.discount)}</b></div>
          )}
          <div className="codebox">
            <h3 className="label">Discount code</h3>
            <p className="tiny">Two codes at most.</p>
            <div className="row-btns">
              <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Code" autoComplete="off" />
              <button className="btn slim" type="button" onClick={addCode}>Apply</button>
            </div>
            {(quote.codes || []).map((code) => (
              <div className="line" key={code}>
                <span>{code}</span>
                <button className="tinybtn" type="button" onClick={() => setCodes(quote.codes.filter((item) => item !== code))}>Remove</button>
              </div>
            ))}
            {codeErr && <p className="err">{codeErr}</p>}
          </div>
          <div className="line"><span>Shipping · {quote.hand ? "Hand delivery" : ship.label}</span><b>{money(quote.shipPrice)}</b></div>
          <div className="line total"><span>Total</span><b>{money(total)}</b></div>
          <div className="row-btns">
            <button className="btn" onClick={() => setStep("ship")}>Back</button>
            <button className="btn gold" onClick={() => setStep("shipTo")}>Continue</button>
          </div>
        </div>
      )}

      {step === "shipTo" && (
        <form
          className="panel"
          onSubmit={(e) => {
            e.preventDefault();
            setStep("confirm");
          }}
        >
          <h3>Delivery contact</h3>
          <p className="warn">
            All contact info is tied directly to the receipt and not stored on the member card unless you add an email for updates.
          </p>
          <label>Full name</label>
          <input required value={contact.fullName} onChange={(e) => setContact({ ...contact, fullName: e.target.value })} />
          <label>Address line 1</label>
          <input required value={contact.line1} onChange={(e) => setContact({ ...contact, line1: e.target.value })} />
          <label>Address line 2</label>
          <input value={contact.line2} onChange={(e) => setContact({ ...contact, line2: e.target.value })} />
          <label>City</label>
          <input required value={contact.city} onChange={(e) => setContact({ ...contact, city: e.target.value })} />
          <label>State</label>
          <input required value={contact.state} onChange={(e) => setContact({ ...contact, state: e.target.value })} />
          <label>ZIP</label>
          <input required value={contact.zip} onChange={(e) => setContact({ ...contact, zip: e.target.value })} />
          <label className="check">
            <input type="checkbox" checked={keepAddress} onChange={(e) => setKeepAddress(e.target.checked)} />
            Save this address on the card for next time.
          </label>
          <label>Email for status (optional)</label>
          <input type="email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} />
          <div className="row-btns">
            <button type="button" className="btn" onClick={() => setStep("review")}>Back</button>
            <button className="btn gold" type="submit">Continue</button>
          </div>
        </form>
      )}

      {step === "confirm" && (
        <div className="panel">
          <h3>Confirm order</h3>
          <p className="line total"><span>Total</span><b>{money(total)}</b></p>
          <label className="check">
            <input type="checkbox" checked={ruo} onChange={(e) => setRuo(e.target.checked)} />
            You understand all of these products are for Research Purposes Only.
          </label>
          <p>
            I understand that my order will NOT be processed until I post an image of a receipt showing that I paid.
          </p>
          <SlideConfirm done={slid} onDone={() => setSlid(true)} />
          {err && <p className="err">{err}</p>}
          <button className="btn gold wide" disabled={!ruo || !slid} onClick={place}>
            Place order
          </button>
        </div>
      )}
    </section>
  );
}

function CartBox({ cart, setCart, session, onTemplates }) {
  const [label, setLabel] = useState("");
  const [note, setNote] = useState("");
  function qty(index, delta) {
    const next = cart.map((line, i) => (i === index ? { ...line, qty: line.qty + delta } : line)).filter((line) => line.qty > 0);
    setCart(next);
  }
  async function saveTemplate() {
    try {
      const saved = await store.saveTemplate({ name: session.name, pin: session.pin, label, items: cart });
      store.setSession({ ...session, templates: saved.templates || [] });
      onTemplates?.(saved.templates || []);
      setLabel("");
      setNote("Template saved on this card.");
    } catch (error) {
      setNote(error.message);
    }
  }
  if (!cart.length) return <p className="muted">The basket is empty. Add from the catalog, or load a template below.</p>;
  return (
    <div className="cart">
      {cart.map((l, i) => (
        <div className="line" key={i}>
          <span>{l.sku} ×{l.qty}</span>
          <span>
            {money(l.price * l.qty)}{" "}
            <button className="tinybtn" type="button" onClick={() => qty(i, -1)}>−</button>
            <button className="tinybtn" type="button" onClick={() => qty(i, 1)}>+</button>
            <button className="tinybtn" type="button" onClick={() => setCart(cart.filter((_, j) => j !== i))}>×</button>
          </span>
        </div>
      ))}
      <button className="btn slim" type="button" onClick={() => setCart([])}>Empty basket</button>
      <label>Save this basket as a template</label>
      <div className="row-btns">
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Usual order" />
        <button className="btn slim" type="button" onClick={saveTemplate}>Save</button>
      </div>
      {note && <p className="tiny">{note}</p>}
    </div>
  );
}

function PlacedModal({ order, pay, onClose }) {
  return (
    <div className="modal">
      <div className="panel modal-card">
        <h3>Order placed</h3>
        <p>
          Your order is in the queue. Payment is the next step — once your payment receipt is attached and certified, the order moves on to processing.
        </p>
        <p>
          You have {CONFIG.receiptHours} hour{CONFIG.receiptHours === 1 ? "" : "s"} from placing the order to attach your payment receipt — after that the order expires and is removed.
        </p>
        <div className="paybox">
          <h4>Payment</h4>
          <p>{CONFIG.pay.note}</p>
          <ul>
            {[
              ["Venmo", pay?.venmo || CONFIG.pay.venmo],
              ["Cash App", pay?.cashApp || CONFIG.pay.cashApp],
              ["Chime", pay?.chime || CONFIG.pay.chime],
            ].filter(([, value]) => value).map(([label, value]) => (
              <li key={label}>{label} · {value}</li>
            ))}
          </ul>
          {(pay?.ownerName || CONFIG.pay.ownerName) && <p>All accounts are under the name {pay?.ownerName || CONFIG.pay.ownerName}.</p>}
          <p><b>No payment is taken in the app.</b></p>
        </div>
        <p>Ticket #{order.id} · {money(order.total)}</p>
        <button className="btn gold wide" onClick={onClose}>Got it</button>
      </div>
    </div>
  );
}

function OrderList({ title, subtitle, orders, onChange, tick, session, patchOrder }) {
  const [openId, setOpenId] = useState(null);
  return (
    <section className="wrap">
      <h2>{title}</h2>
      <p className="muted">{subtitle}</p>
      {session?.admin && <p className="tiny">Click an order number to open it. Update that one, then open the next.</p>}
      {!orders.length && <p className="muted">Nothing here yet.</p>}
      {session?.admin
        ? orders.map((o) => (
          <div key={o.id}>
            <button
              type="button"
              className={openId === o.id ? "order-row on" : "order-row"}
              onClick={() => setOpenId(openId === o.id ? null : o.id)}
            >
              <b>#{o.id}</b>
              <span>No. {o.account ?? "—"} · {o.accountName || o.contact?.fullName || "Member"}</span>
              <span className={`badge ${o.status}`}>{labelStatus(o.status)}</span>
              {o.status === "review" && <span className="tiny">Receipt waiting</span>}
              <span>{money(o.total)}</span>
            </button>
            {openId === o.id && (
              <DeskTicket order={o} session={session} onChange={onChange} patchOrder={patchOrder} />
            )}
          </div>
        ))
        : orders.map((o) => (
          <OrderCard key={o.id} order={o} tick={tick} onChange={onChange} session={session} patchOrder={patchOrder} />
        ))}
    </section>
  );
}

function OrderCard({ order, onChange, tick, session, patchOrder }) {
  const left = remainingMs(order);
  const expired = order.status === "unpaid" && left <= 0;
  const noted = useRef(false);

  useEffect(() => {
    if (expired && !noted.current) {
      noted.current = true;
      onChange();
    }
  }, [expired, onChange]);

  async function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await shrinkImage(file);
      patchOrder?.(order.id, { status: "review" });
      const saved = await store.addReceipt({
        name: session.name,
        pin: session.pin,
        id: order.id,
        data,
        fileName: file.name,
      });
      notify("receipt", saved);
      onChange();
    } catch (error) {
      window.alert(error.message);
      onChange();
    }
  }

  return (
    <article className="ticket">
      <div className="ticket-h">
        <span>#{order.id}</span>
        <span className={`badge ${order.status}`}>{labelStatus(order.status)}</span>
        <span>{money(order.total)}</span>
      </div>
      <OrderPath at={pathAt(order.status)} />
      {order.status === "unpaid" && (
        <div className="timer">Attach Proof of Purchase {fmtRemain(left)}</div>
      )}
      {order.items.map((l, i) => (
        <div className="line" key={i}>
          <span>{l.name} · {l.sku} · {l.mg} ×{l.qty}</span>
          <b>{money(l.price * l.qty)}</b>
        </div>
      ))}
      <div className="line"><span>Shipping · {order.shipping.label}</span><b>{money(order.shipping.price)}</b></div>
      {order.discount > 0 && (
        <div className="line"><span>Discount · {(order.codes || []).join(" · ")}</span><b>−{money(order.discount)}</b></div>
      )}
      <div className="line total"><span>Total</span><b>{money(order.total)}</b></div>
      {order.status === "unpaid" && (
        <div className="upload">
          <p className="muted">Photograph the receipt only. Paid in more than one transaction? Add each receipt.</p>
          <input type="file" accept="image/*" onChange={onFile} />
        </div>
      )}
      {order.status === "review" && <p>Payment under review — a receipt is waiting to be verified.</p>}
      {order.status === "processing" && <p>Paid. Ticket is in processing.</p>}
      {order.status === "shipped" && <p>Being prepared.</p>}
      {order.status === "sent" && order.tracking && (
        <p>Shipped. Track it: <a href={trackHref(order)} target="_blank" rel="noreferrer">{order.tracking}</a></p>
      )}
      {!!(order.receipts || []).length && (
        <div className="receipt-box">
          <h4>Payment receipt</h4>
          {(order.receipts || []).map((r, i) => (
            <ReceiptView key={r.path || i} session={session} path={r.path} name={r.name} at={r.at} />
          ))}
        </div>
      )}
    </article>
  );
}

function ReceiptView({ session, path, name, at }) {
  const [open, setOpen] = useState(false);
  const [src, setSrc] = useState("");
  const [err, setErr] = useState("");

  async function show() {
    try {
      if (!src) {
        const result = await store.receiptImage(session, path);
        setSrc(result.data);
      }
      setOpen(true);
    } catch (error) {
      setErr(error.message);
    }
  }

  return (
    <div>
      <button className="btn wide receipt-btn" type="button" onClick={show}>View receipt</button>
      {at && <p className="tiny">Added {when(at)}</p>}
      {err && <p className="err">{err}</p>}
      {open && src && (
        <div className="modal" onClick={() => setOpen(false)}>
          <div className="panel modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Payment receipt</h3>
            <img className="rcpt" src={src} alt={name || "Receipt"} />
            <button className="btn gold wide" type="button" onClick={() => setOpen(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

function shrinkImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("That photo could not be read."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("That photo could not be read."));
      img.onload = () => {
        const scale = Math.min(1, 1400 / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.72));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function ReceiptPic({ session, path, name }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    if (!path) return;
    store.receiptImage(session, path).then((result) => setSrc(result.data)).catch(() => {});
  }, [path, session]);
  if (!src) return <p className="tiny">{name || "Receipt"}</p>;
  return <img className="rcpt" src={src} alt={name || "Receipt"} />;
}

function AccountCard({ session, onSaved }) {
  const [email, setEmail] = useState(session.email || "");
  const [address, setAddress] = useState(session.address || { fullName: "", line1: "", line2: "", city: "", state: "", zip: "" });
  const [templates, setTemplates] = useState(session.templates || []);
  const [nextPin, setNextPin] = useState("");
  const [pin, setPin] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  if (session.admin) {
    return (
      <section className="wrap">
        <h2>Your card</h2>
        <p className="muted">Account 0 is the desk. Member email and PIN are saved on a member card, not this door.</p>
      </section>
    );
  }

  async function save(e) {
    e.preventDefault();
    try {
      const saved = await store.saveCard({
        name: session.name,
        pin: pin || session.pin,
        email,
        nextPin,
        address,
      });
      store.setSession({ ...session, email: saved.email, pin: saved.pin, address: saved.address || address });
      setNextPin("");
      setPin("");
      setMsg("Saved.");
      setErr("");
      onSaved();
    } catch (error) {
      setMsg("");
      setErr(error.message);
    }
  }

  return (
    <section className="wrap">
      <h2>Your card</h2>
      <p className="muted">No. {session.account} · {session.name}</p>
      <form className="panel" onSubmit={save}>
        <label>Email for order notes</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        <label>Saved ship-to name</label>
        <input value={address.fullName || ""} onChange={(e) => setAddress({ ...address, fullName: e.target.value })} />
        <label>Address</label>
        <input value={address.line1 || ""} onChange={(e) => setAddress({ ...address, line1: e.target.value })} />
        <input value={address.line2 || ""} onChange={(e) => setAddress({ ...address, line2: e.target.value })} placeholder="Line 2" />
        <input value={address.city || ""} onChange={(e) => setAddress({ ...address, city: e.target.value })} placeholder="City" />
        <input value={address.state || ""} onChange={(e) => setAddress({ ...address, state: e.target.value })} placeholder="State" />
        <input value={address.zip || ""} onChange={(e) => setAddress({ ...address, zip: e.target.value })} placeholder="ZIP" />
        <label>New gate code</label>
        <p className="tiny">Leave this blank to keep your gate code. Or type your own, or take a random one.</p>
        <div className="row-btns">
          <input value={nextPin} onChange={(e) => setNextPin(e.target.value)} inputMode="numeric" autoComplete="off" placeholder="4 to 8 digits" />
          <button className="btn slim" type="button" onClick={() => setNextPin(freshPin())}>New gate code</button>
        </div>
        {!session.pin && (
          <>
            <label>Current gate code</label>
            <input value={pin} onChange={(e) => setPin(e.target.value)} inputMode="numeric" autoComplete="off" />
          </>
        )}
        {err && <p className="err">{err}</p>}
        {msg && <p className="muted">{msg}</p>}
        <button className="btn gold" type="submit">Save</button>
      </form>
      {!!templates.length && (
        <div className="panel">
          <h3>Order templates</h3>
          {templates.map((item) => (
            <p key={item.id} className="tiny">
              {item.label}{" "}
              <button className="tinybtn" type="button" onClick={async () => {
                const saved = await store.saveTemplate({ name: session.name, pin: session.pin, op: "drop", id: item.id });
                setTemplates(saved.templates || []);
                store.setSession({ ...session, templates: saved.templates || [] });
              }}>Remove</button>
            </p>
          ))}
        </div>
      )}
    </section>
  );
}

function DeskTicket({ order, session, onChange, patchOrder }) {
  const left = remainingMs(order);
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [track, setTrack] = useState(order.tracking || "");
  const [carrier, setCarrier] = useState(guessCarrier(order));
  const needsTrack = pick === "sent";
  const changed = Boolean(pick) && (pick !== order.status || (needsTrack && track.trim() && (track.trim() !== (order.tracking || "") || carrier !== guessCarrier(order))));
  const chosen = changed && (!needsTrack || track.trim());

  async function confirm() {
    if (!chosen || busy) return;
    const next = pick;
    const tracking = next === "sent" ? track.trim() : order.tracking;
    const postedCarrier = next === "sent" ? carrier : order.carrier;
    patchOrder?.(order.id, { status: next, tracking, carrier: postedCarrier });
    setPick("");
    setBusy(true);
    setNote(`Updated to ${labelStatus(next)}.`);
    const posted = { ...order, status: next, tracking, carrier: postedCarrier };
    try {
      await store.setOrderStatus({ deskPin: session.deskPin, id: order.id, status: next, tracking, carrier: postedCarrier });
      if (next === "processing" && order.status !== "processing") notify("confirmed", posted);
      if (next === "shipped" && order.status !== "shipped") notify("prepared", posted);
      if (next === "sent" && (order.status !== "sent" || tracking !== (order.tracking || "") || postedCarrier !== guessCarrier(order))) notify("tracking", posted);
      onChange();
    } catch (error) {
      setNote(error.message);
      onChange();
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="ticket">
      <div className="ticket-h">
        <span>#{order.id} · No. {order.account ?? "—"} · {order.accountName || order.contact?.fullName}</span>
        <span className={`badge ${order.status}`}>{labelStatus(order.status)}</span>
      </div>
      <p className="tiny">
        {order.contact?.email ? `${order.contact.email} · ` : ""}
        {order.contact?.line1}, {order.contact?.city} {order.contact?.state} {order.contact?.zip}
      </p>
      {order.status === "unpaid" && <p className="timer">Waiting on their receipt · {fmtRemain(left)}</p>}
      {order.items.map((l, i) => (
        <div className="line" key={i}>
          <span>{l.name} · {l.sku} ×{l.qty}</span>
          <b>{money(l.price * l.qty)}</b>
        </div>
      ))}
      {order.status === "sent" && order.tracking && (
        <p>Tracking: <a href={trackHref(order)} target="_blank" rel="noreferrer">{order.tracking}</a></p>
      )}
      <p>Total {money(order.total)}</p>
      <div className="row-btns">
        {["review", "processing", "shipped", "sent", "history"].map((st) => (
          <button
            key={st}
            type="button"
            className={pick === st ? "btn slim picked" : "btn slim"}
            onClick={() => { setPick(st); setNote(""); }}
          >
            {labelStatus(st)}
          </button>
        ))}
      </div>
      {chosen && <p className="tiny">Selected: {labelStatus(pick)}. Nothing is sent until you confirm.</p>}
      {needsTrack && (
        <>
          <label>
            Tracking number
            <input value={track} onChange={(e) => setTrack(e.target.value)} placeholder="Paste the tracking number" />
          </label>
          <div className="row-btns">
            <button type="button" className={carrier === "usps" ? "btn slim picked" : "btn slim"} onClick={() => setCarrier("usps")}>USPS</button>
            <button type="button" className={carrier === "fedex" ? "btn slim picked" : "btn slim"} onClick={() => setCarrier("fedex")}>FedEx</button>
          </div>
          <p className="tiny">The link opens the carrier you pick here, not the one they paid for.</p>
        </>
      )}
      <button className="btn gold" type="button" disabled={!chosen || busy} onClick={confirm}>
        {busy ? "Updating…" : "Confirm order update"}
      </button>
      {note && <p className="muted">{note}</p>}
      {(order.receipts || []).map((r, i) => (
        <ReceiptPic key={r.path || i} session={session} path={r.path} name={r.name} />
      ))}
    </article>
  );
}

function ShelfPay({ session, pay, onPay }) {
  const [form, setForm] = useState({
    ownerName: pay?.ownerName || CONFIG.pay.ownerName,
    venmo: pay?.venmo || CONFIG.pay.venmo,
    cashApp: pay?.cashApp || CONFIG.pay.cashApp,
    chime: pay?.chime || CONFIG.pay.chime,
  });
  const [note, setNote] = useState("");
  async function save(e) {
    e.preventDefault();
    try {
      const saved = await store.savePay({ deskPin: session.deskPin, pay: form });
      onPay(saved.pay || {});
      setNote("Payment lines saved. They show on the next order email.");
    } catch (error) {
      setNote(error.message);
    }
  }
  return (
    <form className="panel" onSubmit={save}>
      <h3>How members pay</h3>
      <p className="tiny">Leave a line blank to hide it. These are not stored in the website file.</p>
      {[["ownerName", "Name on the accounts"], ["venmo", "Venmo"], ["cashApp", "Cash App"], ["chime", "Chime"]].map(([key, label]) => (
        <label key={key}>{label}
          <input value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
        </label>
      ))}
      <button className="btn gold" type="submit">Save payment lines</button>
      {note && <p className="tiny">{note}</p>}
    </form>
  );
}

function ShelfStock({ session, stock, onStock }) {
  const rows = PRODUCTS.flatMap((product) => product.sizes.map((size) => ({ ...size, name: product.name })));
  const [draft, setDraft] = useState(() => Object.fromEntries(rows.map((row) => [row.sku, stock?.[row.sku] ?? ""])));
  const [note, setNote] = useState("");
  async function save(sku) {
    try {
      const raw = draft[sku];
      const saved = await store.setStock({ deskPin: session.deskPin, sku, qty: raw === "" ? "" : Number(raw) });
      onStock(saved.stock || {});
      setNote(`${sku} updated.`);
    } catch (error) {
      setNote(error.message);
    }
  }
  return (
    <div className="panel">
      <h3>On the shelf</h3>
      <p className="tiny">The sheet is the count. A number you save here sticks until that row's On hand cell changes on the sheet. At 0 it cannot be added.</p>
      {rows.map((row) => (
        <div className="line" key={row.sku}>
          <span>{row.name} · {row.sku}</span>
          <span>
            <input style={{ width: 70 }} value={draft[row.sku]} onChange={(e) => setDraft({ ...draft, [row.sku]: e.target.value })} />
            <button className="btn slim" type="button" onClick={() => save(row.sku)}>Save</button>
          </span>
        </div>
      ))}
      {note && <p className="tiny">{note}</p>}
    </div>
  );
}

function labelStatus(s) {
  return {
    unpaid: "Unpaid",
    review: "Payment under review",
    processing: "Payment confirmed",
    shipped: "Being prepared",
    sent: "Shipped",
    expired: "Expired",
    history: "Closed",
  }[s] || s;
}

function AdminDesk({ session, stock, pay, onStock, onPay }) {
  const [members, setMembers] = useState([]);
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!session?.deskPin) {
      setErr("Sign out, then open the shop desk again.");
      return;
    }
    store.deskBook(session.deskPin).then((data) => {
      setLink(data.url || "");
      setMembers(data.members || []);
    }).catch((e) => setErr(e.message));
  }, [session]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="wrap">
      <h2>Desk</h2>
      <p className="muted">Account 0 is this door. Share the invite link. Every person who claims it gets the next number. A used number is not given out again.</p>
      {err && <p className="err">{err}</p>}
      {link && (
        <div className="panel">
          <p className="tiny">{link}</p>
          <button className="btn gold" type="button" onClick={copy}>{copied ? "Copied" : "Copy invite link"}</button>
        </div>
      )}
      {members.length > 0 && (
        <div className="panel">
          <h3>Members</h3>
          {members.map((c) => (
            <p key={c.account} className="tiny">No. {c.account} · {c.name}{c.email ? ` · ${c.email}` : ""}</p>
          ))}
        </div>
      )}
      <p className="muted">Open tickets are on Active Orders. They update on their own.</p>
      <ShelfPay session={session} pay={pay} onPay={onPay} />
      <ShelfStock session={session} stock={stock} onStock={onStock} />
    </section>
  );
}