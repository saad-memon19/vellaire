import { BadRequestException } from '@nestjs/common';

/**
 * Sends a lead to the company's CRM.
 * - hubspot: creates a contact with a private-app token
 * - webhook: POSTs the lead as JSON (works with Salesforce Flow, Zapier, Make, Pipedrive automations)
 */
export async function pushToCrm(company: any, lead: any): Promise<{ provider: string; id?: string }> {
  const crm = company?.settings?.crm || {};
  if (!crm.provider) throw new BadRequestException('Connect a CRM first in Leads → Connect a CRM');
  const [firstname, ...rest] = String(lead.name || '').split(' ');

  if (crm.provider === 'hubspot') {
    const res = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
      method: 'POST',
      headers: { Authorization: `Bearer ${crm.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        properties: {
          firstname,
          lastname: rest.join(' '),
          email: lead.email || undefined,
          phone: lead.phone || undefined,
          company: lead.company || undefined,
          jobtitle: lead.jobTitle || undefined,
          hs_lead_status: 'NEW',
        },
      }),
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok && res.status !== 409) throw new BadRequestException(`HubSpot refused the contact (${json.message || res.status})`);
    return { provider: 'HubSpot', id: json.id };
  }

  if (crm.provider === 'webhook' || crm.provider === 'salesforce') {
    if (!crm.webhookUrl) throw new BadRequestException('Add a webhook URL for your CRM');
    const res = await fetch(crm.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'vellaire',
        lead: {
          name: lead.name, firstName: firstname, lastName: rest.join(' '), email: lead.email, phone: lead.phone,
          company: lead.company, jobTitle: lead.jobTitle, note: lead.note, consent: lead.consent, metBy: lead.ownerName,
          via: lead.via, createdAt: lead.createdAt,
        },
      }),
    });
    if (!res.ok) throw new BadRequestException(`The CRM webhook answered ${res.status}`);
    return { provider: crm.provider === 'salesforce' ? 'Salesforce' : 'CRM' };
  }
  throw new BadRequestException('Unknown CRM');
}
