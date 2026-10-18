'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ChangePassword } from '@/components/change-password';
import { Icon, IconName } from '@/components/icons';
import { useInstallApp } from '@/components/pwa';
import { useToast } from '@/components/toast';
import { Avatar, cx, Loading, Modal } from '@/components/ui';
import { api, useApi, useMe } from '@/lib/api';
import { useMyCard } from '../use-my-card';

/** Settings (E6): profile, card switches, NFC and wallet, signature, help and sign out. */
export default function MobileSettings() {
  const { data: me } = useMe();
  const { data, mutate } = useMyCard();
  const { data: prefs, mutate: reloadPrefs } = useApi<{ notifyLeads: boolean }>('/me/notifications', { shouldRetryOnError: false });
  const [pwOpen, setPwOpen] = useState(false);
  const [help, setHelp] = useState(false);
  const [lost, setLost] = useState(false);
  const [busy, setBusy] = useState(false);
  const installApp = useInstallApp();
  const toast = useToast();
  if (!me) return <Loading />;

  const nfc = data?.devices?.find((d: any) => d.status === 'active') || data?.devices?.[0];
  const signOut = async () => {
    await api.post('/auth/logout');
    window.location.href = '/signin';
  };
  const toggleMobile = async () => {
    try {
      await api.patch('/me/card', { showMobile: !data.showMobile });
      await mutate();
      toast(data.showMobile ? 'Your mobile number is hidden from your card' : 'Your mobile number shows on your card');
    } catch (e) {
      toast((e as Error).message, 'err');
    }
  };
  const toggleLeads = async () => {
    try {
      await api.patch('/me/preferences', { notifyLeads: !prefs!.notifyLeads });
      await reloadPrefs();
      toast(prefs!.notifyLeads ? 'Lead emails off. New leads still show in the app.' : 'You will get an email for each new lead');
    } catch (e) {
      toast((e as Error).message, 'err');
    }
  };
  const reportLost = async () => {
    setBusy(true);
    try {
      await api.post(`/me/nfc/${nfc.id}/lost`);
      await mutate();
      toast('Your NFC card is switched off. Your admin can order a new one.');
      setLost(false);
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-[34px] font-medium">Settings</h1>
      <div className="flex items-center gap-3.5">
        <Avatar name={me.user.name} src={data?.card.fields.photoUrl} size={56} />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[17px] font-semibold">{me.user.name}</span>
          <span className="truncate text-[13px] text-stone">
            {me.user.email}
            {me.company?.name ? ` · ${me.company.name}` : ''}
          </span>
        </span>
      </div>

      <Section>
        <Row
          icon="bell"
          label="Notifications"
          sub={prefs ? (prefs.notifyLeads ? 'Email me about new leads · all updates in the app' : 'Only in the app') : 'New leads, approvals, card updates'}
          onClick={prefs ? toggleLeads : undefined}
          right={<Switch on={!!prefs?.notifyLeads} disabled={!prefs} label="Email me about new leads" />}
        />
        <Row icon="eye" label="See notifications" href="/m/notifications" />
        {data && (
          <Row
            icon="phone"
            label="Show my mobile number"
            sub={data.card.fields.mobile ? 'On my public card' : 'Add a mobile in Edit my card first'}
            onClick={data.card.fields.mobile ? toggleMobile : undefined}
            right={<Switch on={!!data.card.fields.mobile && data.showMobile} disabled={!data.card.fields.mobile} label="Show my mobile number" />}
          />
        )}
        <Row icon="language" label="Language" sub="English" />
      </Section>

      {data && (
        <Section>
          <Row
            icon="nfc"
            label="My NFC card"
            sub={nfc ? `${nfc.name} · ${nfc.status === 'active' ? `active${nfc.lastTap ? `, last tap ${nfc.lastTap}` : ''}` : nfc.status}` : 'No NFC card yet. Your company orders them.'}
            href="/m/nfc"
            right={nfc && <span className={cx('rounded-full px-2.5 py-[3px] text-[12px]', nfc.status === 'active' ? 'bg-ok-bg text-ok' : 'bg-[#EFEBE3] text-stone')}>{nfc.status === 'active' ? 'Active' : nfc.status === 'lost' ? 'Lost' : 'Off'}</span>}
          />
          <Row icon="wallet" label="Wallet pass" sub={data.wallet.apple || data.wallet.google ? 'Add your card to Apple or Google Wallet' : 'Not set up by your company yet'} href={data.wallet.apple || data.wallet.google ? '/m/share' : undefined} />
          <Row icon="mail" label="Signature and call background" sub="Copy or download" href="/m/settings/signature" />
          {nfc?.status === 'active' && <Row icon="alert" label="Report lost card" sub="Switches off the card instantly" onClick={() => setLost(true)} />}
        </Section>
      )}

      <Section>
        <Row icon="lock" label="Password" sub="Set or change your password" onClick={() => setPwOpen(true)} />
        {data && <Row icon="external" label="Open my public card" onClick={() => window.open(data.card.url, '_blank')} />}
        {me.user.role !== 'member' && !installApp.inApp && <Row icon="home" label="Company dashboard" href="/app" />}
        {installApp.canInstall && <Row icon="download" label="Install the app" sub="Add Vellaire to your home screen" onClick={installApp.install} />}
      </Section>
      {installApp.help}

      <Section>
        <Row icon="info" label="Help" sub="Guides and contact" onClick={() => setHelp(true)} />
        <Row icon="logout" label="Sign out" onClick={signOut} chevron={false} />
      </Section>
      <span className="text-center text-[11.5px] text-[#8E887E]">Vellaire · version {process.env.NEXT_PUBLIC_APP_VERSION}</span>

      <ChangePassword open={pwOpen} onClose={() => setPwOpen(false)} />
      <Modal open={lost} onClose={() => setLost(false)} title="Report lost card">
        <p className="text-[14px] leading-relaxed text-stone">
          Your {nfc?.name} stops opening your card straight away. Your QR code, link and wallet pass keep working. Your admin can switch it back on or order a new one.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <button type="button" onClick={() => setLost(false)} className="h-11 rounded-xl border border-line bg-white text-[14px]">
            Cancel
          </button>
          <button type="button" disabled={busy} onClick={reportLost} className="h-11 rounded-xl bg-err text-[14px] font-semibold text-white disabled:opacity-50">
            Switch it off
          </button>
        </div>
      </Modal>
      <Modal open={help} onClose={() => setHelp(false)} title="Help">
        <ul className="m-0 flex list-none flex-col gap-3 p-0 text-[14px] leading-relaxed text-stone">
          <li>
            <b className="text-ink">Your name, title or office is wrong.</b> These come from your company&apos;s HR system. Ask HR to change them.
          </li>
          <li>
            <b className="text-ink">Your photo is waiting.</b> A Brand Manager at {me.company?.name || 'your company'} approves new photos.
          </li>
          <li>
            <b className="text-ink">Sharing your card.</b> Show your QR, tap your NFC card on a phone, or send your link from Share.
          </li>
          <li>
            <b className="text-ink">Anything else.</b> Ask your company admin, who can contact Vellaire support from the dashboard.
          </li>
        </ul>
      </Modal>
    </div>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return <section className="overflow-hidden rounded-2xl border border-linen bg-white [&>*+*]:border-t [&>*+*]:border-[#F0EBE2]">{children}</section>;
}

function Row({ icon, label, sub, right, href, onClick, chevron = true }: { icon: IconName; label: string; sub?: string; right?: React.ReactNode; href?: string; onClick?: () => void; chevron?: boolean }) {
  const inner = (
    <>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-gold-tint text-gold-text">
        <Icon name={icon} size={18} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
        <span className="text-[15px]">{label}</span>
        {sub && <span className="text-[12.5px] text-stone">{sub}</span>}
      </span>
      {right ?? ((href || onClick) && chevron && <Icon name="right" size={16} className="text-stone-2" />)}
    </>
  );
  const cls = 'flex min-h-11 w-full items-center gap-3 px-4 py-[13px] text-ink';
  if (href)
    return (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    );
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={cls}>
        {inner}
      </button>
    );
  return <div className={cls}>{inner}</div>;
}

function Switch({ on, disabled, label }: { on: boolean; disabled?: boolean; label: string }) {
  return (
    <span role="switch" aria-checked={on} aria-label={label} aria-disabled={disabled} className={cx('relative h-7 w-[46px] shrink-0 rounded-full', on ? 'bg-ink' : 'bg-[#D9D2C4]', disabled && 'opacity-50')}>
      <span className={cx('absolute top-1 h-5 w-5 rounded-full', on ? 'left-[22px] bg-[#E6D3A3]' : 'left-1 bg-white')} />
    </span>
  );
}
