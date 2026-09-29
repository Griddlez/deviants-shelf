export function notify(kind, order) {
  const email = order?.contact?.email?.trim() || "";
  const payload = {
    kind,
    order: {
      id: order.id,
      account: order.account,
      accountName: order.accountName,
      total: order.total,
      sub: order.sub,
      discount: order.discount || 0,
      codes: order.codes || [],
      items: (order.items || []).map((l) => ({
        name: l.name,
        sku: l.sku,
        mg: l.mg,
        qty: l.qty,
        price: l.price,
      })),
      shipping: order.shipping ? { id: order.shipping.id, label: order.shipping.label, detail: order.shipping.detail, price: order.shipping.price } : null,
      tracking: order.tracking || "",
      carrier: order.carrier || "",
      contact: {
        fullName: order.contact?.fullName || "",
        line1: order.contact?.line1 || "",
        line2: order.contact?.line2 || "",
        city: order.contact?.city || "",
        state: order.contact?.state || "",
        zip: order.contact?.zip || "",
        email,
      },
    },
  };
  fetch("/api/mail", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => {});
}
