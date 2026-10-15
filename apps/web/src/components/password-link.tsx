'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { Icon } from './icons';
import { useToast } from './toast';
import { Button, copyText, Modal } from './ui';

/**
 * Makes a one-time password link for someone and shows it to copy or send on WhatsApp.
 * For when email is not set up, or the person did not get the email. The link works for 24 hours.
 * `path` is the API call that makes it: /auth/reset-link/<userId> or /auth/reset-link/employee/<employeeId>.
 */
export function usePasswordLink() {
  const [link, setLink] = useState<{ name: string; url: string } | null>(null);
  const toast = useToast();

  const make = async (path: string, name: string) => {
    try {
      const r = await api.post<{ url: string }>(path);
      setLink({ name, url: r.url });
    } catch (e) {
      toast((e as Error).message, 'err');
    }
  };

  const message = link ? `Hi ${link.name.split(' ')[0]}, set your Vellaire password here (works once, for 24 hours): ${link.url}` : '';
  const modal = (
    <Modal
      open={!!link}
      onClose={() => setLink(null)}
      title={link ? `Password link for ${link.name}` : 'Password link'}
      footer={
        <>
          <Button
            icon="copy"
            onClick={async () => {
              await copyText(message);
              toast('Message with the link copied');
            }}
          >
            Copy message
          </Button>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(message)}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center gap-2 rounded-md bg-ink px-4 text-[14px] font-medium text-cream"
          >
            <Icon name="whatsapp" size={17} /> Send on WhatsApp
          </a>
        </>
      }
    >
      <p className="text-[14px] text-stone">Send this link to {link?.name.split(' ')[0]} yourself. They open it, choose a password and are signed in. Then they sign in with their email and that password, on the web and in the app.</p>
      <div className="mt-4 break-all rounded-lg border border-line bg-pearl p-3 font-mono text-[12.5px]">{link?.url}</div>
      <p className="mt-3 text-[13px] text-stone-2">It works once and expires in 24 hours. Only share it with this person.</p>
    </Modal>
  );
  return { make, modal };
}
