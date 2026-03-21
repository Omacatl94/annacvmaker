import { Resend } from 'resend';
import { config } from '../config.js';

const resend = config.resendApiKey ? new Resend(config.resendApiKey) : null;

export async function sendWelcomeEmail(to, name) {
  if (!resend) return;

  const firstName = (name || '').split(' ')[0] || 'Ciao';

  await resend.emails.send({
    from: config.emailFrom,
    to,
    subject: 'Sei dentro — benvenuto su JobHacker',
    html: `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0a0a0a;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0a0a0a;">
<tr><td align="center" style="padding:0;">
<table role="presentation" width="520" cellspacing="0" cellpadding="0" style="max-width:520px;width:100%;margin:0 auto;">

  <!-- Hero image -->
  <tr><td align="center" style="padding:32px 24px 0;">
    <img src="https://jobhacker.it/img/mascot/welcome.jpg" alt="Welcome to JobHacker" width="300" style="display:block;width:300px;max-width:100%;height:auto;border-radius:16px;" />
  </td></tr>

  <!-- Content -->
  <tr><td style="padding:24px 24px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <p style="font-size:18px;font-weight:700;color:#f5f5f5;margin:0 0 12px;text-align:center;">
      ${firstName}, sei dentro!
    </p>
    <p style="font-size:15px;line-height:1.6;color:#b0b0b0;margin:0 0 20px;text-align:center;">
      Il tuo account JobHacker è attivo. Hai <strong style="color:#00E676;">2 Raccoin</strong> per generare i tuoi primi CV ottimizzati e <strong style="color:#00E676;">3 inviti</strong> da condividere.
    </p>
  </td></tr>

  <!-- CTA button -->
  <tr><td align="center" style="padding:8px 24px 24px;">
    <a href="https://jobhacker.it" style="display:inline-block;padding:14px 40px;background:#00E676;color:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-weight:700;font-size:16px;border-radius:8px;text-decoration:none;">
      Inizia ora
    </a>
  </td></tr>

  <!-- Tip -->
  <tr><td style="padding:0 24px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#141414;border:1px solid #222;border-radius:8px;">
      <tr><td style="padding:16px;">
        <p style="font-size:13px;line-height:1.5;color:#888;margin:0;">
          Ogni amico che inviti e genera il primo CV ti regala <strong style="color:#00E676;">1 Raccoin</strong>. Condividi i tuoi inviti dalla sezione Account.
        </p>
      </td></tr>
    </table>
  </td></tr>

  <!-- Footer -->
  <tr><td style="padding:0 24px 32px;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <p style="font-size:11px;color:#444;margin:0;">
      JobHacker · <a href="https://jobhacker.it" style="color:#444;text-decoration:none;">jobhacker.it</a>
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`,
  });
}
