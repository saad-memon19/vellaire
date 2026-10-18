import { api } from '@/lib/api';

/**
 * Sends a follow-up. With an email service the API sends it from Vellaire; without one the phone's own
 * mail app opens with the draft, and the lead is marked as followed up. Returns how it went out.
 */
export async function sendFollowUp(lead: { id: string; email?: string; mailReady?: boolean }, text: string, company?: string) {
  if (lead.mailReady) {
    await api.post(`/leads/${lead.id}/send`, { text });
    return 'sent' as const;
  }
  if (!lead.email) throw new Error('This lead has no email address');
  const subject = encodeURIComponent(`Following up${company ? ` · ${company}` : ''}`);
  window.location.href = `mailto:${lead.email}?subject=${subject}&body=${encodeURIComponent(text)}`;
  await api.patch(`/leads/${lead.id}`, { status: 'followed_up', draft: text });
  return 'mail-app' as const;
}

/** A contact file for the phone's address book. */
export function downloadVcard(l: { name: string; company?: string; jobTitle?: string; email?: string; phone?: string }) {
  const esc = (s = '') => s.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');
  const lines = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${esc(l.name)}`, l.company && `ORG:${esc(l.company)}`, l.jobTitle && `TITLE:${esc(l.jobTitle)}`, l.email && `EMAIL:${esc(l.email)}`, l.phone && `TEL:${esc(l.phone)}`, 'END:VCARD'];
  download(lines.filter(Boolean).join('\r\n'), `${l.name}.vcf`, 'text/vcard');
}

/** A calendar event for tomorrow at 9:00, for "Set a reminder"; it opens in the phone's calendar. */
export function downloadReminder(name: string) {
  const at = new Date();
  at.setDate(at.getDate() + 1);
  at.setHours(9, 0, 0, 0);
  const t = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const end = new Date(at.getTime() + 15 * 60_000);
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Vellaire//EN', 'BEGIN:VEVENT', `UID:${Date.now()}@vellaire`, `DTSTAMP:${t(new Date())}`, `DTSTART:${t(at)}`, `DTEND:${t(end)}`, `SUMMARY:Follow up with ${name}`, 'BEGIN:VALARM', 'TRIGGER:-PT0M', 'ACTION:DISPLAY', `DESCRIPTION:Follow up with ${name}`, 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'];
  download(ics.join('\r\n'), `Follow up with ${name}.ics`, 'text/calendar');
}

function download(text: string, name: string, type: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
