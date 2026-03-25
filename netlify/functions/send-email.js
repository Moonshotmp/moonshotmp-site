// Email sending utility using Resend API
// Set RESEND_API_KEY and RESEND_FROM in Netlify environment variables

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM = process.env.RESEND_FROM || 'noreply@updates.moonshotclinic.com';
const RESEND_FROM_NAME = process.env.RESEND_FROM_NAME || 'Moonshot Medical';

export async function sendEmail({ to, subject, html, text, from, fromName, replyTo, headers: customHeaders }) {
  if (!RESEND_API_KEY) {
    console.error("[send-email] RESEND_API_KEY not configured");
    return { ok: false, error: "Email not configured" };
  }

  const senderAddress = from || RESEND_FROM;
  const senderName = fromName || RESEND_FROM_NAME;
  const fromFormatted = `${senderName} <${senderAddress}>`;
  const recipients = Array.isArray(to) ? to : [to];

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromFormatted,
        to: recipients,
        reply_to: replyTo || 'hello@moonshotmp.com',
        subject,
        html: html || undefined,
        text: text || undefined,
        headers: customHeaders || undefined,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[send-email] Resend API error:", res.status, errText);
      return { ok: false, error: "Failed to send email" };
    }

    const data = await res.json();
    console.log("[send-email] Sent successfully to:", recipients.join(", "), "id:", data.id);
    return { ok: true, id: data.id };
  } catch (err) {
    console.error("[send-email] Error:", err);
    return { ok: false, error: err.message };
  }
}

// Email templates
export function loginCodeEmail({ code, portalName }) {
  const subject = `${code} - Your Moonshot ${portalName} Login Code`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #101921; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background: #1a2530; border-radius: 8px; padding: 32px; border: 1px solid rgba(255,255,255,0.1); text-align: center;">
      <h1 style="color: #F0EEE9; margin: 0 0 8px; font-size: 20px;">Moonshot ${portalName}</h1>
      <p style="color: #B2BFBE; margin: 0 0 24px; font-size: 14px;">Your login verification code</p>

      <div style="background: rgba(201, 162, 39, 0.1); border: 2px solid #c9a227; border-radius: 8px; padding: 24px; margin: 0 0 24px;">
        <p style="color: #c9a227; font-size: 36px; font-weight: 700; letter-spacing: 8px; margin: 0;">${code}</p>
      </div>

      <p style="color: #B2BFBE; font-size: 14px; margin: 0;">
        This code expires in 10 minutes.<br>
        If you didn't request this, ignore this email.
      </p>
    </div>

    <p style="color: #666; font-size: 12px; text-align: center; margin-top: 24px;">
      Moonshot Medical + Performance
    </p>
  </div>
</body>
</html>
  `.trim();

  return { subject, html };
}

export function partnerWelcomeEmail({ partnerName, storeUrl, manageUrl, loginUrl }) {
  const subject = `Welcome to Moonshot Partner Program - Your Store is Ready!`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #101921; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background: #1a2530; border-radius: 8px; padding: 32px; border: 1px solid rgba(255,255,255,0.1);">
      <h1 style="color: #F0EEE9; margin: 0 0 24px; font-size: 24px;">Welcome to Moonshot!</h1>

      <p style="color: #B2BFBE; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
        Hi ${partnerName},
      </p>

      <p style="color: #B2BFBE; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
        Your partner store has been created and is ready to go! Here are your important links:
      </p>

      <div style="background: rgba(255,255,255,0.05); border-radius: 6px; padding: 20px; margin: 24px 0;">
        <p style="color: #F0EEE9; margin: 0 0 12px; font-weight: 600;">Your Store URL:</p>
        <a href="${storeUrl}" style="color: #4ade80; word-break: break-all;">${storeUrl}</a>

        <p style="color: #F0EEE9; margin: 20px 0 12px; font-weight: 600;">Manage Your Store:</p>
        <a href="${loginUrl}" style="color: #4ade80; word-break: break-all;">${loginUrl}</a>
      </div>

      <p style="color: #B2BFBE; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
        <strong style="color: #F0EEE9;">Next steps:</strong>
      </p>

      <ol style="color: #B2BFBE; font-size: 16px; line-height: 1.8; margin: 0 0 24px; padding-left: 20px;">
        <li>Connect your Stripe account to receive payments</li>
        <li>Add a card on file for wholesale billing</li>
        <li>Upload your logo and customize your store</li>
        <li>Share your store URL with patients!</li>
      </ol>

      <p style="color: #B2BFBE; font-size: 16px; line-height: 1.6; margin: 0;">
        Questions? Reply to this email or contact us at <a href="mailto:hello@moonshotmp.com" style="color: #4ade80;">hello@moonshotmp.com</a>
      </p>
    </div>

    <p style="color: #666; font-size: 12px; text-align: center; margin-top: 24px;">
      Moonshot Medical + Performance<br>
      Austin, TX
    </p>
  </div>
</body>
</html>
  `.trim();

  const text = `
Welcome to Moonshot!

Hi ${partnerName},

Your partner store has been created and is ready to go!

Your Store URL: ${storeUrl}

Manage Your Store: ${loginUrl}

Next steps:
1. Connect your Stripe account to receive payments
2. Add a card on file for wholesale billing
3. Upload your logo and customize your store
4. Share your store URL with patients!

Questions? Contact us at hello@moonshotmp.com

- Moonshot Medical + Performance
  `.trim();

  return { subject, html, text };
}

