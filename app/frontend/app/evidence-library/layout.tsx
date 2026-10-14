import { createPageMetadata } from "../../lib/page-metadata";

export const metadata = createPageMetadata(
  "Connect Your Business Data",
  "Add supporting business evidence to strengthen your first Decision Brief in StratVeda OS.",
);

export default function EvidenceLibraryLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
