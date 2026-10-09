'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Icon } from './icons';
import { IconButton } from './ui';
import { useApi } from '@/lib/api';

const KEY = 'vl-dismissed-announcements';

const readDismissed = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
};

/** Banners the Vellaire team publishes from the console. Each one can be dismissed on this device. */
export function AnnouncementBar() {
  const { data } = useApi<{ id: string; message: string; link: string | null }[]>('/announcements', { shouldRetryOnError: false });
  const [dismissed, setDismissed] = useState<string[]>([]);
  useEffect(() => setDismissed(readDismissed()), []);

  const items = (data || []).filter((a) => !dismissed.includes(a.id));
  if (!items.length) return null;

  const dismiss = (id: string) => {
    const next = [...dismissed, id];
    setDismissed(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next.slice(-50)));
    } catch {
      // Private mode: it simply shows again next time
    }
  };

  return (
    <div className="mb-6 flex flex-col gap-2">
      {items.map((a) => (
        <div key={a.id} role="status" className="flex items-center gap-2.5 rounded-[10px] border border-gold-line bg-[#FBF6EC] py-1.5 pl-3.5 pr-1.5 text-[13.5px]">
          <Icon name="dMega" size={16} className="shrink-0 text-gold-text" />
          <span className="flex-1 py-1.5">{a.message}</span>
          {a.link &&
            (a.link.startsWith('/') ? (
              <Link href={a.link} className="shrink-0 font-medium text-gold-text hover:text-ink">
                Learn more
              </Link>
            ) : (
              <a href={a.link} target="_blank" rel="noreferrer" className="shrink-0 font-medium text-gold-text hover:text-ink">
                Learn more
              </a>
            ))}
          <IconButton icon="x" label="Dismiss" className="h-8 w-8" onClick={() => dismiss(a.id)} />
        </div>
      ))}
    </div>
  );
}
