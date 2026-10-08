import { get } from "@vercel/blob";
import { lookupCoaFile, readyCoaBook } from "./book.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Use GET." });
    return;
  }
  const url = new URL(req.url, "https://thedeviantsshelf.com");
  const slug = url.searchParams.get("slug") || "";
  const batch = url.searchParams.get("batch") || "";
  try {
    const book = await readyCoaBook();
    const found = lookupCoaFile(book, slug, batch);
    if (!found) {
      res.status(404).json({ error: "That certificate is not on the shelf." });
      return;
    }
    if (found.file.startsWith("/coa/") && /^\/coa\/[A-Za-z0-9._-]+\.pdf$/.test(found.file)) {
      res.redirect(302, found.file);
      return;
    }
    if (!found.file.startsWith("coa-files/")) {
      res.status(404).json({ error: "That certificate is not on the shelf." });
      return;
    }
    const result = await get(found.file, { access: "private" });
    if (!result) {
      res.status(404).json({ error: "That certificate could not be opened." });
      return;
    }
    const bytes = Buffer.from(await new Response(result.stream).arrayBuffer());
    res.setHeader("Content-Type", found.mime || "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${String(found.fileName || "certificate").replace(/"/g, "")}"`);
    res.setHeader("Cache-Control", "public, max-age=300");
    res.status(200).send(bytes);
  } catch {
    res.status(404).json({ error: "That certificate could not be opened." });
  }
}
