import { createPageMetadata } from "../../lib/page-metadata";

export const metadata = createPageMetadata(
  "Your First Decision Brief",
  "Your first Decision Brief from StratVeda OS.",
);

export default function ExecutiveBriefLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
