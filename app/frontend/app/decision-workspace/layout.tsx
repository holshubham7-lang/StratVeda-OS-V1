import { createPageMetadata } from "../../lib/page-metadata";

export const metadata = createPageMetadata(
  "Decision Workspace",
  "Your chat workspace inside StratVeda OS.",
);

export default function DecisionWorkspaceLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
