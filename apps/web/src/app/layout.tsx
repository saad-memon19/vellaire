import type { Metadata, Viewport } from 'next';
import { Cormorant_Garamond, Instrument_Sans, JetBrains_Mono } from 'next/font/google';
import { ServiceWorker } from '@/components/pwa';
import { ToastProvider } from '@/components/toast';
import './globals.css';

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-cormorant',
});
const instrument = Instrument_Sans({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-instrument' });
const jetbrains = JetBrains_Mono({ subsets: ['latin'], weight: ['400'], variable: '--font-jetbrains' });

export const metadata: Metadata = {
  title: { default: 'Vellaire — Every introduction, perfected', template: '%s · Vellaire' },
  description: 'Branded digital business cards for your entire company — created from your HR system, shared by tap, scan or wallet.',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg', apple: '/apple-touch-icon.png' },
  // Installed on an iPhone home screen: open full screen, with the app's own name
  appleWebApp: { capable: true, title: 'Vellaire', statusBarStyle: 'default' },
};

export const viewport: Viewport = { themeColor: '#17171B', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${cormorant.variable} ${instrument.variable} ${jetbrains.variable}`}>
      {process.env.NODE_ENV === 'development' && (
        <head>
          {/* Development only: some antivirus extensions (Bitdefender) stamp bis_skin_checked on every element
              before React hydrates, which floods the console with hydration warnings. Strip it. */}
          <script
            dangerouslySetInnerHTML={{
              __html:
                "(function(){var a='bis_skin_checked',c=function(r){r.querySelectorAll&&r.querySelectorAll('['+a+']').forEach(function(e){e.removeAttribute(a)})};c(document);new MutationObserver(function(m){m.forEach(function(x){if(x.type==='attributes'&&x.attributeName===a){x.target.removeAttribute(a)}else{x.addedNodes.forEach(function(n){if(n.nodeType===1){if(n.hasAttribute(a))n.removeAttribute(a);c(n)}})}})}).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:[a]})})();",
            }}
          />
        </head>
      )}
      <body suppressHydrationWarning>
        <ToastProvider>{children}</ToastProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}
