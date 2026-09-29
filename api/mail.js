import nodemailer from "nodemailer";
import { get } from "@vercel/blob";
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

function payRows(pay) {
  pay = pay || CONFIG.pay || {};
  return [
    ["Venmo", pay.venmo],
    ["Cash App", pay.cashApp],
    ["Chime", pay.chime],
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
      ${order.discount > 0 ? `<tr><td style="color:#d7fff8;">Discount<div style="color:#9d8fb4;font-size:13px;">${esc((order.codes || []).join(" · "))}</div></td><td></td><td style="text-align:right;color:#d7fff8;">−${money(order.discount)}</td></tr>` : ""}
      <tr><td style="color:#d7fff8;">Shipping<div style="color:#9d8fb4;font-size:13px;">${esc(ship.label)}${ship.detail ? ` (${esc(ship.detail)})` : ""}</div></td><td></td><td style="text-align:right;color:#d7fff8;">${money(ship.price)}</td></tr>
      <tr><td style="padding-top:8px;color:#f6ecff;font-size:18px;">Total</td><td></td><td style="padding-top:8px;text-align:right;color:#2ec9b0;font-size:18px;">${money(order.total)}</td></tr>
    </table>`;
}

function shipTo(contact) {
  const city = [contact.city, contact.state, contact.zip].filter(Boolean).join(", ");
  return `<p style="margin:16px 0 8px;color:#2ec9b0;">Ship to</p>
    <p style="margin:0;color:#f6ecff;">${esc(contact.fullName)}<br>${esc(contact.line1)}${contact.line2 ? `<br>${esc(contact.line2)}` : ""}<br>${esc(city)}</p>`;
}

function paymentBlock(pay) {
  const rows = payRows(pay);
  if (!rows.length) return "";
  const lines = rows.map(([label, value]) => `<div style="padding:4px 0;"><span style="color:#9d8fb4;">${esc(label)}</span> <span style="color:#f6ecff;">${esc(value)}</span></div>`).join("");
  const who = pay?.ownerName && !/^SET\b/i.test(pay.ownerName) ? `<div style="padding-bottom:6px;color:#f6ecff;">${esc(pay.ownerName)}</div>` : "";
  return `<p style="margin:16px 0 8px;color:#2ec9b0;">Send the exact total</p>${who}${lines}
    <p style="color:#d7fff8;">Payment is handled off the shelf. After you pay, open the order and attach a photo of the receipt.</p>`;
}

function deskLetter(kind, order) {
  const id = esc(order.id);
  const member = esc(order.accountName || order.contact?.fullName || "A member");
  const no = esc(order.account || "—");
  const mail = esc(order.contact?.email || "no email on the order");
  const head = `<p style="color:#2ec9b0;">Desk note. This copy is only for you.</p><p>Member no. ${no} · ${member}<br>Their email · ${mail}</p>`;
  if (kind === "received") {
    return {
      subject: `Desk — new order #${order.id} — ${order.accountName || "member"} ${order.account || ""}`.trim(),
      html: shell({
        kicker: "Desk",
        title: `New order #${id} is waiting on payment`,
        body: `${head}<p>They placed this order. Do not mark it paid until a receipt is attached.</p>${itemsTable(order)}${shipTo(order.contact)}`,
      }),
    };
  }
  if (kind === "receipt") {
    return {
      subject: `Desk — receipt attached for order #${order.id}`,
      html: shell({
        kicker: "Desk",
        title: `Order #${id} needs your confirmation`,
        body: `${head}<p>A payment receipt was just attached. Open the desk and confirm it when the payment checks out.</p><p>Order total: <span style="color:#2ec9b0;">${money(order.total)}</span></p>`,
      }),
    };
  }
  if (kind === "confirmed") {
    return {
      subject: `Desk — you confirmed payment for order #${order.id}`,
      html: shell({
        kicker: "Desk",
        title: `Order #${id} marked paid`,
        body: `${head}<p>You confirmed the payment. The member got a different note saying it is waiting to be prepared.</p>`,
      }),
    };
  }
  if (kind === "prepared") {
    return {
      subject: `Desk — order #${order.id} marked being prepared`,
      html: shell({
        kicker: "Desk",
        title: `Order #${id} is being prepared`,
        body: `${head}<p>You marked this order as being prepared. The member was told it is not shipped yet.</p>`,
      }),
    };
  }
  if (kind === "tracking") {
    const href = trackHref(order);
    return {
      subject: `Desk — order #${order.id} shipped`,
      html: shell({
        kicker: "Desk",
        title: `Order #${id} was marked shipped`,
        body: `${head}<p>Tracking ${esc(order.tracking || "")}. The member got a different note with this link.</p><p><a href="${href}">${esc(order.tracking || "")}</a></p>`,
      }),
    };
  }
  return null;
}

function trackHref(order) {
  const n = encodeURIComponent(String(order.tracking || "").trim());
  const fedex = order.carrier === "fedex" || (!order.carrier && (order.shipping?.id === "fedex2" || order.shipping?.id === "overnight"));
  if (fedex) return `https://www.fedex.com/fedextrack/?trknbr=${n}`;
  return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${n}`;
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
        body: `<p>Hi ${name},</p><p>We've received order #${id}. Here is what you ordered.</p>${itemsTable(order)}${shipTo(order.contact)}${paymentBlock(order.pay)}`,
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
        body: `<p>Hi ${name},</p><p>Your order is being prepared. Tracking will be sent when it ships.</p><p>Order total: <span style="color:#2ec9b0;">${total}</span></p>`,
      }),
    };
  }
  if (kind === "tracking") {
    const href = trackHref(order);
    const carrierName = order.carrier === "fedex" ? "FedEx" : order.carrier === "usps" ? "USPS" : (order.shipping?.label || "the carrier");
    return {
      subject: `The Deviant's Shelf — Order #${order.id} — shipped`,
      html: shell({
        kicker: "The Deviant's Shelf",
        title: `Order #${id} has shipped`,
        body: `<p>Hi ${name},</p><p>Your order is on the way with ${esc(carrierName)}.</p><p>Tracking number: <a href="${href}" style="color:#2ec9b0;">${esc(order.tracking || "")}</a></p><p>That number opens the ${esc(carrierName)} tracking page.</p>`,
      }),
    };
  }
  return null;
}

async function bookPay() {
  try {
    const result = await get("ledger.json", { access: "private" });
    if (!result) return null;
    const data = JSON.parse(await new Response(result.stream).text());
    return data.pay || null;
  } catch {
    return null;
  }
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
  const order = { ...(body.order || {}) };
  const stored = await bookPay();
  const handles = ["venmo", "cashApp", "chime"];
  const storedHas = handles.some((key) => stored?.[key] && !/^SET\b/i.test(stored[key]));
  order.pay = storedHas ? stored : CONFIG.pay;
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
      const desk = deskLetter(body.kind, order);
      if (desk) {
        await transport.sendMail({
          from: `The Deviant's Shelf <${FROM}>`,
          to: shop,
          replyTo: to || FROM,
          subject: desk.subject,
          html: desk.html,
        });
      }
    }
    res.status(200).json({ ok: true });
  } catch {
    res.status(502).json({ error: "The note could not be sent." });
  }
}
