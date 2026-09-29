import { useEffect, useRef, useState } from "react";
import { CONFIG, PRODUCTS, quoteOrder } from "./data.js";
import { FLAVOR, ROW_ORDER } from "./flavor.js";
import * as store from "./store.js";
import { notify } from "./mail.js";

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
              <button className="roll-btn" type="button" onClick={() => { setOpen(true); if (!pin) setPin(freshPin()); }}>
                <img src="/art/scroll-shut.webp" alt="A sealed scroll" />
              </button>
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
          <svg className="basket-mark" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 9h16l-1.4 9.2a2 2 0 0 1-2 1.8H7.4a2 2 0 0 1-2-1.8L4 9z" />
            <path d="M8 9c0-3 1.8-5 4-5s4 2 4 5" />
            <path d="M8 13h8M9 16.5h6" />
          </svg>
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
                  <div>
                    <b className="sku">{s.sku}</b> <span className="mg">{s.mg}</span>
                  </div>
                  <div className="row-r">
                    <span>{money(s.vial)}</span>
                    {typeof stock?.[s.sku] === "number" && <span className="tiny">{stock[s.sku]} left</span>}
                    {s.coa?.file && (
                      <button
                        className="btn slim coa"
                        onClick={() => setCoa({ ...s, name: p.name })}
                      >
                        COA
                      </button>
                    )}
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

function PlaceOrder({ session, cart, setCart, onClose, onPlaced }) {
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
          <h3 className="label">Shipping</h3>
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
            <h3 className="label">Discount codes</h3>
            <p className="tiny">Two codes at most. Friends and family, hand delivery, or military.</p>
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
      <p className="tiny">Leave a line blank and save it to stop counting that one. A number is how many are left. At 0 it cannot be added.</p>
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