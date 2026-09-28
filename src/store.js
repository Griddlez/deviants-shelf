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
    s.ledger = { next: 1, people: {}, used: [0] };
  }
  if (!s.ledger.people) s.ledger.people = {};
  if (!Array.isArray(s.ledger.used)) s.ledger.used = [0];
  if (!s.ledger.used.includes(0)) s.ledger.used.push(0);
  if (!s.ledger.next || s.ledger.next < 1) s.ledger.next = 1;
  return s.ledger;
}

function norm(name) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

// Account 0 is the shop desk. Member numbers start at 1 and only go up.
export function claimAccount({ name, desk }) {
  const display = name.trim().slice(0, 20);
  if (!display) {
    const err = new Error("Type the name this account should keep.");
    err.code = "name";
    throw err;
  }
  const key = norm(display);
  const s = load();
  const book = bookOf(s);

  if (desk) {
    book.people[key] = { account: 0, name: display };
    save(s);
    return { account: "0", name: display };
  }

  const existing = book.people[key];
  if (existing) return { account: String(existing.account), name: existing.name };

  let n = book.next;
  while (book.used.includes(n)) n += 1;
  book.people[key] = { account: n, name: display };
  book.used.push(n);
  book.next = n + 1;
  save(s);
  return { account: String(n), name: display };
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
