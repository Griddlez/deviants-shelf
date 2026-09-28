const KEY = "deviants-shelf-v1";

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}

function save(state) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

function bookOf(s) {
  if (!s.ledger || typeof s.ledger !== "object") {
    s.ledger = { next: 1, people: {}, used: [0], invites: [] };
  }
  if (!s.ledger.people) s.ledger.people = {};
  if (!Array.isArray(s.ledger.used)) s.ledger.used = [0];
  if (!s.ledger.used.includes(0)) s.ledger.used.push(0);
  if (!Array.isArray(s.ledger.invites)) s.ledger.invites = [];
  if (!s.ledger.next || s.ledger.next < 1) s.ledger.next = 1;
  return s.ledger;
}

function cleanPin(pin) {
  return String(pin || "").replace(/\s/g, "");
}

async function postBook(body) {
  const res = await fetch("/api/book", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "The book could not be reached.");
  return data;
}

export function cutCard(deskPin) {
  return postBook({ action: "cut", deskPin });
}

export async function listInvites(deskPin) {
  const data = await postBook({ action: "list", deskPin });
  return data.invites || [];
}

export function claimCard({ account, pin, name }) {
  return postBook({ action: "claim", account, pin, name });
}

export function signInCard({ name, pin }) {
  return postBook({ action: "sign", name, pin });
}

export function getState() {
  const s = load();
  return {
    session: s.session || null,
    cart: s.cart || [],
    orders: s.orders || [],
    nextId: s.nextId || 1001,
    ledger: s.ledger || null,
  };
}

export function setSession(session) {
  const s = load();
  s.session = session;
  save(s);
}

export function clearSession() {
  const s = load();
  s.session = null;
  s.cart = [];
  save(s);
}

export function setCart(cart) {
  const s = load();
  s.cart = cart;
  save(s);
}

export function addOrder(order) {
  const s = load();
  const id = s.nextId || 1001;
  const full = { ...order, id, placedAt: Date.now() };
  s.orders = [full, ...(s.orders || [])];
  s.nextId = id + 1;
  s.cart = [];
  save(s);
  return full;
}

export function updateOrder(id, patch) {
  const s = load();
  s.orders = (s.orders || []).map((o) => (o.id === id ? { ...o, ...patch } : o));
  save(s);
  return s.orders.find((o) => o.id === id);
}

export function allOrders() {
  return getState().orders;
}
