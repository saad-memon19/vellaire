import { config } from '../config';
import { db } from '../db/db';
import { getSetting } from './platform';

/** Every email Vellaire sends. The console lists these and can adjust their heading and add a note. */
export const EMAIL_TEMPLATES = {
  card_ready: { name: 'Welcome to your card', when: 'A new card is published' },
  invite: { name: 'Invitation to join', when: 'An admin invites a colleague' },
  signin: { name: 'Sign-in link', when: 'Someone signs in with email' },
  workspace_ready: {
    name: 'Workspace ready',
    when: 'Your team creates a trial workspace',
  },
  new_lead: { name: 'New lead received', when: 'Someone shares details back' },
  follow_up: { name: 'Lead follow-up', when: 'An employee sends a follow-up' },
  support_reply: { name: 'Support reply', when: 'Your team answers a ticket' },
  demo_request: {
    name: 'Demo request',
    when: 'A visitor books a demo (internal)',
  },
} as const;
export type EmailTemplate = keyof typeof EMAIL_TEMPLATES;
export interface EmailCopy {
  heading?: string;
  note?: string;
}

interface Mail {
  template: EmailTemplate;
  to: string;
  subject: string;
  heading: string;
  lines: string[];
  button?: { label: string; url: string };
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function render(m: Mail) {
  const btn = m.button
    ? `<p style="margin:28px 0"><a href="${esc(m.button.url)}" style="background:#17171B;color:#F6F1E7;text-decoration:none;padding:14px 22px;border-radius:6px;font-weight:500;display:inline-block">${esc(m.button.label)}</a></p>`
    : '';
  return `<!doctype html><html><body style="margin:0;background:#F7F5F0;font-family:Helvetica,Arial,sans-serif;color:#17171B">
<div style="max-width:520px;margin:0 auto;padding:40px 24px">
<div style="letter-spacing:.24em;font-size:13px;font-weight:600;color:#876A33">VELLAIRE</div>
<div style="background:#fff;border:1px solid #E6E0D5;border-radius:12px;padding:32px;margin-top:20px">
<h1 style="font-family:Georgia,serif;font-weight:400;font-size:28px;margin:0 0 16px">${esc(m.heading)}</h1>
${m.lines.map((l) => `<p style="font-size:15px;line-height:1.6;color:#4E4A44;margin:0 0 12px">${esc(l)}</p>`).join('')}
${btn}
</div>
<p style="font-size:12px;color:#6E685F;margin-top:20px">Your identity, impeccably shared.</p>
</div></body></html>`;
}

/** Sends one email and records it, so the console can show what was sent. */
export async function sendMail(mail: Mail) {
  // Copy changes made in the console apply to every send of this template
  const copy = await getSetting<EmailCopy>(`email.${mail.template}`, {});
  const m = {
    ...mail,
    heading: copy.heading || mail.heading,
    lines: copy.note ? [...mail.lines, copy.note] : mail.lines,
  };
  const result = await deliver(m);
  await db.EmailLog.create({
    template: m.template,
    to: m.to,
    delivered: result.delivered,
  }).catch(() => {});
  return result;
}

/** Sends with Resend when RESEND_API_KEY is set; otherwise prints the email to the API console. */
async function deliver(m: Mail) {
  if (!config.mail.resendKey) {
    console.log(`\n✉  [dev mail] to ${m.to}\n   ${m.subject}\n   ${m.lines.join('\n   ')}${m.button ? `\n   → ${m.button.url}` : ''}\n`);
    return { delivered: false };
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.mail.resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: config.mail.from,
      to: [m.to],
      subject: m.subject,
      html: render(m),
    }),
  });
  if (!res.ok) console.error('mail failed', res.status, await res.text());
  return { delivered: res.ok };
}
