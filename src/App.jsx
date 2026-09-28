import { useEffect, useMemo, useState } from "react";
import { CONFIG, PRODUCTS } from "./data.js";
import * as store from "./store.js";

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
  const [openId, setOpenId] = useState("r3");
  const [cart, setCart] = useState(() => store.getState().cart);
  const [orders, setOrders] = useState(() => store.getState().orders);
  const [flow, setFlow] = useState(null);
  const [flash, setFlash] = useState(null);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  function refresh() {
    const s = store.getState();
    setSession(s.session);
    setCart(s.cart);
    setOrders(s.orders);
  }

  if (!session) {
    return <Gate onIn={refresh} />;
  }

  const live = orders.filter((o) => o.status !== "history" && o.status !== "expired");
  const past = orders.filter((o) => o.status === "history" || o.status === "expired");

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <img className="logo" src="/art/logo.jpg" alt="The Deviant's Shelf" />
        </div>
        <div className="top-actions">
          <button className="btn gold" onClick={() => { setTab("order"); setFlow({ step: "ship" }); }}>
            Place Order
          </button>
          <div className="acct">Account No. {session.account}</div>
        </div>
      </header>
      <div className="filigree" aria-hidden="true" />

      <nav className="tabs">
        <button className={tab === "catalog" ? "on" : ""} onClick={() => setTab("catalog")}>Catalog</button>
        <button className={tab === "active" ? "on" : ""} onClick={() => setTab("active")}>
          Active Orders{live.length ? ` (${live.length})` : ""}
        </button>
        <button className={tab === "history" ? "on" : ""} onClick={() => setTab("history")}>History</button>
        {session.admin && (
          <button className={tab === "admin" ? "on" : ""} onClick={() => setTab("admin")}>Desk</button>
        )}
      </nav>

      {tab === "catalog" && (
        <Catalog
          openId={openId}
          setOpenId={setOpenId}
          cart={cart}
          onAdd={(line) => {
            const next = [...cart, line];
            store.setCart(next);
            setCart(next);
          }}
        />
      )}

      {tab === "active" && (
        <OrderList
          tick={tick}
          title="Active Orders"
          subtitle="Orders in the queue or on the way."
          orders={live}
          onChange={refresh}
          setFlash={setFlash}
        />
      )}

      {tab === "history" && (
        <OrderList
          tick={tick}
          title="History"
          subtitle="Closed and expired tickets."
          orders={past}
          onChange={refresh}
          setFlash={setFlash}
        />
      )}

      {tab === "admin" && session.admin && <AdminDesk orders={orders} onChange={refresh} />}

      {(tab === "order" || flow) && tab === "order" && (
        <PlaceOrder
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

function Gate({ onIn }) {
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");

  function enter(e) {
    e.preventDefault();
    const p = pin.trim();
    const admin = p === CONFIG.adminPin;
    if (p !== CONFIG.memberPin && !admin) {
      setErr("That PIN is not on this shelf.");
      return;
    }
    const account = String(1000 + Math.floor(Math.random() * 9000));
    store.setSession({
      name: name.trim().slice(0, 20) || "Member",
      account,
      admin,
    });
    onIn();
  }

  return (
    <div className="gate">
      <img className="logo gate-logo" src="/art/logo.jpg" alt="The Deviant's Shelf" />
      <div className="filigree" aria-hidden="true" />
      <p className="eyebrow">Members only</p>
      <p className="lede">{CONFIG.tagline}</p>
      <p className="muted">Invitation-only catalog. Sign in with the name on your card and the PIN your rep set.</p>
      <form className="panel" onSubmit={enter}>
        <label>Name on card</label>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} placeholder="Your name" />
        <label>PIN</label>
        <input value={pin} onChange={(e) => setPin(e.target.value)} inputMode="numeric" placeholder="••••" />
        {err && <p className="err">{err}</p>}
        <button className="btn gold wide" type="submit">Enter</button>
      </form>
    </div>
  );
}

function Catalog({ openId, setOpenId, cart, onAdd }) {
  const [q, setQ] = useState("");
  const [coa, setCoa] = useState(null);
  const list = PRODUCTS.filter((p) => {
    const hay = `${p.code} ${p.name} ${p.sizes.map((s) => s.sku).join(" ")}`.toLowerCase();
    return hay.includes(q.trim().toLowerCase());
  });
  const count = cart.reduce((n, l) => n + l.qty, 0);

  return (
    <section className="wrap">
      <h2>Catalog</h2>
      <p className="muted">Current availability and pricing. Vial = 1 vial. COA is the lab report for that lot.</p>
      <div className="tools">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products" />
        <span className="muted">{count} in order</span>
      </div>
      {list.map((p) => (
        <article key={p.id} className="acc">
          <button className="acc-h" onClick={() => setOpenId(openId === p.id ? "" : p.id)}>
            <span>{openId === p.id ? "▼" : "▶"} {p.name}</span>
            <em>{p.code}</em>
          </button>
          {openId === p.id && (
            <div className="acc-b">
              <p className="blurb">{p.blurb}</p>
              {p.sizes.map((s) => (
                <div className="row" key={s.sku}>
                  <div>
                    <b className="sku">{s.sku}</b> <span className="mg">{s.mg}</span>
                  </div>
                  <div className="row-r">
                    <span>{money(s.vial)}</span>
                    <button
                      className="btn slim coa"
                      onClick={() => setCoa({ ...s, name: p.name })}
                    >
                      COA
                    </button>
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
                      ADD Vial
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
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

function PlaceOrder({ cart, setCart, onClose, onPlaced }) {
  const [step, setStep] = useState("ship");
  const [shipId, setShipId] = useState("usps");
  const [contact, setContact] = useState({
    fullName: "",
    line1: "",
    line2: "",
    city: "",
    state: "",
    zip: "",
    email: "",
  });
  const [ruo, setRuo] = useState(false);
  const [slid, setSlid] = useState(false);

  const ship = CONFIG.shipping.find((s) => s.id === shipId);
  const sub = cart.reduce((n, l) => n + l.price * l.qty, 0);
  const total = sub + (ship?.price || 0);

  function place() {
    if (!ruo || !slid || !cart.length) return;
    const order = store.addOrder({
      status: "unpaid",
      items: cart,
      shipping: ship,
      contact,
      sub,
      total,
      receipts: [],
    });
    onPlaced(order);
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
              <span>{l.name} · {l.sku} · {l.mg} · vial ×{l.qty}</span>
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
          <button className={slid ? "slide on" : "slide"} type="button" onClick={() => setSlid(true)}>
            {slid ? "Confirmed" : "Slide right to confirm →"}
          </button>
          <button className="btn gold wide" disabled={!ruo || !slid} onClick={place}>
            Place order
          </button>
        </div>
      )}
    </section>
  );
}

function CartBox({ cart, setCart }) {
  if (!cart.length) return <p className="muted">0 items — add vials from the catalog first, then come back.</p>;
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
            {CONFIG.pay.venmo && <li>Venmo · {CONFIG.pay.venmo}</li>}
            {CONFIG.pay.zelle && <li>Zelle · {CONFIG.pay.zelle}</li>}
            {CONFIG.pay.cashApp && <li>Cash App · {CONFIG.pay.cashApp}</li>}
            {CONFIG.pay.chime && <li>Chime · {CONFIG.pay.chime}</li>}
            <li>Crypto · {CONFIG.pay.crypto}</li>
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

function OrderList({ title, subtitle, orders, onChange, tick, setFlash }) {
  return (
    <section className="wrap">
      <h2>{title}</h2>
      <p className="muted">{subtitle}</p>
      {!orders.length && <p className="muted">Nothing here yet.</p>}
      {orders.map((o) => (
        <OrderCard key={o.id} order={o} tick={tick} onChange={onChange} />
      ))}
    </section>
  );
}

function OrderCard({ order, onChange, tick }) {
  const left = remainingMs(order);
  const expired = order.status === "unpaid" && left <= 0;
  useEffect(() => {
    if (expired && order.status === "unpaid") {
      store.updateOrder(order.id, { status: "expired" });
      onChange();
    }
  }, [expired, order.id, order.status, onChange]);

  function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      store.updateOrder(order.id, {
        status: "review",
        receipts: [...(order.receipts || []), { name: file.name, data: reader.result, at: Date.now() }],
      });
      onChange();
    };
    reader.readAsDataURL(file);
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
          <span>{l.name} · {l.sku} · {l.mg} · vial ×{l.qty}</span>
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
      {order.status === "shipped" && <p>Shipped.</p>}
      {(order.receipts || []).map((r, i) => (
        <p key={i} className="tiny">Receipt {i + 1}: {r.name}</p>
      ))}
    </article>
  );
}

function labelStatus(s) {
  return {
    unpaid: "Unpaid",
    review: "Payment under review",
    processing: "Processing",
    shipped: "Shipped",
    expired: "Expired",
    history: "Closed",
  }[s] || s;
}

function AdminDesk({ orders, onChange }) {
  return (
    <section className="wrap">
      <h2>Desk</h2>
      <p className="muted">
        This desk only sees tickets placed in this browser. For the 15-person shelf, open Desk on the same device you will check, or we wire a shared inbox next.
      </p>
      {orders.map((o) => (
        <article className="ticket" key={o.id}>
          <div className="ticket-h">
            <span>#{o.id} · {o.contact?.fullName}</span>
            <span className={`badge ${o.status}`}>{labelStatus(o.status)}</span>
          </div>
          <p className="tiny">
            {o.contact?.line1}, {o.contact?.city} {o.contact?.state} {o.contact?.zip}
          </p>
          {o.items.map((l, i) => (
            <div className="line" key={i}>
              <span>{l.sku} ×{l.qty}</span>
              <b>{money(l.price * l.qty)}</b>
            </div>
          ))}
          <p>Total {money(o.total)}</p>
          <div className="row-btns">
            {["review", "processing", "shipped", "history"].map((st) => (
              <button key={st} className="btn slim" onClick={() => { store.updateOrder(o.id, { status: st }); onChange(); }}>
                {labelStatus(st)}
              </button>
            ))}
          </div>
          {(o.receipts || []).map((r, i) => (
            <img key={i} src={r.data} alt={r.name} className="rcpt" />
          ))}
        </article>
      ))}
    </section>
  );
}
