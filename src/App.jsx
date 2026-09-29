import { useEffect, useRef, useState } from "react";
import { CONFIG, PRODUCTS } from "./data.js";
import { FLAVOR, ROW_ORDER } from "./flavor.js";
import * as store from "./store.js";
import { notify } from "./mail.js";

function money(n) {
  return `$${Number(n).toFixed(0)}`;
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
          onBasket={() => { setTab("order"); setFlow({ step: "ship" }); }}
          onAdd={(line) => {
            const next = cart.some((item) => item.sku === line.sku)
              ? cart.map((item) => (item.sku === line.sku ? { ...item, qty: item.qty + 1 } : item))
              : [...cart, line];
            store.setCart(next);
            setCart(next);
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

      {tab === "admin" && session.admin && <AdminDesk session={session} orders={orders} onChange={refresh} />}

      {(tab === "order" || flow) && tab === "order" && (
        <PlaceOrder
          session={session}
          cart={cart}
          setCart={(c) => { store.setCart(c); setCart(c); }}
          onClose={() => { setFlow(null); setTab("catalog"); }}
          onPlaced={(order) => {
            refresh();
            setFlow(null);
            setTab("active");
            setFlash(order);
          }}
        />
      )}

      {flash && <PlacedModal order={flash} onClose={() => setFlash(null)} />}

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
      store.setSession({ name: claimed.name, account: claimed.account, admin: false, pin: pin.replace(/\s/g, ""), email: claimed.email || "" });
      onIn();
    } catch (error) {
      setErr(error.message);
    }
  }

  function openDesk(e) {
    e.preventDefault();
    if (pin.replace(/\s/g, "") !== CONFIG.adminPin) {
      setErr("That desk PIN is not right.");
      return;
    }
    const display = name.trim().slice(0, 24);
    if (!display) {
      setErr("Type your name.");
      return;
    }
    store.setSession({ name: display, account: "0", admin: true, deskPin: pin.replace(/\s/g, "") });
    onIn();
  }

  async function claim(e) {
    e.preventDefault();
    if (!adult) {
      setErr("You have to be 21 or older to claim a card.");
      return;
    }
    try {
      const claimed = door
        ? await store.joinCard({ token: door, pin, name })
        : await store.claimCard({ account: invite.account, pin, name });
      store.setSession({ name: claimed.name, account: claimed.account, admin: false, pin: pin.replace(/\s/g, ""), email: claimed.email || "" });
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
          <p className="eyebrow">You have been invited by</p>
          <p className="lede">{CONFIG.shopName}</p>
          {!open ? (
            <button className="pass pass-closed" type="button" onClick={() => { setOpen(true); if (!pin) setPin(freshPin()); }}>
              <img className="pass-art" src="/art/logo.jpg" alt="The Deviant's Shelf" />
              <span>Tap to open</span>
            </button>
          ) : (
            <form className="pass" onSubmit={claim}>
              <div className="pass-top">
                <img className="pass-mark tiny-mark" src="/art/crest.jpg" alt="" />
                <span className="pass-pill">Member</span>
              </div>
              <img className="pass-word" src="/art/logo.jpg" alt="The Deviant's Shelf" />
              <p className="pass-label">Member no.</p>
              <p className="pass-no">{invite ? invite.account : "····"}</p>
              <label>Name on card</label>
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} placeholder="Your name" required />
              <label>PIN</label>
              <p className="tiny">Type your own, or keep the one shown. 4 to 8 digits.</p>
              <div className="row-btns">
                <input value={pin} onChange={(e) => setPin(e.target.value)} inputMode="numeric" autoComplete="off" />
                <button className="btn slim" type="button" onClick={() => setPin(freshPin())}>New PIN</button>
              </div>
              {err && <p className="err">{err}</p>}
              <label className="check">
                <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} />
                You are 21 or older.
              </label>
              <button className="btn gold wide" type="submit" disabled={!adult}>Claim your card</button>
              <p className="tiny">Your name is saved exactly as you type it. Sign in the same way later. You can keep this PIN or change it before you claim.</p>
            </form>
          )}
          <p className="tiny">A card has been prepared for you.</p>
        </>
      )}

      {view === "welcome" && (
        <>
          <button className="pass pass-closed" type="button" onClick={() => { setView("signin"); setErr(""); }}>
            <img className="pass-art" src="/art/logo.jpg" alt="The Deviant's Shelf" />
          </button>
          <p className="lede">Have you been invited?</p>
          <p className="muted">This shelf is invitation-only. Open the invite link to claim a card. Each person who claims it gets their own number. Already have a card? Sign in with that name and PIN.</p>
          <button className="btn gold wide" type="button" onClick={() => { setView("signin"); setErr(""); }}>Sign in</button>
          <button className="tinybtn" type="button" onClick={() => { setView("desk"); setErr(""); setPin(""); }}>Shop desk</button>
        </>
      )}

      {view === "signin" && (
        <form className="panel" onSubmit={signIn}>
          <p className="eyebrow">Sign in</p>
          <label>Name on card</label>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} placeholder="Your name" required />
          <label>PIN</label>
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

function Catalog({ openId, setOpenId, cart, onAdd, onBasket }) {
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
  const [contact, setContact] = useState({
    fullName: "",
    line1: "",
    line2: "",
    city: "",
    state: "",
    zip: "",
    email: session.email || "",
  });
  const [ruo, setRuo] = useState(false);
  const [slid, setSlid] = useState(false);

  const ship = CONFIG.shipping.find((s) => s.id === shipId);
  const sub = cart.reduce((n, l) => n + l.price * l.qty, 0);
  const total = sub + (ship?.price || 0);

  const [err, setErr] = useState("");

  async function place() {
    if (!ruo || !slid || !cart.length) return;
    try {
      const order = await store.placeOrder({
        name: session.name,
        pin: session.pin,
        order: {
          items: cart,
          shipping: ship,
          contact,
          sub,
          total,
        },
      });
      setCart([]);
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
          <CartBox cart={cart} setCart={setCart} />
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
          <div className="line"><span>Shipping · {ship.label}</span><b>{money(ship.price)}</b></div>
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

function CartBox({ cart, setCart }) {
  if (!cart.length) return <p className="muted">0 items — add from the catalog first, then come back.</p>;
  return (
    <div className="cart">
      {cart.map((l, i) => (
        <div className="line" key={i}>
          <span>{l.sku} ×{l.qty}</span>
          <span>
            {money(l.price * l.qty)}{" "}
            <button className="tinybtn" onClick={() => setCart(cart.filter((_, j) => j !== i))}>×</button>
          </span>
        </div>
      ))}
      <button className="btn slim" type="button" onClick={() => setCart([])}>Empty basket</button>
    </div>
  );
}

function PlacedModal({ order, onClose }) {
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
              ["Venmo", CONFIG.pay.venmo],
              ["Zelle", CONFIG.pay.zelle],
              ["Cash App", CONFIG.pay.cashApp],
              ["Chime", CONFIG.pay.chime],
            ].filter(([, value]) => value && !/^SET\b/i.test(value)).map(([label, value]) => (
              <li key={label}>{label} · {value}</li>
            ))}
            {CONFIG.pay.crypto && <li>Crypto · {CONFIG.pay.crypto}</li>}
          </ul>
          <p>All accounts are under the name {CONFIG.pay.ownerName}.</p>
          <p><b>No payment is taken in the app.</b></p>
        </div>
        <p>Ticket #{order.id} · {money(order.total)}</p>
        <button className="btn gold wide" onClick={onClose}>Got it</button>
      </div>
    </div>
  );
}

function OrderList({ title, subtitle, orders, onChange, tick, session, patchOrder }) {
  return (
    <section className="wrap">
      <h2>{title}</h2>
      <p className="muted">{subtitle}</p>
      {!orders.length && <p className="muted">Nothing here yet.</p>}
      {orders.map((o) => (
        session?.admin
          ? <DeskTicket key={o.id} order={o} session={session} onChange={onChange} patchOrder={patchOrder} />
          : <OrderCard key={o.id} order={o} tick={tick} onChange={onChange} session={session} patchOrder={patchOrder} />
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
      {(order.receipts || []).map((r, i) => (
        <ReceiptPic key={r.path || i} session={session} path={r.path} name={r.name} />
      ))}
    </article>
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
      });
      store.setSession({ ...session, email: saved.email, pin: saved.pin });
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
        <label>New PIN</label>
        <p className="tiny">Leave this blank to keep your PIN. Or type your own, or take a random one.</p>
        <div className="row-btns">
          <input value={nextPin} onChange={(e) => setNextPin(e.target.value)} inputMode="numeric" autoComplete="off" placeholder="4 to 8 digits" />
          <button className="btn slim" type="button" onClick={() => setNextPin(freshPin())}>New PIN</button>
        </div>
        {!session.pin && (
          <>
            <label>Current PIN</label>
            <input value={pin} onChange={(e) => setPin(e.target.value)} inputMode="numeric" autoComplete="off" />
          </>
        )}
        {err && <p className="err">{err}</p>}
        {msg && <p className="muted">{msg}</p>}
        <button className="btn gold" type="submit">Save</button>
      </form>
    </section>
  );
}

function DeskTicket({ order, session, onChange, patchOrder }) {
  const left = remainingMs(order);
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const chosen = pick && pick !== order.status;

  async function confirm() {
    if (!chosen || busy) return;
    const next = pick;
    patchOrder?.(order.id, { status: next });
    setPick("");
    setBusy(true);
    setNote(`Updated to ${labelStatus(next)}.`);
    try {
      await store.setOrderStatus({ deskPin: session.deskPin, id: order.id, status: next });
      if (next === "processing") notify("confirmed", order);
      if (next === "shipped") notify("prepared", order);
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
      <p>Total {money(order.total)}</p>
      <div className="row-btns">
        {["review", "processing", "shipped", "history"].map((st) => (
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

function labelStatus(s) {
  return {
    unpaid: "Unpaid",
    review: "Payment under review",
    processing: "Payment confirmed",
    shipped: "Being prepared",
    expired: "Expired",
    history: "Closed",
  }[s] || s;
}

function AdminDesk({ session, orders, onChange }) {
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
    </section>
  );
}