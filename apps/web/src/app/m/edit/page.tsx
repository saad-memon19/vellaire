'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useToast } from '@/components/toast';
import { Loading } from '@/components/ui';
import { api, useMe } from '@/lib/api';
import { LANGS } from '@/lib/catalog';
import { NoCard } from '../no-card';
import { useMyCard } from '../use-my-card';

export default function EditMyCard() {
  const { data, error, mutate } = useMyCard();
  const [f, setF] = useState<{
    mobile: string;
    linkedin: string;
    bio: string;
  } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();
  const { data: me } = useMe();

  useEffect(() => {
    if (data && !f) {
      const c = data.card;
      const linkedinLink = c.links?.find((l: any) => l.type === 'linkedin');
      setF({
        mobile: c.fields.mobile || '',
        linkedin: linkedinLink?.url ? linkedinLink.url.replace(/^https?:\/\/(www\.)?/, '') : '',
        bio: c.fields.bio || '',
      });
    }
  }, [data, f]);

  if (error) return <NoCard />;
  if (!data || !f) return <Loading />;

  const c = data.card;
  const languages = (data.languages as string[]).map((l) => LANGS[l] || l.toUpperCase()).join(' · ');

  const save = async () => {
    setBusy('save');
    try {
      const links = (c.links || []).filter((l: any) => l.type !== 'linkedin');
      if (f.linkedin) {
        const fullUrl = f.linkedin.startsWith('http') ? f.linkedin : `https://${f.linkedin}`;
        links.push({
          type: 'linkedin',
          label: 'LinkedIn',
          url: fullUrl,
          sub: f.linkedin.replace(/^https?:\/\/(www\.)?/, ''),
        });
      }
      const body: any = {
        mobile: f.mobile,
        bio: f.bio,
        links,
      };
      const r = await api.patch<{ message: string }>('/me/card', body);
      toast(r.message || 'Saved', 'ok');
      await mutate();
    } catch (e: any) {
      toast(e.message || 'Failed to save', 'err');
    } finally {
      setBusy(null);
    }
  };

  const hasPendingPhoto = data.pendingPhoto;

  return (
    <>
      {/* 1. Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/m"
          aria-label="Back"
          className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-[#E6E0D5] bg-white text-[#17171B]"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </Link>
        <h1 className="m-0 font-display text-[30px] font-medium leading-tight text-[#17171B]">Edit my card</h1>
      </div>

      {/* 2. Profile photo row */}
      <div className="flex items-center gap-3.5 rounded-[16px] border border-[#E6E0D5] bg-white p-3.5">
        <span className="box-border flex h-16 w-16 shrink-0 items-center justify-center rounded-full p-0.5" style={{ background: 'linear-gradient(140deg, #E6D3A3, #9C7A44)' }}>
          {c.fields.photoUrl ? (
            <img src={c.fields.photoUrl} alt="" className="box-border h-full w-full rounded-full border-2 border-white object-cover" />
          ) : (
            <span className="box-border flex h-full w-full items-center justify-center rounded-full border-2 border-white bg-[#F2EEE6] font-display text-[22px] font-semibold text-[#876A33]">
              {data.initials}
            </span>
          )}
        </span>
        <span className="flex flex-1 flex-col gap-0.5">
          <span className="font-semibold text-[#17171B]">Profile photo</span>
          <span className={`text-[12px] ${hasPendingPhoto ? 'text-[#8A5A12]' : 'text-[#6E685F]'}`}>
            {hasPendingPhoto ? 'New photo waiting for approval' : 'Shown on your digital card'}
          </span>
        </span>
        <Link href="/m/edit/photo" className="text-[13px] font-semibold text-[#876A33] hover:underline">
          Change
        </Link>
      </div>

      {/* 3. Fields Section */}
      <section className="flex flex-col gap-3 rounded-[16px] border border-[#E6E0D5] bg-white p-4">
        {/* Name */}
        <div className="flex flex-col gap-1.5">
          <span className="flex justify-between text-[12.5px]">
            <span className="font-medium text-[#17171B]">Name</span>
            <span className="text-[#6E685F]">From HR</span>
          </span>
          <span className="flex h-11 items-center rounded-[10px] border border-[#E0D9CC] bg-[#F7F5F0] px-3 text-[14px] text-[#5E5952]">
            {c.fields.name}
          </span>
        </div>

        {/* Title */}
        <div className="flex flex-col gap-1.5">
          <span className="flex justify-between text-[12.5px]">
            <span className="font-medium text-[#17171B]">Title</span>
            <span className="text-[#6E685F]">From HR</span>
          </span>
          <span className="flex h-11 items-center rounded-[10px] border border-[#E0D9CC] bg-[#F7F5F0] px-3 text-[14px] text-[#5E5952]">
            {c.fields.title || '—'}
          </span>
        </div>

        {/* Mobile */}
        <div className="flex flex-col gap-1.5">
          <span className="flex justify-between text-[12.5px]">
            <span className="font-medium text-[#17171B]">Mobile</span>
            <span className="text-[#1F7A55]">You can edit</span>
          </span>
          <input
            type="tel"
            value={f.mobile}
            placeholder="Your mobile number"
            onChange={(e) => setF({ ...f, mobile: e.target.value })}
            className="h-11 rounded-[10px] border border-[#E0D9CC] bg-white px-3 font-sans text-[14px] text-[#17171B] outline-none focus:border-ink"
          />
        </div>

        {/* LinkedIn */}
        <div className="flex flex-col gap-1.5">
          <span className="flex justify-between text-[12.5px]">
            <span className="font-medium text-[#17171B]">LinkedIn</span>
            <span className="text-[#1F7A55]">You can edit</span>
          </span>
          <input
            type="text"
            value={f.linkedin}
            placeholder="linkedin.com/in/your-name"
            onChange={(e) => setF({ ...f, linkedin: e.target.value })}
            className="h-11 rounded-[10px] border border-[#E0D9CC] bg-white px-3 font-sans text-[14px] text-[#17171B] outline-none focus:border-ink"
          />
        </div>
      </section>

      {/* 4. About box */}
      <section className="flex flex-col gap-2.5 rounded-[16px] border border-[#EBDDC0] bg-[#FBF6EC] p-4">
        <span className="flex items-center justify-between">
          <span className="font-semibold text-[#17171B]">About</span>
          {me?.features.ai && (
            <Link href="/m/edit/bio" className="font-sans text-[12.5px] font-semibold text-[#876A33] hover:underline">
              Write with AI
            </Link>
          )}
        </span>
        <textarea
          rows={2}
          value={f.bio}
          placeholder="A line or two about your work"
          onChange={(e) => setF({ ...f, bio: e.target.value })}
          className="w-full resize-none border-none bg-transparent p-0 font-sans text-[13.5px] leading-[1.55] text-[#2A2A30] outline-none"
        />
        <Link href="/m/cards" className="text-[12px] text-[#5E5952] hover:underline">
          {languages}
        </Link>
      </section>

      {/* 5. Save changes button */}
      <button
        type="button"
        onClick={save}
        disabled={busy === 'save'}
        className="mt-auto h-[52px] cursor-pointer rounded-[14px] border-none bg-[#17171B] font-sans text-[15px] font-semibold text-white hover:bg-[#2E2E35] disabled:opacity-60"
      >
        {busy === 'save' ? 'Saving...' : 'Save changes'}
      </button>
    </>
  );
}
