"use client"; // ← required: this file uses hooks + event handlers

import { useActionState, useState } from "react";
import { ArrowRight, Lock, X } from "lucide-react";
import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = {}; // matches the { error?, fieldErrors? } shape

export function LoginForm({ next }: { next?: string }) {
  // useActionState binds a server action to form state.
  // - `state` is whatever your action RETURNS (errors render from here)
  // - `formAction` is what you hand to the <form action={...}>
  // - `pending` is true while the action runs → drives the "Signing in…" state
  const [state, formAction, pending] = useActionState(loginAction, initialState);
  const [show, setShow] = useState(false); // Show/Hide toggle = local UI state only

  // Once the user starts correcting the password, the previous failure message
  // shouldn't sit there contradicting them. `state` is a fresh object on every
  // action return, so comparing it against the render we last saw tells us when
  // a new result has landed — at which point the error is un-hidden again.
  // (Adjusting state during render rather than in an effect: React's documented
  // pattern for state derived from a prop/state change, and it avoids the extra
  // render pass an effect would cost.)
  const [edited, setEdited] = useState(false);
  const [seenState, setSeenState] = useState(state);
  if (seenState !== state) {
    setSeenState(state);
    setEdited(false);
  }
  const error = edited ? undefined : state.error;

  return (
    <form action={formAction}>
      {/* Post-login destination captured by the proxy; the action validates it. */}
      <input type="hidden" name="next" value={next ?? "/"} />

      <label htmlFor="pw" className="text-text-2 text-sm font-medium">
        Admin password
      </label>

      <div className="relative mt-1.5">
        <Lock
          size={15}
          aria-hidden
          className="text-text-faint pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
        />
        <input
          id="pw"
          name="password"
          type={show ? "text" : "password"}
          autoComplete="current-password"
          onChange={() => setEdited(true)}
          className="border-input bg-input/30 text-foreground focus-visible:border-ring focus-visible:ring-ring/50 h-11 w-full rounded-lg border pr-[60px] pl-9 outline-none focus-visible:ring-3"
          placeholder="Enter password"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-pressed={show}
          aria-label={show ? "Hide password" : "Show password"}
          className="text-text-3 hover:text-foreground focus-visible:ring-ring/50 absolute top-1/2 right-2 -translate-y-1/2 rounded text-[12.5px] font-medium outline-none focus-visible:ring-2"
        >
          {show ? "Hide" : "Show"}
        </button>
      </div>

      {/* errors come back through `state`, rendered inline, no reload. role=alert
          makes a failed sign-in announce to a screen reader (the container is
          always present, so the change to its text is what's announced). */}
      <div role="alert" className="text-destructive min-h-[22px] py-1.5 text-sm">
        {error && (
          <span className="flex items-center gap-1.5">
            <X size={13} aria-hidden className="shrink-0" />
            {error}
          </span>
        )}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="bg-primary-strong text-primary-foreground hover:bg-primary-strong/90 focus-visible:border-ring focus-visible:ring-ring/50 flex h-11 w-full items-center justify-center gap-2 rounded-lg font-medium outline-none focus-visible:ring-3 disabled:opacity-60"
      >
        {pending ? (
          "Signing in…"
        ) : (
          <>
            Sign in
            <ArrowRight size={16} aria-hidden />
          </>
        )}
      </button>
    </form>
  );
}
