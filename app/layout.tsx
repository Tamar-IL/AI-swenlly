import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'The Conductor — one answer, many minds',
  description:
    'A ChatGPT/Claude-style platform whose engine is many AIs. It routes each question to the cheapest AI that answers it well, and shows a cost + quality receipt on every answer.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Set theme before paint to avoid a flash; respects saved choice then system. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('conductor-theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark');}}catch(e){}})();`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
