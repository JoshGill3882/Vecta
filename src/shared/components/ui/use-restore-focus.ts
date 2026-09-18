"use client";

import * as React from "react";

/**
 * Returns focus to the control that opened a dialog when it closes.
 *
 * Radix's modal content hard-restores focus to its `<DialogTrigger>`, cancelling
 * FocusScope's own restore first (`@radix-ui/react-dialog` index.mjs:148-151).
 * Every dialog in this app is controlled by an `open` prop with no trigger, so
 * `triggerRef` is null, nothing gets focused, and focus falls to `<body>` — the
 * WCAG 2.4.3 (Focus Order) failure tracked in #50. This captures the opener when
 * the dialog opens and puts focus back when it closes, taking over from Radix's
 * no-op.
 *
 * The returned props spread onto any Radix `*.Content`. They compose with an
 * `onOpenAutoFocus`/`onCloseAutoFocus` the caller already passes: the caller's
 * handler runs first, and a caller that calls `preventDefault()` on close opts
 * out of the restore entirely (its own handler wins).
 *
 * If the opener has left the DOM by close time — e.g. it was a control on a row
 * that a successful delete removed — the restore is skipped and focus is left to
 * fall back as it does today. Moving focus somewhere sensible in that case is the
 * caller's job, since only it knows the meaningful landmark to land on.
 */
export function useRestoreFocus(
  onOpenAutoFocus?: (event: Event) => void,
  onCloseAutoFocus?: (event: Event) => void
) {
  const openerRef = React.useRef<HTMLElement | null>(null);

  return {
    onOpenAutoFocus: (event: Event) => {
      // FocusScope has not moved focus into the dialog yet, so activeElement is
      // still the opener. Capture it before the caller's handler runs — that
      // handler may move focus itself (e.g. priming a field per #48).
      openerRef.current = document.activeElement as HTMLElement | null;
      onOpenAutoFocus?.(event);
    },
    onCloseAutoFocus: (event: Event) => {
      onCloseAutoFocus?.(event);
      if (event.defaultPrevented) return;

      // Only restore a still-connected opener. Preventing default here suppresses
      // both Radix's trigger-focus and FocusScope's own restore, so we must move
      // focus ourselves; leaving default in place lets the existing fallback run
      // when the opener is gone.
      const opener = openerRef.current;
      if (opener?.isConnected) {
        event.preventDefault();
        opener.focus();
      }
    },
  };
}
