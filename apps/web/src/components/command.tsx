'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { Icon } from './icons';
import { cx, Kbd } from './ui';

interface Page {
  label: string;
  href: string;
}

/** ⌘K: jump to a page, a person or a card. */
export function CommandPalette({ pages }: { pages: Page[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [res, setRes] = useState<{ people: any[]; cards: any[] }>({ people: [], cards: [] });
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('vl:search', onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('vl:search', onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => input.current?.focus(), 10);
    else setQ('');
  }, [open]);

  useEffect(() => {
    if (q.trim().length < 2) return setRes({ people: [], cards: [] });
    const t = setTimeout(() => api.get(`/search?q=${encodeURIComponent(q)}`).then(setRes).catch(() => {}), 180);
    return () => clearTimeout(t);
  }, [q]);

  const items = [
    ...pages.filter((p) => !q || p.label.toLowerCase().includes(q.toLowerCase())).slice(0, q ? 5 : 8).map((p) => ({ kind: 'Page', label: p.label, sub: '', href: p.href })),
    ...res.people.map((p) => ({ kind: 'Person', label: p.name, sub: p.sub, href: p.cardId ? `/app/cards/${p.cardId}` : `/app/employees?q=${encodeURIComponent(p.name)}` })),
    ...res.cards.filter((c) => !res.people.some((p) => p.cardId === c.id)).map((c) => ({ kind: 'Card', label: c.name, sub: c.sub, href: `/app/cards/${c.id}` })),
  ];

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-ink/40 px-4 pt-[12vh]" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div role="dialog" aria-label="Search" className="vl-fade w-full max-w-xl overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Icon name="search" className="text-stone" />
          <input
            ref={input}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setOpen(false);
              if (e.key === 'ArrowDown') setActive((a) => Math.min(a + 1, items.length - 1));
              if (e.key === 'ArrowUp') setActive((a) => Math.max(a - 1, 0));
              if (e.key === 'Enter' && items[active]) go(items[active].href);
            }}
            placeholder="Search people, cards, settings"
            aria-label="Search"
            className="h-14 flex-1 bg-transparent text-[16px] outline-none"
          />
          <Kbd>Esc</Kbd>
        </div>
        <ul className="max-h-[50vh] overflow-y-auto p-2">
          {items.length === 0 && <li className="px-3 py-6 text-center text-[14px] text-stone">Nothing found</li>}
          {items.map((it, i) => (
            <li key={`${it.kind}-${it.href}-${i}`}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => go(it.href)}
                className={cx('flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left', i === active && 'bg-pearl')}
              >
                <span className="w-14 text-[11px] uppercase tracking-[0.12em] text-stone-2">{it.kind}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px]">{it.label}</span>
                  {it.sub && <span className="block truncate text-[12px] text-stone-2">{it.sub}</span>}
                </span>
                <Icon name="right" size={15} className="text-stone-2" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
