"use client";

import { useEffect } from "react";

/**
 * Keeps the app shell sized to the *visual* viewport so the composer stays above the
 * on-screen keyboard (iOS Safari doesn't resize the layout viewport). Publishes:
 *   --app-height / --app-top  on <html>, used by the hub shell
 *   --keyboard-inset          on <html>, how much of the layout viewport the keyboard covers
 *                             (for bottom-anchored overlays such as the thread drawer)
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
        root.style.setProperty("--keyboard-inset", `${Math.max(0, window.innerHeight - vv.height - vv.offsetTop)}px`);
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
      root.style.removeProperty("--keyboard-inset");
      root.removeAttribute("data-keyboard-open");
    };
  }, []);
}
