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
  if (!data.next || data.next < 1) data.next = 2;
  return data;
}

async function writeBook(book) {
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
        .map((person) => ({ account: person.account, name: person.name, pin: person.pin }));
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
      book.people[display] = { account: n, name: display, pin: pinClean };
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
      book.people[display] = { account: n, name: display, pin: pinClean };
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
      res.status(200).json({ account: String(person.account), name: person.name });
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
