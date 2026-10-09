'use client';

import { useEffect, useState } from 'react';
import { mutate as globalMutate } from 'swr';
import { useToast } from '@/components/toast';
import { Button, cx, ErrorState, Field, Input, Loading, PageHeader, Panel, PanelHeader, Toggle } from '@/components/ui';
import { api, isAdmin, useApi, useMe } from '@/lib/api';
import { LANGS } from '@/lib/catalog';

export default function CompanySettings() {
  const { data, error, mutate } = useApi<any>('/settings');
  const { data: me } = useMe();
  const [f, setF] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  useEffect(() => {
    if (data && !f) setF({ name: data.name, country: data.country || '', city: data.city || '', languages: data.settings.languages });
  }, [data, f]);
  if (error) return <ErrorState error={error} retry={() => mutate()} />;
  if (!f) return <Loading />;
  const admin = isAdmin(me?.user.role);

  const save = async () => {
    setBusy(true);
    try {
      await api.patch('/settings/company', f);
      toast('Saved');
      mutate();
      globalMutate('/auth/me');
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader eyebrow="Settings" title="Company" actions={admin && <Button variant="ink" loading={busy} onClick={save}>Save</Button>} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Profile" />
          <fieldset disabled={!admin} className="grid gap-4 sm:grid-cols-2">
            <Field label="Company name" className="sm:col-span-2">{(id) => <Input id={id} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />}</Field>
            <Field label="Country">{(id) => <Input id={id} value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })} />}</Field>
            <Field label="City">{(id) => <Input id={id} value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} />}</Field>
          </fieldset>
        </Panel>
        <Panel>
          <PanelHeader title="Card languages" sub="Languages people can add to their cards" />
          <div className="flex flex-wrap gap-2">
            {Object.entries(LANGS).map(([code, name]) => {
              const on = f.languages.includes(code);
              return (
                <button
                  key={code}
                  type="button"
                  disabled={!admin || code === 'en'}
                  aria-pressed={on}
                  onClick={() => setF({ ...f, languages: on ? f.languages.filter((l: string) => l !== code) : [...f.languages, code] })}
                  className={cx('rounded-full px-3 py-1.5 text-[14px]', on ? 'bg-ink text-cream' : 'bg-pearl text-stone hover:text-ink')}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </Panel>
        {me?.company?.flags?.includes('public.team_page') && <TeamPagePanel slug={data.slug} on={data.settings.teamPage} admin={admin} onSaved={mutate} />}
      </div>
    </div>
  );
}

/** Opt-in public page listing everyone with a live card. */
function TeamPagePanel({ slug, on, admin, onSaved }: { slug: string; on: boolean; admin: boolean; onSaved: () => void }) {
  const toast = useToast();
  const set = async (teamPage: boolean) => {
    try {
      await api.patch('/settings/company', { teamPage });
      toast(teamPage ? 'Team page is live' : 'Team page is hidden');
      onSaved();
    } catch (e) {
      toast((e as Error).message, 'err');
    }
  };
  return (
    <Panel>
      <PanelHeader title="Team page" sub="One public page with everyone who has a live card, so visitors can find the right person" />
      <div className="flex items-center justify-between gap-4">
        {on ? (
          <a href={`/c/${slug}`} target="_blank" rel="noreferrer" className="text-[14px] text-gold-text hover:text-ink">
            Open the team page
          </a>
        ) : (
          <span className="text-[14px] text-stone-2">Hidden. Only individual cards can be opened.</span>
        )}
        <Toggle checked={on} disabled={!admin} label="Show the team page" onChange={set} />
      </div>
    </Panel>
  );
}
