import { createPageMetadata } from "../../lib/page-metadata";

export const metadata = createPageMetadata(
  "Decision Center",
  "Your business context, priorities, and decision questions in one place.",
);

export default function DecisionCenterLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
