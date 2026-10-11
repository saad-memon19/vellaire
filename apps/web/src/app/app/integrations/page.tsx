'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ErrorState, Loading } from '@/components/ui';
import { useApi } from '@/lib/api';

interface CatalogItem {
  id: string;
  ini: string;
  n: string;
  t: string;
  d: string;
  cat: string;
  href?: string;
}

const CATALOG: CatalogItem[] = [
  { id: 'sap', ini: 'SF', n: 'SAP SuccessFactors', t: 'HR', d: 'Joiners, changes and leavers from SAP.', cat: 'HR', href: '/app/integrations/sap' },
  { id: 'oracle', ini: 'O', n: 'Oracle HCM', t: 'HR', d: 'Sync employee records from Oracle.', cat: 'HR' },
  { id: 'bamboohr', ini: 'B', n: 'BambooHR', t: 'HR', d: 'Popular with growing teams.', cat: 'HR', href: '/app/integrations/bamboohr' },
  { id: 'personio', ini: 'P', n: 'Personio', t: 'HR', d: 'Common across Europe.', cat: 'HR' },
  { id: 'hibob', ini: 'Hb', n: 'HiBob', t: 'HR', d: 'Modern HR for global teams.', cat: 'HR' },
  { id: 'zoho', ini: 'Z', n: 'Zoho People', t: 'HR', d: 'Zoho HR and directory.', cat: 'HR' },
  { id: 'odoo', ini: 'Od', n: 'Odoo', t: 'ERP', d: 'Employees from your Odoo ERP.', cat: 'Other' },
  { id: 'adp', ini: 'A', n: 'ADP', t: 'HR', d: 'Workforce Now records.', cat: 'HR' },
  { id: 'okta', ini: 'Ok', n: 'Okta', t: 'Identity', d: 'SSO and SCIM provisioning.', cat: 'Identity', href: '/app/settings/security' },
  { id: 'google', ini: 'G', n: 'Google Workspace', t: 'Identity', d: 'Directory and Google sign-in.', cat: 'Identity' },
  { id: 'hubspot', ini: 'Hs', n: 'HubSpot', t: 'CRM', d: 'Send captured leads to HubSpot.', cat: 'CRM', href: '/app/leads' },
  { id: 'custom', ini: '{ }', n: 'Custom API', t: 'Other', d: 'For your own ERP or HR system.', cat: 'Other' },
];

