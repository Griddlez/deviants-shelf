import { readFile } from "node:fs/promises";
import { readBook, deskOk, memberOk } from "./book.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Use POST." });
    return;
  }
  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
  const book = await readBook();
  if (!deskOk(body.deskPin) && !memberOk(book, body.name, body.pin)) {
    res.status(401).json({ error: "Sign in again." });
    return;
  }
  const bytes = await readFile(new URL("./shelf-catalog.zip", import.meta.url));
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", "attachment; filename=\"The-Deviants-Shelf-catalog.zip\"");
  res.status(200).send(bytes);
}
