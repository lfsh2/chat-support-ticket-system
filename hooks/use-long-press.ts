"use client";

import { useCallback, useRef } from "react";

/** Touch long-press (default 450ms). Cancels if the finger moves, so scrolling still works. */
export function useLongPress(onLongPress: () => void, { delay = 450, moveTolerance = 10 } = {}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);

  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    start.current = null;
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType !== "touch") return;
      fired.current = false;
      start.current = { x: e.clientX, y: e.clientY };
      timer.current = setTimeout(() => {
        fired.current = true;
        navigator.vibrate?.(10);
        onLongPress();
      }, delay);
    },
    [delay, onLongPress],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!start.current) return;
      if (Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > moveTolerance) clear();
    },
    [clear, moveTolerance],
  );

  // Swallow the click (and the native menu) that follows a long-press.
  const onClickCapture = useCallback((e: React.MouseEvent) => {
    if (fired.current) {
      e.preventDefault();
      e.stopPropagation();
      fired.current = false;
    }
  }, []);

  const onContextMenu = useCallback((e: React.MouseEvent) => {
    if (start.current || fired.current) e.preventDefault();
  }, []);

  return { onPointerDown, onPointerMove, onPointerUp: clear, onPointerCancel: clear, onClickCapture, onContextMenu };
}
