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

// Cuts the next card. 0 stays the desk. Used numbers are never issued again.
export function cutCard() {
  const s = load();
  const book = bookOf(s);
  let n = book.next;
  while (book.used.includes(n) || n === 0) n += 1;
  const pin = String(Math.floor(100000 + Math.random() * 900000));
  book.used.push(n);
  book.next = n + 1;
  const card = { account: n, pin, at: Date.now() };
  book.invites.unshift(card);
  save(s);
  const url = `${location.origin}/?card=${n}.${pin}`;
  return { ...card, url };
}

export function listInvites() {
  return bookOf(load()).invites;
}

export function claimCard({ account, pin, name }) {
  const display = String(name || "").trim().slice(0, 24);
  const pinClean = cleanPin(pin);
  const n = Number(account);
  if (!display) throw new Error("Type the name for this card.");
  if (!/^\d{4,8}$/.test(pinClean)) throw new Error("Use a PIN of 4 to 8 digits.");
  if (!Number.isInteger(n) || n < 1) throw new Error("This card is not valid.");
  const s = load();
  const book = bookOf(s);
  const taken = book.people[display];
  if (taken && taken.account !== n) throw new Error("That name is already on another card.");
  const owner = Object.values(book.people).find((p) => p.account === n);
  if (owner && owner.name !== display) throw new Error("This card was already claimed under a different name.");
  book.people[display] = { account: n, name: display, pin: pinClean };
  if (!book.used.includes(n)) book.used.push(n);
  if (book.next <= n) book.next = n + 1;
  save(s);
  return { account: String(n), name: display };
}

export function signInCard({ name, pin }) {
  const display = String(name || "").trim();
  const person = bookOf(load()).people[display];
  if (!person || person.pin !== cleanPin(pin)) {
    throw new Error("That name and PIN do not match a card on this phone. Type the name exactly as it was claimed.");
  }
  return { account: String(person.account), name: person.name };
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
