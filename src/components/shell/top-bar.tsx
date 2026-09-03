import Image from "next/image";
import { LogOut } from "lucide-react";

import { logoutAction } from "@/app/logout/actions";
import { Button } from "@/src/components/ui/button";

import { AppNav, AppNavMobile } from "./nav-tabs";

/**
 * Top bar for the authenticated app shell: brand + title on the left, the
 * Tasks/Categories tabs, and a logout control on the right. Rendered as a
 * Server Component — the logout is a plain <form> bound to the logout server
 * action, so it works without client-side JavaScript.
 */
export function TopBar() {
  return (
    <header className="bg-background/80 sticky top-0 z-40 border-b backdrop-blur-md">
      <div className="mx-auto flex h-[60px] max-w-[1200px] items-center justify-between gap-3 px-4 sm:px-[22px]">
        <div className="flex min-w-0 items-center gap-3">
          {/* alt="" — the wordmark beside it names the app, so the mark is
              decorative and would otherwise be announced twice. */}
          <Image
            src="/logo.png"
            alt=""
            width={34}
            height={34}
            className="size-[34px] shrink-0"
            priority
          />
          <div className="mr-1.5 flex min-w-0 items-center">
            <span className="text-base font-semibold tracking-[-0.02em] whitespace-nowrap">
              Vecta
            </span>
          </div>
          <AppNav />
        </div>

        <form action={logoutAction}>
          <Button type="submit" variant="ghost" size="sm" className="gap-2">
            <LogOut className="size-[15px]" />
            Log out
          </Button>
        </form>
      </div>

      <AppNavMobile />
    </header>
  );
}
