"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./icon";

const WORKSPACE_ROUTES = ["/decision-center", "/decision-workspace"];

export function WorkspaceReturnLink() {
  const pathname = usePathname();
  const isInWorkspace = WORKSPACE_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
  if (isInWorkspace) return null;

  return (
    <Link className="app-shell-return" href="/decision-center" aria-label="Open the Decision Center">
      <Icon name="arrow-left" size={14} />
      <span>Decision Center</span>
    </Link>
  );
}
