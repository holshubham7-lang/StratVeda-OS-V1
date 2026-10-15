import { createPageMetadata } from "../../lib/page-metadata";

export const metadata = createPageMetadata(
  "Understand Your Business",
  "Start your StratVeda OS setup with a few questions about how your business works.",
);

export default function BusinessFingerprintLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
