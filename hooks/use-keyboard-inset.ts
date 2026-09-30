"use client";

import { useEffect } from "react";

/**
 * Keeps the app shell sized to the *visual* viewport so the composer stays above the
 * on-screen keyboard (iOS Safari doesn't resize the layout viewport). Publishes:
 *   --app-height / --app-top  on <html>, used by the hub shell
 *   data-keyboard-open        on <html>, used to hide the bottom tab bar
 */
export function useKeyboardInset() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    let frame = 0;

    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const keyboard = window.innerHeight - vv.height;
        root.style.setProperty("--app-height", `${vv.height}px`);
        root.style.setProperty("--app-top", `${vv.offsetTop}px`);
        root.toggleAttribute("data-keyboard-open", keyboard > 120);
      });
    };

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      cancelAnimationFrame(frame);
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      root.style.removeProperty("--app-height");
      root.style.removeProperty("--app-top");
      root.removeAttribute("data-keyboard-open");
    };
  }, []);
}
