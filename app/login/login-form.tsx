"use client"; // ← required: this file uses hooks + event handlers

import { useActionState, useState } from "react";
import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = {}; // matches the { error?, fieldErrors? } shape

export function LoginForm({ next }: { next?: string }) {
  // useActionState binds a server action to form state.
  // - `state` is whatever your action RETURNS (errors render from here)
  // - `formAction` is what you hand to the <form action={...}>
  // - `pending` is true while the action runs → drives the "Signing in…" state
  const [state, formAction, pending] = useActionState(loginAction, initialState);
  const [show, setShow] = useState(false); // Show/Hide toggle = local UI state only

  return (
    <form action={formAction}>
      {/* Post-login destination captured by the proxy; the action validates it. */}
      <input type="hidden" name="next" value={next ?? "/"} />

      <label htmlFor="pw" className="text-text-2 text-sm font-medium">
        Admin password
      </label>

      <div className="relative mt-1.5">
        <input
          id="pw"
          name="password"
          type={show ? "text" : "password"}
          autoComplete="current-password"
          className="border-input bg-input/30 text-foreground focus-visible:border-ring focus-visible:ring-ring/50 h-11 w-full rounded-lg border pr-16 pl-3 outline-none focus-visible:ring-3"
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
        {state.error}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="bg-primary-strong text-primary-foreground hover:bg-primary-strong/90 focus-visible:border-ring focus-visible:ring-ring/50 h-11 w-full rounded-lg font-medium outline-none focus-visible:ring-3 disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in →"}
      </button>
    </form>
  );
}
