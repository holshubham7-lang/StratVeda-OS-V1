import { createPageMetadata } from "../../lib/page-metadata";

export const metadata = createPageMetadata(
  "What Matters Most Right Now?",
  "Define your primary objective, biggest constraint, and what success means in StratVeda OS.",
);

export default function StrategicContextLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
