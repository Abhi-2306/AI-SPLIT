import nodemailer from "nodemailer";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export async function sendEmail(to: string, subject: string, html: string) {
  await transporter.sendMail({
    from: `AI Split <${process.env.GMAIL_USER}>`,
    to,
    subject,
    html,
  });
}

export function settlementEmailHtml(
  payerName: string,
  amount: string,
  note?: string | null
): string {
  return `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
    <h2 style="color:#1e293b">💸 Payment received</h2>
    <p style="color:#475569"><strong>${payerName}</strong> paid you <strong>${amount}</strong>.</p>
    ${note ? `<p style="color:#64748b;font-style:italic">"${note}"</p>` : ""}
    <a href="${SITE}/friends" style="display:inline-block;margin-top:16px;padding:10px 20px;background:#2563eb;color:#fff;border-radius:8px;text-decoration:none">View balance</a>
  </div>`;
}

export function billSharedEmailHtml(
  creatorName: string,
  billTitle: string,
  billId: string,
  currency: string,
  userShare: number,
  items: { name: string; amountOwed: number }[],
  subtotal: number,
  taxShare: number,
  tipShare: number,
  total: number,
): string {
  const shareHeader = userShare < 0
    ? `<div style="background:#fef2f2;border-radius:8px;padding:12px 16px;margin:16px 0">
         <p style="margin:0;color:#dc2626;font-size:20px;font-weight:700">You owe ${Math.abs(userShare).toFixed(2)} ${currency}</p>
       </div>`
    : userShare > 0
    ? `<div style="background:#f0fdf4;border-radius:8px;padding:12px 16px;margin:16px 0">
         <p style="margin:0;color:#16a34a;font-size:20px;font-weight:700">You are owed ${userShare.toFixed(2)} ${currency}</p>
       </div>`
    : `<div style="background:#f8fafc;border-radius:8px;padding:12px 16px;margin:16px 0">
         <p style="margin:0;color:#64748b;font-size:16px">You are settled up</p>
       </div>`;

  const itemRows = items
    .map((i) =>
      `<tr>
         <td style="padding:5px 0;color:#475569">${i.name}</td>
         <td style="padding:5px 0;color:#1e293b;text-align:right">${i.amountOwed.toFixed(2)} ${currency}</td>
       </tr>`
    )
    .join("");

  const breakdownRows = [
    { label: "Subtotal", value: subtotal },
    taxShare > 0 ? { label: "Tax", value: taxShare } : null,
    tipShare > 0 ? { label: "Tip", value: tipShare } : null,
  ]
    .filter(Boolean)
    .map((r) =>
      `<tr>
         <td style="padding:4px 0;color:#94a3b8;font-size:13px">${r!.label}</td>
         <td style="padding:4px 0;color:#94a3b8;font-size:13px;text-align:right">${r!.value.toFixed(2)} ${currency}</td>
       </tr>`
    )
    .join("");

  return `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
    <h2 style="color:#1e293b;margin-bottom:4px">🧾 You were added to a bill</h2>
    <p style="color:#475569;margin-top:4px"><strong>${creatorName}</strong> added you to <strong>"${billTitle}"</strong>.</p>
    ${shareHeader}
    ${items.length > 0 ? `
    <table style="width:100%;border-collapse:collapse;margin-top:20px">
      <thead><tr>
        <th style="text-align:left;padding:6px 0;color:#94a3b8;font-size:11px;letter-spacing:0.05em;border-bottom:1px solid #e2e8f0">YOUR ITEMS</th>
        <th style="text-align:right;padding:6px 0;color:#94a3b8;font-size:11px;letter-spacing:0.05em;border-bottom:1px solid #e2e8f0">YOUR SHARE</th>
      </tr></thead>
      <tbody>${itemRows}</tbody>
    </table>
    <table style="width:100%;border-collapse:collapse;margin-top:4px;border-top:1px solid #e2e8f0;padding-top:4px">
      <tbody>
        ${breakdownRows}
        <tr>
          <td style="padding:8px 0 0;color:#1e293b;font-weight:700;border-top:1px solid #e2e8f0">Your total</td>
          <td style="padding:8px 0 0;color:#1e293b;font-weight:700;text-align:right;border-top:1px solid #e2e8f0">${total.toFixed(2)} ${currency}</td>
        </tr>
      </tbody>
    </table>` : ""}
    <a href="${SITE}/bills/${billId}/summary" style="display:inline-block;margin-top:24px;padding:10px 20px;background:#2563eb;color:#fff;border-radius:8px;text-decoration:none">View bill</a>
  </div>`;
}

