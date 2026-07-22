import type { Metadata } from "next";
import Image from "next/image";
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
    // and stacks the footer line beneath it. No background of its own — the
    // body's radial gradient (globals.css) shows through, matching the design.
    <main className="flex flex-1 flex-col items-center justify-center px-6">
      <div className="border-border-strong from-surface-2 to-card w-full max-w-[396px] rounded-[18px] border bg-gradient-to-b px-[30px] pt-8 pb-[26px] shadow-2xl">
        {/* brand + heading — purely static, no JS needed */}
        <div className="mb-[22px] size-[60px] overflow-hidden rounded-[15px] shadow-[0_8px_24px_-10px_rgba(0,0,0,0.8)] ring-1 ring-white/[0.05]">
          <Image
            src="/logo.png"
            alt="J&L Dev Studio"
            width={60}
            height={60}
            className="size-full object-cover"
            priority
          />
        </div>

        <div className="mb-[22px]">
          <h1 className="text-foreground text-2xl font-semibold tracking-[-0.02em]">
            Task Manager
          </h1>
          <p className="text-text-3 mt-1.5 text-sm">Sign in to your self-hosted instance.</p>
        </div>

        {/* the interactive island — everything stateful lives in here */}
        <LoginForm next={next} />

        <p className="text-text-3 border-border-faint mt-5 border-t pt-[18px] text-xs leading-relaxed">
          No accounts to manage — authentication is a single admin password set via the{" "}
          <code className="bg-surface-3 rounded px-1 py-0.5">ADMIN_PASSWORD</code> environment
          variable.
        </p>
      </div>

      {/* alt="" — the wordmark beside it already names the studio, so the image
          is decorative and would otherwise be announced twice. */}
      <div className="text-text-faint mt-[26px] flex items-center gap-[9px] text-xs">
        <Image
          src="/logo.png"
          alt=""
          width={18}
          height={18}
          className="rounded opacity-80"
          aria-hidden
        />
        <span>J&amp;L Dev Studio · Self-hosted &amp; open-source</span>
      </div>
    </main>
  );
}
