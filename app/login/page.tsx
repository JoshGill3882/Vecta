import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/src/lib/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in · Task Manager" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  // If the Session is not null, redirect to "/"
  if (await getSession()) {
    redirect("/");
  }

  // Captured by the proxy when an unauthenticated request was bounced here;
  // forwarded to the action via a hidden field and validated there.
  const { next } = await searchParams;

  return (
    // flex-1 fills the flex-col <body> from the root layout; centres the card
    <main className="flex flex-1 items-center justify-center bg-black px-6">
      <div className="w-full max-w-[396px] rounded-2xl border border-white/10 bg-zinc-900/60 p-8 shadow-2xl">
        {/* brand + heading — purely static, no JS needed */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Task Manager</h1>
          <p className="mt-1.5 text-sm text-zinc-400">Sign in to your self-hosted instance.</p>
        </div>

        {/* the interactive island — everything stateful lives in here */}
        <LoginForm next={next} />

        <p className="mt-5 border-t border-white/5 pt-4 text-xs leading-relaxed text-zinc-400">
          No accounts to manage — authentication is a single admin password set via the{" "}
          <code className="rounded bg-white/10 px-1 py-0.5">ADMIN_PASSWORD</code> environment
          variable.
        </p>
      </div>
    </main>
  );
}
