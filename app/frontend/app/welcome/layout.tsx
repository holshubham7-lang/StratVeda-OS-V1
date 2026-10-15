import { createPageMetadata } from "../../lib/page-metadata";

export const metadata = createPageMetadata(
  "Welcome",
  "Welcome to StratVeda OS. Your first business question starts here.",
);

export default function WelcomeLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
