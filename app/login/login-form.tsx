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

      <label htmlFor="pw" className="text-sm font-medium text-zinc-300">
        Admin password
      </label>

      <div className="relative mt-1.5">
        <input
          id="pw"
          name="password"
          type={show ? "text" : "password"}
          autoComplete="current-password"
          className="h-11 w-full rounded-lg border border-white/10 bg-black/40 pr-16 pl-3 text-zinc-100"
          placeholder="Enter password"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-zinc-400"
        >
          {show ? "Hide" : "Show"}
        </button>
      </div>

      {/* errors come back through `state`, rendered inline, no reload */}
      <div className="min-h-[22px] py-1.5 text-sm text-red-400">{state.error}</div>

      <button
        type="submit"
        disabled={pending}
        className="h-11 w-full rounded-lg bg-blue-500 font-medium text-white hover:bg-blue-600 disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in →"}
      </button>
    </form>
  );
}
