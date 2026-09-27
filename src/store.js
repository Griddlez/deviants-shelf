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

export function getState() {
  const s = load();
  return {
    session: s.session || null,
    cart: s.cart || [],
    orders: s.orders || [],
    nextId: s.nextId || 1001,
  };
}

export function setSession(session) {
  const s = getState();
  s.session = session;
  save(s);
}

export function clearSession() {
  const s = getState();
  s.session = null;
  s.cart = [];
  save(s);
}

export function setCart(cart) {
  const s = getState();
  s.cart = cart;
  save(s);
}

export function addOrder(order) {
  const s = getState();
  const id = s.nextId;
  const full = { ...order, id, placedAt: Date.now() };
  s.orders = [full, ...s.orders];
  s.nextId = id + 1;
  s.cart = [];
  save(s);
  return full;
}

export function updateOrder(id, patch) {
  const s = getState();
  s.orders = s.orders.map((o) => (o.id === id ? { ...o, ...patch } : o));
  save(s);
  return s.orders.find((o) => o.id === id);
}

export function allOrders() {
  return getState().orders;
}
