import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Operations Console | StratVeda',
  description: 'A private workspace for understanding users, account activity, and access.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
