import { createPageMetadata } from "../../lib/page-metadata";

export const metadata = createPageMetadata(
  "Sign In",
  "Sign in to your StratVeda OS workspace.",
);

export default function SignInLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
