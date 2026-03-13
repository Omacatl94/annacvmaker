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
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; color: #e0e0e0; background: #0a0a0a;">
        <div style="text-align: center; margin-bottom: 24px;">
          <span style="font-size: 28px; font-weight: 700; color: #00E676;">JobHacker</span>
        </div>
        <p style="font-size: 16px; line-height: 1.6; color: #e0e0e0;">
          ${firstName}, il tuo account è stato attivato.
        </p>
        <p style="font-size: 16px; line-height: 1.6; color: #e0e0e0;">
          Hai <strong style="color: #00E676;">2 crediti</strong> per iniziare e <strong style="color: #00E676;">3 codici invito</strong> da condividere con chi vuoi.
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="https://jobhacker.it" style="display: inline-block; padding: 14px 32px; background: #00E676; color: #0a0a0a; font-weight: 700; font-size: 16px; border-radius: 8px; text-decoration: none;">
            Entra su JobHacker
          </a>
        </div>
        <p style="font-size: 14px; color: #888; line-height: 1.5;">
          Ogni invitato che genera il primo CV ti regala 1 credito extra. Il mercato del lavoro è truccato — gioca meglio.
        </p>
        <hr style="border: none; border-top: 1px solid #222; margin: 24px 0;">
        <p style="font-size: 12px; color: #555; text-align: center;">
          JobHacker · <a href="https://jobhacker.it" style="color: #555;">jobhacker.it</a>
        </p>
      </div>
    `,
  });
}
