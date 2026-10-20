import { mock } from "node:test";
import { Readable } from "node:stream";

const blobs = new Map();

mock.module("@vercel/blob", {
  namedExports: {
    async get(path) {
      const value = blobs.get(path);
      if (value == null) return null;
      return { stream: Readable.from([Buffer.from(value)]) };
    },
    async put(path, body) {
      const text = Buffer.isBuffer(body) ? body.toString("utf8") : String(body);
      blobs.set(path, text);
      return { pathname: path };
    },
    async list({ prefix = "" } = {}) {
      return {
        blobs: [...blobs.keys()].filter((key) => key.startsWith(prefix)).map((pathname) => ({ pathname })),
      };
    },
  },
});

global.fetch = async () => ({ ok: false, status: 404, text: async () => "" });
process.env.DESK_PIN = "desk-test";

const { default: handler } = await import("../api/book.js");

function seed() {
  blobs.clear();
  blobs.set("ledger.json", JSON.stringify({
    next: 3,
    used: [0, 1],
    people: {
      Tester: { name: "Tester", account: "2", pin: "test-pin", email: "tester@example.com", cart: [] },
      "Laura Wilson": { name: "Laura Wilson", account: "40", pin: "laura-pin", email: "laura.leigh76@hotmail.com", cart: [], address: { fullName: "Laura Wilson", line1: "10 Test St", city: "Macon", state: "GA", zip: "31201" } },
    },
    invites: [],
    orders: [],
    nextOrder: 1100,
    stock: { "R3-5": 20, "KIT-1": 20 },
    pay: {},
    coaLibrary: [{ slug: "seed" }],
    coaSeeded: true,
    subscribers: [{ email: "tester@example.com", at: 1 }],
    rev: 1,
  }));
}

function call(body) {
  const res = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
  return handler({ method: "POST", body }, res).then(() => res);
}

const laura = {
  name: "Laura Wilson",
  pin: "laura-pin",
  order: {
    items: [
      { sku: "R3-5", name: "Retatrutide", charge: "Ember's Fast", mg: "5 mg", price: 45, qty: 1 },
      { sku: "KIT-1", name: "BAC water · 10 syringes · 20 wipes", charge: "Beginner's Alchemy Kit", mg: "kit", price: 15, qty: 1 },
    ],
    shipping: { id: "usps", label: "USPS", price: 9.99 },
    codes: ["HNDLVR"],
    contact: { fullName: "Laura Wilson", line1: "10 Test St", city: "Macon", state: "GA", zip: "31201", email: "laura.leigh76@hotmail.com" },
  },
};

let failed = 0;
function check(name, ok, detail = "") {
  if (ok) console.log(`PASS  ${name}`);
  else {
    failed += 1;
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

seed();
const placed = await call({ action: "place", ...laura });
check("hand-delivery order is accepted", placed.statusCode === 200, JSON.stringify(placed.body));
const order = placed.body || {};
check("total is $60", order.total === 60, `total ${order.total}`);
check("shipping is free", order.shipping?.price === 0 && order.shipping?.label === "Hand delivery", JSON.stringify(order.shipping));
check("both items are stored", (order.items || []).map((line) => line.sku).sort().join() === "KIT-1,R3-5", JSON.stringify(order.items));
check("flavor name is stored", (order.items || []).some((line) => line.charge === "Ember's Fast"));

const desk = await call({ action: "orders", deskPin: "desk-test" });
const ids = (desk.body?.orders || []).map((row) => row.id);
check("desk can see the new order", ids.includes(order.id), `ids ${ids.join(",")}`);
check("stock falls by the vials ordered", desk.body?.stock?.["R3-5"] === 19 && desk.body?.stock?.["KIT-1"] === 19, JSON.stringify(desk.body?.stock));

const member = await call({ action: "orders", name: "Tester", pin: "test-pin" });
check("another member cannot see it", !(member.body?.orders || []).some((row) => row.id === order.id));

const lauraList = await call({ action: "orders", name: "Laura Wilson", pin: "laura-pin" });
check("Laura can see her order", (lauraList.body?.orders || []).some((row) => row.id === order.id));

const denied = await call({ action: "place", name: "Laura Wilson", pin: "nope", order: laura.order });
check("bad password is rejected", denied.statusCode === 401);

const empty = await call({ action: "place", name: "Laura Wilson", pin: "laura-pin", order: { ...laura.order, items: [] } });
check("empty basket is rejected", empty.statusCode !== 200);

seed();
const burst = await Promise.all(Array.from({ length: 6 }, () => call({ action: "place", ...laura })));
const made = burst.filter((row) => row.statusCode === 200).map((row) => row.body);
const unique = new Set(made.map((row) => row.id));
check("six orders at once all save", made.length === 6, `saved ${made.length}`);
check("six orders at once get six ids", unique.size === 6, `ids ${[...unique].join(",")}`);
const after = await call({ action: "orders", deskPin: "desk-test" });
const kept = (after.body?.orders || []).filter((row) => made.some((item) => item.placeToken && item.placeToken === row.placeToken) || made.some((item) => item.id === row.id && (item.items || []).length === (row.items || []).length));
check("none of the six were overwritten", made.every((item) => (after.body?.orders || []).some((row) => row.id === item.id && (row.items || []).length === 2)), `book ${(after.body?.orders || []).map((row) => row.id).join(",")}`);

const stock = after.body?.stock || {};
check("stock dropped once per order", stock["R3-5"] === 20 - made.length, `R3-5 ${stock["R3-5"]}`);

seed();
const racing = call({ action: "place", ...laura });
await Promise.all([racing, call({ action: "orders", deskPin: "desk-test" }), call({ action: "orders", deskPin: "desk-test" })]);
const landed = await racing;
const finalBook = await call({ action: "orders", deskPin: "desk-test" });
check("an order survives a desk refresh", (finalBook.body?.orders || []).some((row) => row.account === "40" && (row.items || []).some((line) => line.sku === "R3-5")), `status ${landed.statusCode}`);

seed();
const emptyBook = JSON.parse(blobs.get("ledger.json"));
emptyBook.stock["R3-5"] = 0;
blobs.set("ledger.json", JSON.stringify(emptyBook));
const soldOut = await call({ action: "place", ...laura });
check("a sold-out vial is refused", soldOut.statusCode !== 200, JSON.stringify(soldOut.body));

if (failed) {
  console.log(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nAll order tests passed");
