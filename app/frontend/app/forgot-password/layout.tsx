import { createPageMetadata } from "../../lib/page-metadata";

export const metadata = createPageMetadata(
  "Forgot Password",
  "Request a password reset for your StratVeda OS account.",
);

export default function ForgotPasswordLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
