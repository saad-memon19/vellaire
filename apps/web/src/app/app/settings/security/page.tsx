'use client';

import { Icon } from '@/components/icons';
import { Callout, ErrorState, LinkButton, Loading, PageHeader, Panel, PanelHeader } from '@/components/ui';
import { useApi } from '@/lib/api';

export default function Security() {
  const { data, error, mutate } = useApi<any>('/settings');
  if (error) return <ErrorState error={error} retry={() => mutate()} />;
  if (!data) return <Loading />;
  const region: Record<string, string> = { me: 'Middle East', eu: 'European Union', us: 'United States' };
  return (
    <div>
      <PageHeader eyebrow="Settings" title="Security and SSO" desc="How people sign in, how accounts are provisioned, and where your data lives." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Sign-in methods" />
          <ul className="flex flex-col divide-y divide-linen text-[14px]">
            {[
              ['Magic link by email', 'On for everyone', true],
              ['Google', 'Available when set up for Vellaire', true],
              ['Microsoft', 'Available when set up for Vellaire', true],
              ['Single sign-on (SAML / OIDC)', data.settings.sso?.provider ? `Connected · ${data.settings.sso.provider}` : 'Contact us to enable for your domain', !!data.settings.sso?.provider],
            ].map(([t, s, on]) => (
              <li key={t as string} className="flex items-center justify-between gap-3 py-3">
                <span>
                  <span className="block font-medium">{t}</span>
                  <span className="block text-[13px] text-stone-2">{s}</span>
                </span>
                <Icon name={on ? 'checkCircle' : 'info'} className={on ? 'text-ok' : 'text-stone-2'} />
              </li>
            ))}
          </ul>
        </Panel>
        <Panel>
          <PanelHeader title="Automatic provisioning (SCIM)" sub="Create and remove people from your identity provider" />
          <p className="mb-4 text-[14px] text-stone">{data.settings.scimConfigured ? 'A SCIM token is active. People are provisioned from your identity provider.' : 'Not set up. Use it with Microsoft Entra ID, Okta or OneLogin.'}</p>
          <LinkButton href="/app/integrations/entra" icon="sync">
            {data.settings.scimConfigured ? 'Manage SCIM' : 'Set up SCIM'}
          </LinkButton>
        </Panel>
        <Panel>
          <PanelHeader title="Data" />
          <dl className="flex flex-col gap-2 text-[14px]">
            {[
              ['Data region', region[data.dataRegion] || data.dataRegion],
              ['Encryption', 'TLS in transit, AES-256 for stored HR credentials'],
              ['Tenant isolation', 'Every record is scoped to your company'],
              ['AI training', 'Your people’s data is never used to train any model'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 border-b border-linen pb-2">
                <dt className="text-stone-2">{k}</dt>
                <dd className="text-right">{v}</dd>
              </div>
            ))}
          </dl>
        </Panel>
        <Panel>
          <PanelHeader title="Staff access" />
          <Callout icon="eye">Vellaire support can open your dashboard only to help you. Every visit is logged in your activity and shown on a banner while it lasts.</Callout>
        </Panel>
      </div>
    </div>
  );
}