export default function Integrations() {
  const { data, error, mutate } = useApi<any>('/integrations');
  const [cat, setCat] = useState('All');
  const [q, setQ] = useState('');

  if (error) return <ErrorState error={error} retry={() => mutate()} />;
  if (!data) return <Loading />;

  // Connected providers
  const connectedList = [
    {
      ini: 'W',
      n: 'Workday',
      what: 'Creates, updates and switches off cards',
      records: `${data.providers?.find((p: any) => p.id === 'workday')?.people?.toLocaleString() || '1,320'} people`,
      last: 'Synced 4 min ago',
      href: '/app/integrations/workday',
    },
    {
      ini: 'E',
      n: 'Microsoft Entra ID',
      what: 'Single sign-on and automatic accounts (SCIM)',
      records: `${data.providers?.find((p: any) => p.id === 'workday')?.people?.toLocaleString() || '1,320'} people`,
      last: 'Real time',
      href: '/app/settings/security',
    },
  ];

  const categories = ['All', 'HR', 'Identity', 'CRM', 'Other'];

  const filteredCatalog = CATALOG.filter((item) => {
    const matchesCat = cat === 'All' || item.cat === cat;
    const matchesQ = !q || item.n.toLowerCase().includes(q.toLowerCase()) || item.d.toLowerCase().includes(q.toLowerCase());
    return matchesCat && matchesQ;
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="text-[12px] font-medium tracking-[0.2em] text-[#876A33]">AUTOMATION</div>
          <h1 className="m-0 font-display text-[42px] font-normal leading-[1.05] text-[#17171B]">HR integrations</h1>
          <p className="m-0 text-[15px] text-[#5E5952]">Connect the systems where your people already live. Cards follow every joiner, change and leaver.</p>
        </div>
        <div>
          <Link
            href="/app/employees?import=1"
            className="flex h-11 items-center rounded-lg border border-[#D9D2C4] bg-white px-4 text-[14px] text-[#17171B] transition-colors hover:bg-[#FAF7F1]"
          >
            Upload a CSV instead
          </Link>
        </div>
      </div>

      {/* Connected Section */}
      <section className="overflow-hidden rounded-[14px] border border-[#E6E0D5] bg-white">
        <div className="p-[18px_20px] text-[16px] font-semibold text-[#17171B]">Connected</div>
        <div className="flex flex-col">
          {connectedList.map((c) => (
            <div
              key={c.n}
              className="flex flex-wrap items-center gap-4 border-t border-[#F0EBE2] p-[16px_20px]"
            >
              <span className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-xl bg-[#17171B] font-display text-[20px] text-[#E6D3A3]">
                {c.ini}
              </span>
              <div className="flex min-w-[220px] flex-1 flex-col gap-0.5">
                <span className="text-[15px] font-semibold text-[#17171B]">{c.n}</span>
                <span className="text-[13px] text-[#5E5952]">{c.what}</span>
              </div>
              <div className="flex flex-col gap-0.5 text-[13px] text-[#4E4A44]">
                <span>{c.records}</span>
                <span className="text-[#6E685F]">{c.last}</span>
              </div>
              <span className="rounded-full bg-[#E5F2EB] px-2.5 py-1 text-[12px] font-medium text-[#1F7A55]">
                Healthy
              </span>
              <Link
                href={c.href}
                className="inline-flex h-9 items-center rounded-lg border border-[#E0D9CC] bg-white px-3 text-[13px] font-medium text-[#17171B] transition-colors hover:bg-[#FAF7F1]"
              >
                Settings
              </Link>
              <Link
                href="/app/integrations/activity"
                className="inline-flex h-9 items-center rounded-lg border border-[#E0D9CC] bg-white px-3 text-[13px] font-medium text-[#17171B] transition-colors hover:bg-[#FAF7F1]"
              >
                Activity
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Search & Category Filter Pills */}
      <div className="flex flex-wrap items-center gap-2.5">
        <label htmlFor="hs" className="flex h-[42px] min-w-[240px] max-w-[380px] flex-[1_1_280px] items-center gap-2.5 rounded-lg border border-[#E6E0D5] bg-white px-3 text-[#6E685F]">
          <svg className="h-[18px] w-[18px] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-3.5-3.5" />
          </svg>
          <input
            id="hs"
            type="search"
            placeholder="Search 40+ systems"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-[14px] text-[#17171B] outline-none placeholder:text-[#6E685F]"
          />
        </label>

        <div className="flex flex-wrap items-center gap-2">
          {categories.map((c) => {
            const on = cat === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setCat(c)}
                className={`rounded-full px-3.5 py-2 text-[13px] font-medium transition-colors ${
                  on
                    ? 'border border-[#17171B] bg-[#17171B] text-white'
                    : 'border border-[#E0D9CC] bg-white text-[#17171B] hover:border-[#B08D4F]'
                }`}
              >
                {c}
              </button>
            );
          })}
        </div>
      </div>

      {/* Catalog Grid */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(260px,100%),1fr))] gap-3">
        {filteredCatalog.map((c) => (
          <div
            key={c.id}
            className="flex flex-col gap-3 rounded-[14px] border border-[#E6E0D5] bg-white p-4"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[#F6EFE1] font-semibold text-[#876A33]">
                {c.ini}
              </span>
              <div className="flex flex-col gap-0.5">
                <span className="text-[14px] font-semibold text-[#17171B]">{c.n}</span>
                <span className="text-[12px] text-[#6E685F]">{c.t}</span>
              </div>
            </div>
            <span className="text-[13px] leading-[1.5] text-[#5E5952]">{c.d}</span>
            <div className="mt-auto pt-1">
              <Link
                href={c.href || `/app/integrations/${c.id}`}
                className="flex h-[38px] w-full items-center justify-center rounded-lg border border-[#17171B] bg-white text-[13.5px] font-medium text-[#17171B] transition-colors hover:bg-[#17171B] hover:text-white"
              >
                Connect
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
