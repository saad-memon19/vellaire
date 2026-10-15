'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Icon } from '@/components/icons';
import { ChangePassword } from '@/components/change-password';
import { useInstallApp } from '@/components/pwa';
import { useToast } from '@/components/toast';
import { Avatar, Button, copyText, Loading } from '@/components/ui';
import { api, useMe } from '@/lib/api';
import { useMyCard } from '../use-my-card';

export default function MobileSettings() {
  const { data: me } = useMe();
  const { data } = useMyCard();
  const [sig, setSig] = useState<string | null>(null);
  const [pwOpen, setPwOpen] = useState(false);
  const installApp = useInstallApp();
  const toast = useToast();
  if (!me) return <Loading />;

  const signOut = async () => {
    await api.post('/auth/logout');
    window.location.href = '/signin';
  };
  const copySignature = async () => {
    if (!data) return;
    const html = sig || (await api.get(`/me/signature`).then((r) => r.html).catch(() => null));
    if (!html) return toast('Ask your admin for your signature', 'info');
    setSig(html);
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([html], { type: 'text/plain' }) })]);
    } catch {
      await copyText(html);
    }
    toast('Signature copied. Paste it in Outlook or Gmail settings.');
  };

  const Row = ({ icon, label, sub, onClick, href }: { icon: string; label: string; sub?: string; onClick?: () => void; href?: string }) => {
    const inner = (
      <>
        <Icon name={icon} className="text-gold-text" />
        <span className="min-w-0 flex-1 text-left">
          <span className="block text-[15px]">{label}</span>
          {sub && <span className="block text-[13px] text-stone-2">{sub}</span>}
        </span>
        <Icon name="right" size={16} className="text-stone-2" />
      </>
    );
    return href ? (
      <Link href={href} className="flex items-center gap-3 px-4 py-3.5">
        {inner}
      </Link>
    ) : (
      <button type="button" onClick={onClick} className="flex w-full items-center gap-3 px-4 py-3.5">
        {inner}
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display text-[34px]">Settings</h1>
      <div className="flex items-center gap-4 rounded-xl border border-line bg-white p-4">
        <Avatar name={me.user.name} src={data?.card.fields.photoUrl} size={52} />
        <div className="min-w-0">
          <div className="text-[16px] font-medium">{me.user.name}</div>
          <div className="truncate text-[13px] text-stone-2">{me.user.email}</div>
          <div className="text-[13px] text-stone-2">{me.company?.name}</div>
        </div>
      </div>
      <div className="flex flex-col divide-y divide-linen rounded-xl border border-line bg-white">
        <Row icon="edit" label="Edit my card" sub="Bio, photo, links and languages" href="/m/edit" />
        {data && <Row icon="mail" label="Copy my email signature" sub="For Outlook and Gmail" onClick={copySignature} />}
        {data && <Row icon="external" label="Open my public card" onClick={() => window.open(data.card.url, '_blank')} />}
        <Row icon="lock" label="Password" sub="Set or change your password" onClick={() => setPwOpen(true)} />
        {me.user.role !== 'member' && !installApp.inApp && <Row icon="home" label="Company dashboard" href="/app" />}
        {installApp.canInstall && <Row icon="download" label="Install the app" sub="Add Vellaire to your home screen" onClick={installApp.install} />}
      </div>
      {installApp.help}
      <ChangePassword open={pwOpen} onClose={() => setPwOpen(false)} />
      <p className="px-1 text-[13px] text-stone-2">Your name, title and office come from your company’s HR system. Ask HR to change them.</p>
      <Button size="lg" icon="logout" onClick={signOut}>
        Sign out
      </Button>
    </div>
  );
}