export function orderNotificationEmail({ partnerName, customerName, customerEmail, items, total, orderDate, storeUrl }) {
  const subject = `New Order from ${customerName} - $${(total / 100).toFixed(2)}`;

  const itemsList = items.map(i => `<li style="margin-bottom: 8px;">${i.name} x${i.quantity}</li>`).join('');
  const itemsText = items.map(i => `- ${i.name} x${i.quantity}`).join('\n');

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #101921; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background: #1a2530; border-radius: 8px; padding: 32px; border: 1px solid rgba(255,255,255,0.1);">
      <h1 style="color: #4ade80; margin: 0 0 8px; font-size: 24px;">New Order!</h1>
      <p style="color: #B2BFBE; margin: 0 0 24px; font-size: 14px;">${orderDate}</p>

      <div style="background: rgba(255,255,255,0.05); border-radius: 6px; padding: 20px; margin: 0 0 24px;">
        <p style="color: #F0EEE9; margin: 0 0 12px; font-weight: 600;">Customer</p>
        <p style="color: #B2BFBE; margin: 0 0 4px;">${customerName}</p>
        <p style="color: #888; margin: 0; font-size: 14px;">${customerEmail}</p>
      </div>

      <div style="background: rgba(255,255,255,0.05); border-radius: 6px; padding: 20px; margin: 0 0 24px;">
        <p style="color: #F0EEE9; margin: 0 0 12px; font-weight: 600;">Items Ordered</p>
        <ul style="color: #B2BFBE; margin: 0; padding-left: 20px; line-height: 1.6;">
          ${itemsList}
        </ul>
      </div>

      <div style="text-align: center; padding: 20px; background: rgba(74, 222, 128, 0.1); border-radius: 6px; margin: 0 0 24px;">
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">Order Total</p>
        <p style="color: #4ade80; margin: 0; font-size: 32px; font-weight: 600;">$${(total / 100).toFixed(2)}</p>
      </div>

      <p style="color: #B2BFBE; font-size: 14px; line-height: 1.6; margin: 0;">
        The customer will receive instructions to book their appointment. You can view all orders in your
        <a href="${storeUrl.replace('store.html', 'login.html')}" style="color: #4ade80;">store management dashboard</a>.
      </p>
    </div>

    <p style="color: #666; font-size: 12px; text-align: center; margin-top: 24px;">
      Moonshot Medical + Performance
    </p>
  </div>
</body>
</html>
  `.trim();

  const text = `
New Order!

${orderDate}

Customer: ${customerName}
Email: ${customerEmail}

Items Ordered:
${itemsText}

Order Total: $${(total / 100).toFixed(2)}

The customer will receive instructions to book their appointment. View all orders in your store management dashboard.

- Moonshot Medical + Performance
  `.trim();

  return { subject, html, text };
}
