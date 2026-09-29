import nodemailer from "nodemailer";
import { CONFIG } from "../src/data.js";

const FROM = process.env.MAIL_FROM || "orders@thedeviantsshelf.com";
const SITE = "https://thedeviantsshelf.com";

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">");
}

function money(n) {
  return `$${Number(n || 0).toFixed(0)}`;
}

function payRows() {
  const pay = CONFIG.pay || {};
  return [
    ["Venmo", pay.venmo],
    ["Zelle", pay.zelle],
    ["Cash App", pay.cashApp],
    ["Chime", pay.chime],
    ["Crypto", pay.crypto],
  ].filter(([, value]) => value && !/^SET\b/i.test(value));
}

function shell({ kicker, title, body }) {
  return `<!doctype html>
<html>
<body style="margin:0;background:#14081c;color:#d7fff8;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#14081c;padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;background:#241033;border:1px solid #2ec9b0;border-radius:18px;padding:28px 26px;font-family:Georgia,serif;">
        <tr><td style="color:#2ec9b0;letter-spacing:.2em;font-size:12px;text-transform:uppercase;">${esc(kicker)}</td></tr>
        <tr><td style="color:#f6ecff;font-size:22px;line-height:1.3;padding:10px 0 16px;">${title}</td></tr>
        <tr><td style="color:#d7fff8;font-size:16px;line-height:1.5;">${body}</td></tr>
        <tr><td style="padding-top:22px;">
          <a href="${SITE}" style="display:inline-block;background:#1aa894;color:#041410;text-decoration:none;font-family:Georgia,serif;font-weight:bold;padding:12px 18px;border-radius:8px;">View your order</a>
        </td></tr>
        <tr><td style="color:#a894c4;font-size:12px;line-height:1.45;padding-top:22px;">This is an automated note from The Deviant's Shelf. Replies to this address are not watched.</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function itemsTable(order) {
  const rows = (order.items || []).map((item) => `
    <tr>
      <td style="padding:8px 0;border-top:1px solid #3a2158;color:#f6ecff;">${esc(item.name || item.sku)}<div style="color:#9d8fb4;font-size:13px;">${esc(item.mg || "")}</div></td>
      <td style="padding:8px 0;border-top:1px solid #3a2158;color:#d7fff8;text-align:right;">${esc(item.qty)} ${item.mg === "kit" ? "kit" : "vial"}</td>
      <td style="padding:8px 0;border-top:1px solid #3a2158;color:#2ec9b0;text-align:right;">${money(item.price * item.qty)}</td>
    </tr>`).join("");
  const ship = order.shipping || { label: "Shipping", price: 0 };
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 16px;">${rows}
      <tr><td style="padding-top:10px;color:#d7fff8;">Subtotal</td><td></td><td style="padding-top:10px;text-align:right;color:#d7fff8;">${money(order.sub)}</td></tr>
      <tr><td style="color:#d7fff8;">Shipping<div style="color:#9d8fb4;font-size:13px;">${esc(ship.label)}${ship.detail ? ` (${esc(ship.detail)})` : ""}</div></td><td></td><td style="text-align:right;color:#d7fff8;">${money(ship.price)}</td></tr>
      <tr><td style="padding-top:8px;color:#f6ecff;font-size:18px;">Total</td><td></td><td style="padding-top:8px;text-align:right;color:#2ec9b0;font-size:18px;">${money(order.total)}</td></tr>
    </table>`;
}

function shipTo(contact) {
  const city = [contact.city, contact.state, contact.zip].filter(Boolean).join(", ");
  return `<p style="margin:16px 0 8px;color:#2ec9b0;">Ship to</p>
    <p style="margin:0;color:#f6ecff;">${esc(contact.fullName)}<br>${esc(contact.line1)}${contact.line2 ? `<br>${esc(contact.line2)}` : ""}<br>${esc(city)}</p>`;
}

