'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { Icon } from './icons';
import { Button, IconButton, Modal } from './ui';

/* ---------- Install prompt, shared by every page ---------- */

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Chrome and Edge offer installing once, early in the page's life, so it is kept here until a button asks for it
let deferred: InstallPromptEvent | null = null;
let installedNow = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    installedNow = true;
    notify();
  });
}

export type InstallState = 'installed' | 'prompt' | 'ios' | 'unsupported';

function currentState(): InstallState {
  if (installedNow || window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone) return 'installed';
  if (deferred) return 'prompt';
  // iPhone and iPad: no install button exists, people add it from the Share menu
  if (/iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
  return 'unsupported';
}

/** Whether the app can be installed here, and how. */
export function useInstallApp() {
  const state = useSyncExternalStore<InstallState>(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    currentState,
    () => 'unsupported',
  );
  const [showIosHelp, setShowIosHelp] = useState(false);

  const install = async () => {
    if (state === 'ios') return setShowIosHelp(true);
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === 'accepted') installedNow = true;
    deferred = null;
    notify();
  };

  const help = <IosInstallHelp open={showIosHelp} onClose={() => setShowIosHelp(false)} />;
  return { state, canInstall: state === 'prompt' || state === 'ios', install, help };
}

function IosInstallHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  const steps: [string, React.ReactNode][] = [
    [
      'iosShare',
      <>
        Tap the <strong>Share</strong> button at the bottom of Safari
      </>,
    ],
    [
      'plus',
      <>
        Scroll and tap <strong>Add to Home Screen</strong>
      </>,
    ],
    [
      'check',
      <>
        Tap <strong>Add</strong>. Vellaire is now on your home screen
      </>,
    ],
  ];
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Install on iPhone"
      footer={
        <Button variant="ink" onClick={onClose}>
          Got it
        </Button>
      }
    >
      <ol className="flex flex-col gap-4">
        {steps.map(([icon, text], i) => (
          <li key={i} className="flex items-center gap-3.5 text-[15px]">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-tint text-gold-text">
              <Icon name={icon} size={19} />
            </span>
            <span>{text}</span>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-[13px] text-stone-2">Use Safari for this. Other browsers on iPhone may not show the option.</p>
    </Modal>
  );
}

/* ---------- Banner shown in the dashboard and the employee app ---------- */

const DISMISS_KEY = 'vl-install-dismissed';
const DISMISS_DAYS = 14;

const dismissedRecently = () => {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return Date.now() - at < DISMISS_DAYS * 86400_000;
  } catch {
    return false;
  }
};

export function InstallBanner({ className = '' }: { className?: string }) {
  const { canInstall, install, help } = useInstallApp();
  const [hidden, setHidden] = useState(true);
  useEffect(() => setHidden(dismissedRecently()), []);

  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // Private mode: it simply shows again next time
    }
  };

  if (!canInstall || hidden) return help;
  return (
    <>
      <div role="region" aria-label="Install the app" className={`flex items-center gap-3 rounded-xl border border-gold-line bg-[#FBF6EC] py-2 pl-3 pr-1.5 ${className}`}>
        <img src="/icon-192.png" alt="" className="h-9 w-9 shrink-0 rounded-[9px]" />
        <span className="min-w-0 flex-1 text-[13.5px] leading-snug">
          <span className="block font-semibold">Install the Vellaire app</span>
          <span className="block text-stone">Open your card in one tap, even from the home screen</span>
        </span>
        <Button size="sm" variant="ink" onClick={install}>
          Install
        </Button>
        <IconButton icon="x" label="Not now" className="h-8 w-8" onClick={dismiss} />
      </div>
      {help}
    </>
  );
}

/* ---------- Service worker ---------- */

/** Registers the service worker that makes the app installable and shows an offline page. */
export function ServiceWorker() {
  useEffect(() => {
    // Production only: in development it would cache builds that are still changing
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Not fatal: the app works the same, only without the offline page
    });
  }, []);
  return null;
}
