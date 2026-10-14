import { createPageMetadata } from "../../lib/page-metadata";

export const metadata = createPageMetadata(
  "Sign Up",
  "Create a StratVeda OS account to bring one real business question through the evidence and into a Decision Brief.",
);

export default function SignUpLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
