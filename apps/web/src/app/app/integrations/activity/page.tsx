'use client';

import { useState } from 'react';
import { useToast } from '@/components/toast';
import { ErrorState, Loading } from '@/components/ui';
import { api, useApi } from '@/lib/api';

interface SyncIssue {
  id: string;
  who: string;
  why: string;
  fix: string;
}

interface SyncRunItem {
  id: string;
  when: string;
  src: string;
  add: number;
  up: number;
  off: number;
  skip: number;
  status: string;
}

interface ActivityPayload {
  provider: string;
  guardPct: number;
  issues: SyncIssue[];
  runs: SyncRunItem[];
}

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  Synced: { bg: '#E5F2EB', color: '#1F7A55' },
  Review: { bg: '#FBF0DC', color: '#8A5A12' },
  Failed: { bg: '#F8E4E7', color: '#A3283A' },
  Pending: { bg: '#FBF0DC', color: '#8A5A12' },
  Draft: { bg: '#EFEBE3', color: '#4E4A44' },
};

export default function SyncActivity() {
  const toast = useToast();
  const { data, error, mutate } = useApi<ActivityPayload>('/integrations/activity');
  const [syncing, setSyncing] = useState(false);

  if (error) return <ErrorState error={error} retry={() => mutate()} />;
  if (!data) return <Loading />;

  const issues = data.issues || [];
  const runs = data.runs || [];

  const handleDownloadLog = () => {
    if (!runs.length) return;
    const header = ['When', 'Source', 'Created', 'Updated', 'Switched off', 'Skipped', 'Status'];
    const rows = runs.map((r) => [`"${r.when}"`, `"${r.src}"`, r.add, r.up, r.off, r.skip, `"${r.status}"`]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [header.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `sync_activity_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      const provId = (data.provider || 'workday').toLowerCase();
      await api.post(`/integrations/${provId}/sync`, { force: true });
      toast('Sync completed', 'ok');
      await mutate();
    } catch (err: any) {
      toast(err.message || 'Sync failed', 'err');
    } finally {
      setSyncing(false);
    }
  };

  const handleSkip = async (issueId: string) => {
    try {
      await api.post('/integrations/activity/skip-issue', { id: issueId });
      toast('Issue skipped', 'ok');
      await mutate();
    } catch (err: any) {
      toast(err.message || 'Could not skip issue', 'err');
    }
  };

  const handleFix = (issue: SyncIssue) => {
    if (issue.fix === 'Map department') {
      window.location.href = '/app/departments';
    } else {
      const email = window.prompt(`Enter work email for ${issue.who}:`);
      if (email) {
        api
          .post('/integrations/activity/fix-issue', { id: issue.id, email })
          .then(() => {
            toast('Email added', 'ok');
            mutate();
          })
          .catch((e: any) => toast(e.message, 'err'));
      }
    }
  };

  return (
    <div className="flex w-full max-w-[1320px] flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="text-[12px] font-medium tracking-[0.2em] text-[#876A33]">AUTOMATION</div>
          <h1 className="m-0 font-display text-[42px] font-normal leading-[1.05] text-[#17171B]">Sync activity</h1>
          <p className="m-0 text-[15px] text-[#5E5952]">What {data.provider || 'Workday'} changed, when, and anything that needs you.</p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={handleDownloadLog}
            className="h-11 cursor-pointer rounded-lg border border-[#D9D2C4] bg-white px-4 text-[14px] text-[#17171B] hover:border-ink hover:text-ink"
          >
            Download log
          </button>
          <button
            type="button"
            onClick={handleSyncNow}
            disabled={syncing}
            className="h-11 cursor-pointer rounded-lg bg-[#17171B] px-[18px] text-[14px] font-semibold text-white hover:bg-[#2E2E35] disabled:opacity-60"
          >
            {syncing ? 'Syncing...' : 'Sync now'}
          </button>
        </div>
      </div>

      {/* Amber alert box */}
      {issues.length > 0 && (
        <section className="overflow-hidden rounded-[14px] border border-[#EBD3A8] bg-[#FBF0DC]">
          <div className="flex items-center gap-2.5 px-5 py-4">
            <svg className="h-[18px] w-[18px] shrink-0 text-[#8A5A12]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 4l9 16H3zM12 10v4M12 17h.01" />
            </svg>
            <h2 className="m-0 text-[16px] font-semibold text-[#17171B]">
              {issues.length} {issues.length === 1 ? 'person needs' : 'people need'} your help
            </h2>
          </div>
          {issues.map((issue) => (
            <div key={issue.id} className="flex flex-wrap items-center gap-3.5 border-t border-[#EEDDB8] bg-[#FFFDF8] px-5 py-3.5">
              <span className="flex flex-1 basis-[260px] flex-col gap-0.5">
                <span className="font-semibold text-[#17171B]">{issue.who}</span>
                <span className="text-[13px] text-[#5E5952]">{issue.why}</span>
              </span>
              <button
                type="button"
                onClick={() => handleSkip(issue.id)}
                className="h-9 cursor-pointer rounded-lg border border-[#E0D9CC] bg-white px-3 text-[13px] text-[#17171B] hover:border-ink"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={() => handleFix(issue)}
                className="h-9 cursor-pointer rounded-lg bg-[#17171B] px-3 text-[13px] text-white hover:bg-[#2E2E35]"
              >
                {issue.fix}
              </button>
            </div>
          ))}
        </section>
      )}

      {/* Recent syncs */}
      <section className="overflow-hidden rounded-[14px] border border-[#E6E0D5] bg-white">
        <div className="px-5 py-[18px] text-[16px] font-semibold text-[#17171B]">Recent syncs</div>
        {runs.map((r) => {
          const style = STATUS_STYLES[r.status] || { bg: '#EFEBE3', color: '#4E4A44' };
          return (
            <div
              key={r.id}
              className="grid grid-cols-[1.3fr_1fr_1fr_1fr_1fr_1fr] items-center gap-3.5 border-t border-[#F0EBE2] px-5 py-[13px] text-[14px] transition-colors hover:bg-[#FAF7F1]"
            >
              <span className="flex flex-col">
                <span className="font-semibold text-[#17171B]">{r.when}</span>
                <span className="text-[12px] text-[#6E685F]">{r.src}</span>
              </span>
              <span className="text-[#1F7A55]">+{r.add} created</span>
              <span className="text-[#2F4A7A]">{r.up} updated</span>
              <span className="text-[#A3283A]">{r.off} switched off</span>
              <span className="text-[#8A5A12]">{r.skip} skipped</span>
              <span>
                <span className="inline-block rounded-full px-2.5 py-[3px] text-[12px] font-medium" style={{ backgroundColor: style.bg, color: style.color }}>
                  {r.status}
                </span>
              </span>
            </div>
          );
        })}
      </section>

      {/* Sync guard notice */}
      <section className="flex items-center gap-3 rounded-xl border border-[#EBDDC0] bg-white px-[18px] py-4">
        <svg className="h-[18px] w-[18px] shrink-0 text-[#B08D4F]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z" />
        </svg>
        <span className="flex-1 text-[14px] text-[#2A2A30]">
          Sync guard is on. If a sync would switch off more than {data.guardPct ?? 10}% of cards, it waits for your approval.
        </span>
      </section>
    </div>
  );
}