function paymentBlock() {
  const rows = payRows();
  if (!rows.length) return "";
  const lines = rows.map(([label, value]) => `<div style="padding:4px 0;"><span style="color:#9d8fb4;">${esc(label)}</span> <span style="color:#f6ecff;">${esc(value)}</span></div>`).join("");
  const who = CONFIG.pay?.ownerName && !/^SET\b/i.test(CONFIG.pay.ownerName) ? `<div style="padding-bottom:6px;color:#f6ecff;">${esc(CONFIG.pay.ownerName)}</div>` : "";
  return `<p style="margin:16px 0 8px;color:#2ec9b0;">Send the exact total</p>${who}${lines}
    <p style="color:#d7fff8;">Payment is handled off the shelf. After you pay, open the order and attach a photo of the receipt.</p>`;
}

function letter(kind, order) {
  const name = esc(order.contact?.fullName || "there");
  const id = esc(order.id);
  const total = money(order.total);
  if (kind === "received") {
    return {
      subject: `The Deviant's Shelf — Order #${order.id} — next step: payment`,
      html: shell({
        kicker: "The Deviant's Shelf",
        title: `Order #${id} — next step: payment`,
        body: `<p>Hi ${name},</p><p>We've received order #${id}. Here is what you ordered.</p>${itemsTable(order)}${shipTo(order.contact)}${paymentBlock()}`,
      }),
    };
  }
  if (kind === "receipt") {
    return {
      subject: `The Deviant's Shelf — Order #${order.id} — payment receipt received`,
      html: shell({
        kicker: "The Deviant's Shelf",
        title: `Order #${id} — payment receipt received`,
        body: `<p>Hi ${name},</p><p>Your payment receipt has been received and is being reviewed. Please wait while the payment is confirmed. No action is needed right now.</p><p>Order total: <span style="color:#2ec9b0;">${total}</span></p>`,
      }),
    };
  }
  if (kind === "confirmed") {
    return {
      subject: `The Deviant's Shelf — Order #${order.id} — payment confirmed`,
      html: shell({
        kicker: "The Deviant's Shelf",
        title: `Order #${id} — payment confirmed`,
        body: `<p>Hi ${name},</p><p>Your payment has been confirmed. Your order is now waiting to be prepared.</p><p>Order total: <span style="color:#2ec9b0;">${total}</span></p>`,
      }),
    };
  }
  if (kind === "prepared") {
    return {
      subject: `The Deviant's Shelf — Order #${order.id} — being prepared`,
      html: shell({
        kicker: "The Deviant's Shelf",
        title: `Order #${id} — being prepared`,
        body: `<p>Hi ${name},</p><p>Your order is being prepared for shipping. This is the last step before it goes out.</p><p>Order total: <span style="color:#2ec9b0;">${total}</span></p>`,
      }),
    };
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Use POST." });
    return;
  }
  if (!process.env.MAIL_USER || !process.env.MAIL_PASS) {
    res.status(503).json({ error: "Mail is not connected yet." });
    return;
  }
  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
  const order = body.order || {};
  const to = String(order.contact?.email || "").trim();
  const shop = String(process.env.MAIL_USER || "").trim();
  const note = letter(body.kind, order);
  const customerOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to);
  if (!note || (!customerOk && !shop)) {
    res.status(400).json({ error: "That note could not be sent." });
    return;
  }
  try {
    const transport = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS },
    });
    if (customerOk) {
      await transport.sendMail({
        from: `The Deviant's Shelf <${FROM}>`,
        to,
        replyTo: FROM,
        subject: note.subject,
        html: note.html,
      });
    }
    if (shop && shop.toLowerCase() !== to.toLowerCase()) {
      const who = order.account ? `Member no. ${order.account}${order.accountName ? ` · ${order.accountName}` : ""}` : "A member";
      await transport.sendMail({
        from: `The Deviant's Shelf <${FROM}>`,
        to: shop,
        replyTo: to || FROM,
        subject: `Desk copy — ${note.subject}`,
        html: note.html.replace("<p>Hi ", `<p style="color:#2ec9b0;">${esc(who)}</p><p>Hi `),
      });
    }
    res.status(200).json({ ok: true });
  } catch {
    res.status(502).json({ error: "The note could not be sent." });
  }
}
