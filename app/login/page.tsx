import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getSession } from "@/src/lib/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in · Vecta" };

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
    // and stacks the footer line beneath it. No background of its own — the
    // body's radial gradient (globals.css) shows through, matching the design.
    <main className="flex flex-1 flex-col items-center justify-center px-6">
      <div className="border-border-strong from-surface-2 to-card w-full max-w-[396px] rounded-[18px] border bg-gradient-to-b px-[30px] pt-8 pb-[26px] shadow-2xl">
        {/* brand + heading — purely static, no JS needed. alt="" because the
            wordmark sits beside the mark and already names the app. */}
        <div className="mb-5 -ml-1.5 flex items-center gap-2.5">
          <Image
            src="/logo.png"
            alt=""
            width={52}
            height={52}
            className="size-[52px] shrink-0"
            priority
          />
          <h1 className="text-foreground text-[29px] font-semibold tracking-[-0.035em]">Vecta</h1>
        </div>

        <p className="text-text-3 mb-[22px] text-sm">Sign in to your self-hosted instance.</p>

        {/* the interactive island — everything stateful lives in here */}
        <LoginForm next={next} />

        <p className="text-text-3 border-border-faint mt-5 border-t pt-[18px] text-xs leading-relaxed">
          No accounts to manage — authentication is a single admin password set via the{" "}
          <code className="bg-surface-3 rounded px-1 py-0.5">ADMIN_PASSWORD</code> environment
          variable.
        </p>
      </div>

      <p className="text-text-faint mt-[26px] text-xs">Self-hosted · open-source</p>
    </main>
  );
}
