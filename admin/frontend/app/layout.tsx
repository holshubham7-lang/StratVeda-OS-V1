import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'RevOps Admin | StratVeda',
  description: 'Secure operations console for RevOps account administration.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
