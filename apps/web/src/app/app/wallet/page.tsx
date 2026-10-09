'use client';

import { Icon } from '@/components/icons';
import { Callout, ErrorState, Loading, PageHeader, Panel, PanelHeader, Stat } from '@/components/ui';
import { useApi } from '@/lib/api';

const APPLE_VARS = ['APPLE_PASS_TYPE_ID', 'APPLE_TEAM_ID', 'APPLE_WWDR_CERT_PATH', 'APPLE_SIGNER_CERT_PATH', 'APPLE_SIGNER_KEY_PATH', 'APPLE_SIGNER_KEY_PASSPHRASE'];
const GOOGLE_VARS = ['GOOGLE_WALLET_ISSUER_ID', 'GOOGLE_WALLET_SERVICE_EMAIL', 'GOOGLE_WALLET_PRIVATE_KEY'];

export default function Wallet() {
  const { data, error, mutate } = useApi<any>('/meta');
  const { data: a } = useApi<any>('/analytics?range=30');
  if (error) return <ErrorState error={error} retry={() => mutate()} />;
  const wallet = data?.wallet;
  const adds = a?.cur?.wallet_add || 0;
  const views = a?.channels?.find((c: any) => c.id === 'wallet')?.n || 0;

  return (
    <div>
      <PageHeader eyebrow="Sharing" title="Wallet passes" desc="A branded pass in every phone. When a title changes in HR, the pass updates itself." />
      {!a ? (
        <Loading />
      ) : (
        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <Stat label="Passes added · 30 days" value={adds.toLocaleString()} />
          <Stat label="Cards opened from wallet" value={views.toLocaleString()} />
          <Stat label="Share of all opens" value={`${a.channels.find((c: any) => c.id === 'wallet')?.pct || 0}%`} />
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        {(
          [
            ['Apple Wallet', wallet?.apple, APPLE_VARS, 'An Apple Developer account, a Pass Type ID and its certificate (.pem) plus the WWDR certificate.'],
            ['Google Wallet', wallet?.google, GOOGLE_VARS, 'A Google Wallet issuer account and a service account key with Wallet Object access.'],
          ] as const
        ).map(([name, ready, vars, need]) => (
          <Panel key={name}>
            <PanelHeader title={name} action={<span className={`flex items-center gap-1.5 text-[13px] ${ready ? 'text-ok' : 'text-warn'}`}><Icon name={ready ? 'checkCircle' : 'alert'} size={16} />{ready ? 'Ready' : 'Not set up'}</span>} />
            {ready ? (
              <p className="text-[14px] text-stone">Every live card offers an “Add to {name}” button on the public card and in the welcome email.</p>
            ) : (
              <>
                <p className="mb-3 text-[14px] text-stone">You need {need}</p>
                <p className="mb-2 text-[13px] text-stone-2">Add these to the API server’s environment, then restart it:</p>
                <ul className="flex flex-col gap-1 rounded-md bg-pearl p-3 font-mono text-[12px]">
                  {vars.map((v) => (
                    <li key={v}>{v}</li>
                  ))}
                </ul>
              </>
            )}
          </Panel>
        ))}
      </div>
      <div className="mt-6">
        <Callout icon="sync">Passes carry the card link and QR code. Title and office come from the card, so HR changes reach the pass the next time it refreshes.</Callout>
      </div>
    </div>
  );
}
