"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function ActiveLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  const pathname = usePathname();
  // A href that only targets a section of another page never counts as the current page.
  const target = href.includes("#") ? null : href.split("?")[0];
  const active = target !== null && (pathname === target || (target !== "/" && pathname.startsWith(`${target}/`)));
  return (
    <Link href={href} className={`${className ?? ""}${active ? " is-active" : ""}`.trim()} aria-current={active ? "page" : undefined}>
      {children}
    </Link>
  );
}