export function billUpdatedEmailHtml(
  updaterName: string,
  billTitle: string,
  billId: string,
  currency: string,
  userShare: number,
  oldTotal: number,
  newTotal: number,
  items: { name: string; amountOwed: number }[],
  subtotal: number,
  taxShare: number,
  tipShare: number,
  total: number,
): string {
  const shareHeader = userShare < 0
    ? `<div style="background:#fef2f2;border-radius:8px;padding:12px 16px;margin:16px 0">
         <p style="margin:0;color:#dc2626;font-size:20px;font-weight:700">You owe ${Math.abs(userShare).toFixed(2)} ${currency}</p>
       </div>`
    : userShare > 0
    ? `<div style="background:#f0fdf4;border-radius:8px;padding:12px 16px;margin:16px 0">
         <p style="margin:0;color:#16a34a;font-size:20px;font-weight:700">You are owed ${userShare.toFixed(2)} ${currency}</p>
       </div>`
    : `<div style="background:#f8fafc;border-radius:8px;padding:12px 16px;margin:16px 0">
         <p style="margin:0;color:#64748b;font-size:16px">You are settled up</p>
       </div>`;

  const changeArrow = newTotal > oldTotal
    ? `<span style="color:#dc2626">+${(newTotal - oldTotal).toFixed(2)}</span>`
    : `<span style="color:#16a34a">−${(oldTotal - newTotal).toFixed(2)}</span>`;

  const itemRows = items
    .map((i) =>
      `<tr>
         <td style="padding:5px 0;color:#475569">${i.name}</td>
         <td style="padding:5px 0;color:#1e293b;text-align:right">${i.amountOwed.toFixed(2)} ${currency}</td>
       </tr>`
    )
    .join("");

  const breakdownRows = [
    { label: "Subtotal", value: subtotal },
    taxShare > 0 ? { label: "Tax", value: taxShare } : null,
    tipShare > 0 ? { label: "Tip", value: tipShare } : null,
  ]
    .filter(Boolean)
    .map((r) =>
      `<tr>
         <td style="padding:4px 0;color:#94a3b8;font-size:13px">${r!.label}</td>
         <td style="padding:4px 0;color:#94a3b8;font-size:13px;text-align:right">${r!.value.toFixed(2)} ${currency}</td>
       </tr>`
    )
    .join("");

  return `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
    <h2 style="color:#1e293b;margin-bottom:4px">📝 Your share was updated</h2>
    <p style="color:#475569;margin-top:4px"><strong>${updaterName}</strong> updated <strong>"${billTitle}"</strong>.</p>
    <p style="color:#64748b;font-size:13px;margin-top:4px">
      Previously ${oldTotal.toFixed(2)} ${currency} &rarr; Now ${newTotal.toFixed(2)} ${currency} &nbsp;(${changeArrow} ${currency})
    </p>
    ${shareHeader}
    ${items.length > 0 ? `
    <table style="width:100%;border-collapse:collapse;margin-top:20px">
      <thead><tr>
        <th style="text-align:left;padding:6px 0;color:#94a3b8;font-size:11px;letter-spacing:0.05em;border-bottom:1px solid #e2e8f0">YOUR ITEMS</th>
        <th style="text-align:right;padding:6px 0;color:#94a3b8;font-size:11px;letter-spacing:0.05em;border-bottom:1px solid #e2e8f0">YOUR SHARE</th>
      </tr></thead>
      <tbody>${itemRows}</tbody>
    </table>
    <table style="width:100%;border-collapse:collapse;margin-top:4px">
      <tbody>
        ${breakdownRows}
        <tr>
          <td style="padding:8px 0 0;color:#1e293b;font-weight:700;border-top:1px solid #e2e8f0">Your total</td>
          <td style="padding:8px 0 0;color:#1e293b;font-weight:700;text-align:right;border-top:1px solid #e2e8f0">${total.toFixed(2)} ${currency}</td>
        </tr>
      </tbody>
    </table>` : ""}
    <a href="${SITE}/bills/${billId}/summary" style="display:inline-block;margin-top:24px;padding:10px 20px;background:#2563eb;color:#fff;border-radius:8px;text-decoration:none">View bill</a>
  </div>`;
}

export function friendAcceptedEmailHtml(acceptorName: string): string {
  return `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
    <h2 style="color:#1e293b">🤝 Friend request accepted</h2>
    <p style="color:#475569"><strong>${acceptorName}</strong> accepted your friend request. You can now split bills together.</p>
    <a href="${SITE}/friends" style="display:inline-block;margin-top:16px;padding:10px 20px;background:#2563eb;color:#fff;border-radius:8px;text-decoration:none">View friends</a>
  </div>`;
}
