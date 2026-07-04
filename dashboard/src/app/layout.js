import '@/styles/globals.css';
import { ThemeProvider } from '@/components/ThemeProvider';
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister';

export const metadata = {
  title: 'Bitshake — Smart Meter Dashboard',
  description: 'Real-time electricity monitoring dashboard for Bitshake Smart Meter Reader Air. Track consumption, solar feed-in, costs, and energy analytics.',
  keywords: ['smart meter', 'energy dashboard', 'electricity', 'solar', 'bitshake', 'monitor'],
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Bitshake',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="de" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#0b0f19" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>⚡</text></svg>" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <ServiceWorkerRegister />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
