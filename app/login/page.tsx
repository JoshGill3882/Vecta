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
    // flex-1 fills the flex-col <body> from the root layout; centres the card.
    // No background of its own — the body's radial gradient (globals.css) shows
    // through, matching the design.
    <main className="flex flex-1 items-center justify-center px-6">
      <div className="border-border-strong from-surface-2 to-card w-full max-w-[396px] rounded-2xl border bg-gradient-to-b p-8 shadow-2xl">
        {/* brand + heading — purely static, no JS needed */}
        <div className="mb-6">
          <h1 className="text-foreground text-2xl font-semibold tracking-[-0.02em]">
            Task Manager
          </h1>
          <p className="text-text-3 mt-1.5 text-sm">Sign in to your self-hosted instance.</p>
        </div>

        {/* the interactive island — everything stateful lives in here */}
        <LoginForm next={next} />

        <p className="text-text-3 mt-5 border-t border-border pt-4 text-xs leading-relaxed">
          No accounts to manage — authentication is a single admin password set via the{" "}
          <code className="bg-surface-3 rounded px-1 py-0.5">ADMIN_PASSWORD</code> environment
          variable.
        </p>
      </div>
    </main>
  );
}
