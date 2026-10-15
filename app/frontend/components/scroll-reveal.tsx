"use client";

import { useEffect } from "react";

/** Reveals marked sections once when they first enter the viewport. */
export function ScrollReveal() {
  useEffect(() => {
    const items = document.querySelectorAll<HTMLElement>("[data-scroll-reveal]");

    if (!document.documentElement.classList.contains("motion-ready")) {
      items.forEach((item) => item.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries, currentObserver) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          currentObserver.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -36px 0px" },
    );

    items.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, []);

  return null;
}
