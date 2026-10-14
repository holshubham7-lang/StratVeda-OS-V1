import { createPageMetadata } from "../../lib/page-metadata";

export const metadata = createPageMetadata(
  "Where Do You Need Better Decisions?",
  "Map your decision domains, cadence, and the most important decision for this quarter.",
);

export default function DecisionProfileLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
