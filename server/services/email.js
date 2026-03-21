import { Resend } from 'resend';
import { config } from '../config.js';

const resend = config.resendApiKey ? new Resend(config.resendApiKey) : null;

export async function notifyAdminNewWaitlist(email, name, source) {
  if (!resend || !config.adminEmails.length) return;

  const displayName = name || '\u2014';
  const sourceLabel = source === 'oauth_google' ? 'Google OAuth'
    : source === 'oauth_linkedin' ? 'LinkedIn OAuth'
    : 'Form email';
  const adminLink = 'https://jobhacker.it/admin';

  await resend.emails.send({
    from: config.emailFrom,
    to: config.adminEmails,
    subject: `Nuovo utente in waitlist: ${email}`,
    html: `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0a0a0a;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0a0a0a;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="480" cellspacing="0" cellpadding="0" style="max-width:480px;width:100%;background:#141414;border:1px solid #222;border-radius:12px;">
  <tr><td style="padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <p style="font-size:16px;font-weight:700;color:#00E676;margin:0 0 16px;">Nuovo utente in waitlist</p>
    <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;">
      <tr><td style="padding:4px 0;font-size:14px;color:#888;width:80px;">Email</td><td style="padding:4px 0;font-size:14px;color:#f5f5f5;font-weight:600;">${email}</td></tr>
      <tr><td style="padding:4px 0;font-size:14px;color:#888;">Nome</td><td style="padding:4px 0;font-size:14px;color:#f5f5f5;">${displayName}</td></tr>
      <tr><td style="padding:4px 0;font-size:14px;color:#888;">Fonte</td><td style="padding:4px 0;font-size:14px;color:#f5f5f5;">${sourceLabel}</td></tr>
    </table>
  </td></tr>
  <tr><td align="center" style="padding:0 24px 24px;">
    <a href="${adminLink}" style="display:inline-block;padding:12px 32px;background:#00E676;color:#0a0a0a;font-weight:700;font-size:14px;border-radius:8px;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      Apri pannello admin
    </a>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`,
  });
}

export async function sendWelcomeEmail(to, name) {
  if (!resend) return;

  const firstName = (name || '').split(' ')[0] || 'Ciao';

  await resend.emails.send({
    from: config.emailFrom,
    to,
    subject: 'Sei dentro \u2014 ti aspettavamo!',
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
      Il tuo account JobHacker \u00E8 attivo. Hai <strong style="color:#00E676;">2 Raccoin</strong> per generare i tuoi primi CV ottimizzati.
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
          Hai trovato un bug o hai un'idea? Clicca il procione in basso a destra \u2014 i feedback utili vengono premiati con Raccoin extra.
        </p>
      </td></tr>
    </table>
  </td></tr>

  <!-- Footer -->
  <tr><td style="padding:0 24px 32px;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <p style="font-size:11px;color:#444;margin:0;">
      JobHacker \u00B7 <a href="https://jobhacker.it" style="color:#444;text-decoration:none;">jobhacker.it</a>
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`,
  });
}

export async function sendFeedbackRewardEmail(to, name, credits, note) {
  if (!resend) return;

  const firstName = (name || '').split(' ')[0] || 'Ciao';
  const noteHtml = note
    ? `<tr><td style="padding:0 24px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#141414;border:1px solid #222;border-radius:8px;">
          <tr><td style="padding:16px;">
            <p style="font-size:12px;color:#888;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.5px;">Messaggio dal team</p>
            <p style="font-size:14px;line-height:1.5;color:#e0e0e0;margin:0;font-style:italic;">\u201C${note}\u201D</p>
          </td></tr>
        </table>
      </td></tr>`
    : '';

  await resend.emails.send({
    from: config.emailFrom,
    to,
    subject: `Il tuo feedback vale \u2014 +${credits} Raccoin`,
    html: `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0a0a0a;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0a0a0a;">
<tr><td align="center" style="padding:0;">
<table role="presentation" width="520" cellspacing="0" cellpadding="0" style="max-width:520px;width:100%;margin:0 auto;">

  <tr><td style="padding:32px 24px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <p style="font-size:18px;font-weight:700;color:#f5f5f5;margin:0 0 12px;text-align:center;">
      ${firstName}, il tuo feedback conta!
    </p>
    <p style="font-size:15px;line-height:1.6;color:#b0b0b0;margin:0 0 8px;text-align:center;">
      Il procione ha apprezzato la tua segnalazione e ti ha assegnato
    </p>
    <p style="font-size:32px;font-weight:800;color:#00E676;margin:0 0 20px;text-align:center;">
      +${credits} Raccoin
    </p>
  </td></tr>

  ${noteHtml}

  <tr><td align="center" style="padding:8px 24px 24px;">
    <a href="https://jobhacker.it" style="display:inline-block;padding:14px 40px;background:#00E676;color:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-weight:700;font-size:16px;border-radius:8px;text-decoration:none;">
      Usa i tuoi Raccoin
    </a>
  </td></tr>

  <tr><td style="padding:0 24px 32px;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <p style="font-size:11px;color:#444;margin:0;">
      JobHacker \u00B7 <a href="https://jobhacker.it" style="color:#444;text-decoration:none;">jobhacker.it</a>
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`,
  });
}

export async function sendRaccoinGiftEmail(to, name, credits, reason) {
  if (!resend) return;

  const firstName = (name || '').split(' ')[0] || 'Ciao';
  const reasonHtml = reason
    ? `<tr><td style="padding:0 24px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#141414;border:1px solid #222;border-radius:8px;">
          <tr><td style="padding:16px;">
            <p style="font-size:12px;color:#888;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.5px;">Messaggio dal procione</p>
            <p style="font-size:14px;line-height:1.5;color:#e0e0e0;margin:0;font-style:italic;">\u201C${reason}\u201D</p>
          </td></tr>
        </table>
      </td></tr>`
    : '';

  await resend.emails.send({
    from: config.emailFrom,
    to,
    subject: `Il procione ti fa un regalo \u2014 +${credits} Raccoin`,
    html: `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0a0a0a;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0a0a0a;">
<tr><td align="center" style="padding:0;">
<table role="presentation" width="520" cellspacing="0" cellpadding="0" style="max-width:520px;width:100%;margin:0 auto;">

  <tr><td style="padding:32px 24px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <p style="font-size:18px;font-weight:700;color:#f5f5f5;margin:0 0 12px;text-align:center;">
      ${firstName}, il procione ha pensato a te!
    </p>
    <p style="font-size:15px;line-height:1.6;color:#b0b0b0;margin:0 0 8px;text-align:center;">
      Hai ricevuto un regalo:
    </p>
    <p style="font-size:32px;font-weight:800;color:#00E676;margin:0 0 20px;text-align:center;">
      +${credits} Raccoin
    </p>
  </td></tr>

  ${reasonHtml}

  <tr><td align="center" style="padding:8px 24px 24px;">
    <a href="https://jobhacker.it" style="display:inline-block;padding:14px 40px;background:#00E676;color:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-weight:700;font-size:16px;border-radius:8px;text-decoration:none;">
      Usa i tuoi Raccoin
    </a>
  </td></tr>

  <tr><td style="padding:0 24px 32px;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <p style="font-size:11px;color:#444;margin:0;">
      JobHacker \u00B7 <a href="https://jobhacker.it" style="color:#444;text-decoration:none;">jobhacker.it</a>
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`,
  });
}
