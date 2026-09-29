const KEY = "deviants-shelf-v1";
const DOOR = "deviants-shelf-door";

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

function readDoor() {
  try {
    return JSON.parse(sessionStorage.getItem(DOOR) || "null");
  } catch {
    return null;
  }
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

export function deskBook(deskPin) {
  return postBook({ action: "list", deskPin });
}

export function joinCard({ token, pin, name }) {
  return postBook({ action: "join", token, pin, name });
}

export function claimCard({ account, pin, name }) {
  return postBook({ action: "claim", account, pin, name });
}

export function signInCard({ name, pin }) {
  return postBook({ action: "sign", name, pin });
}

export function saveCard({ name, pin, email, nextPin }) {
  return postBook({ action: "save", name, pin, email, nextPin });
}

export function placeOrder({ name, pin, order }) {
  return postBook({ action: "place", name, pin, order });
}

export function ping(session) {
  if (session?.admin) return postBook({ action: "ping", deskPin: session.deskPin });
  return postBook({ action: "ping", name: session?.name, pin: session?.pin });
}

export function listOrders(session) {
  if (session?.admin) return postBook({ action: "orders", deskPin: session.deskPin });
  return postBook({ action: "orders", name: session?.name, pin: session?.pin });
}

export function setOrderStatus({ deskPin, id, status, tracking, carrier }) {
  return postBook({ action: "status", deskPin, id, status, tracking, carrier });
}

export function addReceipt({ name, pin, id, data, fileName }) {
  return postBook({ action: "receipt", name, pin, id, data, fileName });
}

export function receiptImage(session, path) {
  if (session?.admin) return postBook({ action: "picture", deskPin: session.deskPin, path });
  return postBook({ action: "picture", name: session?.name, pin: session?.pin, path });
}

export function getState() {
  const s = load();
  return {
    session: readDoor(),
    cart: s.cart || [],
    orders: s.orders || [],
    nextId: s.nextId || 1001,
    ledger: s.ledger || null,
  };
}

export function setSession(session) {
  sessionStorage.setItem(DOOR, JSON.stringify(session));
}

export function clearSession() {
  sessionStorage.removeItem(DOOR);
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
