import { get, put } from "@vercel/blob";

const EMPTY = { next: 2, used: [0, 1], people: {}, invites: [] };

async function readBook() {
  const result = await get("ledger.json", { access: "private" });
  if (!result) return structuredClone(EMPTY);
  const text = await new Response(result.stream).text();
  const data = JSON.parse(text);
  if (!data || typeof data !== "object") return structuredClone(EMPTY);
  if (!Array.isArray(data.used)) data.used = [0, 1];
  if (!data.people) data.people = {};
  if (!Array.isArray(data.invites)) data.invites = [];
  if (!Array.isArray(data.orders)) data.orders = [];
  if (!data.nextOrder || data.nextOrder < 1001) data.nextOrder = 1001;
  if (!data.next || data.next < 1) data.next = 2;
  return data;
}

async function writeBook(book) {
  book.rev = (Number(book.rev) || 0) + 1;
  await put("ledger.json", JSON.stringify(book), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

function cleanPin(pin) {
  return String(pin || "").replace(/\s/g, "");
}

function makeToken() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let out = "";
  for (const byte of bytes) out += alphabet[byte % alphabet.length];
  return out;
}

function nextNumber(book) {
  let n = book.next || 1;
  while (book.used.includes(n) || n === 0) n += 1;
  return n;
}
function deskOk(pin) {
  const expected = process.env.DESK_PIN || "";
  return expected && cleanPin(pin) === expected;
}

function memberOk(book, name, pin) {
  const person = book.people[String(name || "").trim()];
  if (!person || person.pin !== cleanPin(pin)) return null;
  return person;
}

function sweep(book) {
  if (!Array.isArray(book.orders)) book.orders = [];
  if (!book.nextOrder || book.nextOrder < 1001) book.nextOrder = 1001;
  const limit = 24 * 3600 * 1000;
  let dirty = false;
  for (const order of book.orders) {
    if (order.status === "unpaid" && Date.now() > order.placedAt + limit) {
      order.status = "expired";
      dirty = true;
    }
  }
  return dirty;
}

function publicOrder(order) {
  return {
    ...order,
    receipts: (order.receipts || []).map(({ name, at, path }) => ({ name, at, path })),
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Use POST." });
    return;
  }
  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
  try {
    if (body.action === "cut") {
      if (!deskOk(body.deskPin)) {
        res.status(401).json({ error: "That desk PIN is not right." });
        return;
      }
      const book = await readBook();
      let n = book.next;
      while (book.used.includes(n) || n === 0) n += 1;
      const pin = String(Math.floor(100000 + Math.random() * 900000));
      book.used.push(n);
      book.next = n + 1;
      const card = { account: n, pin, at: Date.now(), name: "" };
      book.invites.unshift(card);
      await writeBook(book);
      const url = `https://thedeviantsshelf.com/?card=${n}.${pin}`;
      res.status(200).json({ account: n, pin, url });
      return;
    }
    if (body.action === "list") {
      if (!deskOk(body.deskPin)) {
        res.status(401).json({ error: "That desk PIN is not right." });
        return;
      }
      const book = await readBook();
      if (!book.door) {
        book.door = makeToken();
        await writeBook(book);
      }
      const members = Object.values(book.people)
        .sort((a, b) => a.account - b.account)
        .map((person) => ({ account: person.account, name: person.name, pin: person.pin, email: person.email || "" }));
      res.status(200).json({
        url: `https://thedeviantsshelf.com/invite/link/${book.door}`,
        members,
        invites: book.invites.map((c) => ({
          account: c.account,
          pin: c.pin,
          name: c.name || "",
        })),
      });
      return;
    }
    if (body.action === "join") {
      const display = String(body.name || "").trim().slice(0, 24);
      const pinClean = cleanPin(body.pin);
      if (!display) throw new Error("Type the name for this card.");
      if (!/^\d{4,8}$/.test(pinClean)) throw new Error("Use a PIN of 4 to 8 digits.");
      const book = await readBook();
      if (!book.door || book.door !== String(body.token || "")) throw new Error("This invite is not valid.");
      if (book.people[display]) throw new Error("That name is already on a card. Sign in, or use a different name.");
      const n = nextNumber(book);
      book.used.push(n);
      book.next = n + 1;
      book.people[display] = { account: n, name: display, pin: pinClean, email: "" };
      book.invites.unshift({ account: n, pin: pinClean, name: display, at: Date.now() });
      await writeBook(book);
      res.status(200).json({ account: String(n), name: display });
      return;
    }
    if (body.action === "claim") {
      const display = String(body.name || "").trim().slice(0, 24);
      const pinClean = cleanPin(body.pin);
      const n = Number(body.account);
      if (!display) throw new Error("Type the name for this card.");
      if (!/^\d{4,8}$/.test(pinClean)) throw new Error("Use a PIN of 4 to 8 digits.");
      const book = await readBook();
      const invite = book.invites.find((c) => c.account === n);
      if (!invite) throw new Error("This card is not in the book.");
      if (invite.name && invite.name !== display) throw new Error("This card was already claimed under a different name.");
      if (book.people[display] && book.people[display].account !== n) throw new Error("That name is already on another card.");
      invite.name = display;
      invite.pin = pinClean;
      if (!book.used.includes(n)) book.used.push(n);
      book.people[display] = { account: n, name: display, pin: pinClean, email: invite.email || "" };
      await writeBook(book);
      res.status(200).json({ account: String(n), name: display });
      return;
    }
    if (body.action === "sign") {
      const display = String(body.name || "").trim();
      const book = await readBook();
      const person = book.people[display];
      if (!person || person.pin !== cleanPin(body.pin)) {
        res.status(401).json({ error: "That name and PIN do not match a card. Type the name exactly as it was claimed." });
        return;
      }
      res.status(200).json({ account: String(person.account), name: person.name, email: person.email || "" });
      return;
    }
    if (body.action === "save") {
      const display = String(body.name || "").trim();
      const book = await readBook();
      const person = book.people[display];
      if (!person || person.pin !== cleanPin(body.pin)) {
        res.status(401).json({ error: "That PIN does not match this card." });
        return;
      }
      const email = String(body.email || "").trim().slice(0, 80);
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("That email does not look right.");
      const next = cleanPin(body.nextPin);
      if (next) {
        if (!/^\d{4,8}$/.test(next)) throw new Error("Use a PIN of 4 to 8 digits.");
        person.pin = next;
        const card = book.invites.find((c) => c.account === person.account);
        if (card) card.pin = next;
      }
      person.email = email;
      book.people[display] = person;
      await writeBook(book);
      res.status(200).json({ account: String(person.account), name: person.name, email, pin: person.pin });
      return;
    }
    if (body.action === "ping") {
      const book = await readBook();
      if (!deskOk(body.deskPin) && !memberOk(book, body.name, body.pin)) {
        res.status(401).json({ error: "Sign in again." });
        return;
      }
      res.status(200).json({ rev: Number(book.rev) || 0 });
      return;
    }
    if (body.action === "place") {
      const book = await readBook();
      const person = memberOk(book, body.name, body.pin);
      if (!person) {
        res.status(401).json({ error: "Sign in again before placing an order." });
        return;
      }
      const incoming = body.order || {};
      const items = Array.isArray(incoming.items) ? incoming.items.slice(0, 40) : [];
      if (!items.length) throw new Error("The basket is empty.");
      sweep(book);
      const id = book.nextOrder;
      book.nextOrder = id + 1;
      const contact = incoming.contact || {};
      const full = {
        id,
        status: "unpaid",
        account: String(person.account),
        accountName: person.name,
        items: items.map((line) => ({
          sku: String(line.sku || "").slice(0, 40),
          name: String(line.name || "").slice(0, 80),
          mg: String(line.mg || "").slice(0, 40),
          price: Number(line.price) || 0,
          qty: Math.max(1, Math.min(20, Number(line.qty) || 1)),
        })),
        shipping: incoming.shipping || null,
        contact: {
          fullName: String(contact.fullName || "").slice(0, 80),
          line1: String(contact.line1 || "").slice(0, 120),
          line2: String(contact.line2 || "").slice(0, 120),
          city: String(contact.city || "").slice(0, 80),
          state: String(contact.state || "").slice(0, 40),
          zip: String(contact.zip || "").slice(0, 20),
          email: String(contact.email || person.email || "").slice(0, 80),
        },
        sub: Number(incoming.sub) || 0,
        total: Number(incoming.total) || 0,
        placedAt: Date.now(),
        receipts: [],
      };
      book.orders.unshift(full);
      await writeBook(book);
      res.status(200).json(publicOrder(full));
      return;
    }
    if (body.action === "orders") {
      const book = await readBook();
      const dirty = sweep(book);
      if (dirty) await writeBook(book);
      let list = book.orders;
      if (!deskOk(body.deskPin)) {
        const person = memberOk(book, body.name, body.pin);
        if (!person) {
          res.status(401).json({ error: "Sign in again to see orders." });
          return;
        }
        list = list.filter((order) => String(order.account) === String(person.account));
      }
      res.status(200).json({ orders: list.map(publicOrder) });
      return;
    }
    if (body.action === "status") {
      if (!deskOk(body.deskPin)) {
        res.status(401).json({ error: "That desk PIN is not right." });
        return;
      }
      const book = await readBook();
      const order = book.orders.find((item) => item.id === Number(body.id));
      if (!order) throw new Error("That order is not in the book.");
      const allowed = ["review", "processing", "shipped", "sent", "history", "expired", "unpaid"];
      if (!allowed.includes(body.status)) throw new Error("That status is not used.");
      if (body.status === "sent") {
        const tracking = String(body.tracking || "").trim().slice(0, 40);
        if (!tracking) throw new Error("Type the tracking number.");
        order.tracking = tracking;
      }
      order.status = body.status;
      await writeBook(book);
      res.status(200).json(publicOrder(order));
      return;
    }
    if (body.action === "receipt") {
      const book = await readBook();
      const person = memberOk(book, body.name, body.pin);
      if (!person) {
        res.status(401).json({ error: "Sign in again before attaching a receipt." });
        return;
      }
      const order = book.orders.find((item) => item.id === Number(body.id));
      if (!order || String(order.account) !== String(person.account)) throw new Error("That order is not on this card.");
      if (order.status !== "unpaid" && order.status !== "review") throw new Error("This order is not waiting on a receipt.");
      const data = String(body.data || "");
      if (!data.startsWith("data:image/") || data.length > 1800000) throw new Error("Use a smaller photo of the receipt.");
      const path = `receipts/${order.id}-${Date.now()}.jpg`;
      const raw = data.split(",")[1] || "";
      await put(path, Buffer.from(raw, "base64"), {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "image/jpeg",
      });
      order.receipts.push({ name: String(body.fileName || "receipt").slice(0, 80), at: Date.now(), path });
      order.status = "review";
      await writeBook(book);
      res.status(200).json(publicOrder(order));
      return;
    }
    if (body.action === "picture") {
      const path = String(body.path || "");
      if (!/^receipts\/[\w.-]+$/.test(path)) throw new Error("That receipt is not in the book.");
      const book = await readBook();
      const order = book.orders.find((item) => (item.receipts || []).some((receipt) => receipt.path === path));
      if (!order) throw new Error("That receipt is not in the book.");
      if (!deskOk(body.deskPin)) {
        const person = memberOk(book, body.name, body.pin);
        if (!person || String(order.account) !== String(person.account)) {
          res.status(401).json({ error: "That receipt is not on this card." });
          return;
        }
      }
      const result = await get(path, { access: "private" });
      if (!result) throw new Error("That receipt could not be opened.");
      const bytes = Buffer.from(await new Response(result.stream).arrayBuffer());
      res.status(200).json({ data: `data:image/jpeg;base64,${bytes.toString("base64")}` });
      return;
    }
    res.status(400).json({ error: "Unknown request." });
  } catch (error) {
    const message = /not connected|No token|store ID|OIDC/i.test(error.message || "")
      ? "The shared book is not connected yet."
      : error.message || "The book could not be updated.";
    res.status(400).json({ error: message });
  }
}
