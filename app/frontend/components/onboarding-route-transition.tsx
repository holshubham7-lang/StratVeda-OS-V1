"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const onboardingRoutes = new Set([
  "/business-fingerprint",
  "/data-intake",
  "/strategic-context",
  "/decision-profile",
  "/evidence-library",
  "/executive-brief",
]);

const transitionEvent = "stratveda:onboarding-transition";

export function beginOnboardingTransition() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(transitionEvent));
  }
}

export function OnboardingRouteTransition() {
  const pathname = usePathname();
  const previousPath = useRef(pathname);
  const fallbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    const clearTimers = () => {
      if (fallbackTimer.current) clearTimeout(fallbackTimer.current);
      if (finishTimer.current) clearTimeout(finishTimer.current);
    };

    const startTransition = () => {
      setIsTransitioning(true);
      if (fallbackTimer.current) clearTimeout(fallbackTimer.current);
      fallbackTimer.current = setTimeout(() => setIsTransitioning(false), 1800);
    };

    const handleClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest("a[href]");
      if (!(link instanceof HTMLAnchorElement) || link.target || link.hasAttribute("download")) return;

      const destination = new URL(link.href, window.location.href);
      if (destination.origin !== window.location.origin) return;
      const nextPath = destination.pathname.replace(/\/$/, "") || "/";
      const currentPath = window.location.pathname.replace(/\/$/, "") || "/";
      if (nextPath !== currentPath && onboardingRoutes.has(currentPath) && onboardingRoutes.has(nextPath)) {
        startTransition();
      }
    };

    const handleTransitionRequest = () => startTransition();
    document.addEventListener("click", handleClick, true);
    window.addEventListener(transitionEvent, handleTransitionRequest);

    return () => {
      document.removeEventListener("click", handleClick, true);
      window.removeEventListener(transitionEvent, handleTransitionRequest);
      clearTimers();
    };
  }, []);

  useEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    if (!isTransitioning) return;

    if (fallbackTimer.current) clearTimeout(fallbackTimer.current);
    finishTimer.current = setTimeout(() => setIsTransitioning(false), 240);
  }, [pathname, isTransitioning]);

  if (!isTransitioning) return null;

  return (
    <div className="onboarding-transition" role="status" aria-live="polite" aria-label="Opening the next onboarding step">
      <div className="onboarding-transition-card" aria-hidden="true">
        <span className="onboarding-transition-mark">S</span>
        <span className="onboarding-transition-copy">Preparing your next step</span>
        <span className="onboarding-transition-loader"><i /><i /><i /></span>
      </div>
    </div>
  );
}
