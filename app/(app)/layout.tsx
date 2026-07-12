import type { ReactNode } from "react";

import { TopBar } from "@/src/components/shell/top-bar";
import { Toaster } from "@/src/components/ui/sonner";

/**
 * Layout for the authenticated area (Tasks, Categories). The `(app)` route
 * group keeps `/login` out of this shell while leaving URLs unchanged — the
 * folder name in parentheses is not part of the path. Each page still calls
 * `requireSession()` as the real auth guard; the proxy is only a perimeter.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <TopBar />
      <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 pt-[26px] pb-20 sm:px-[22px]">
        {children}
      </main>
      <Toaster />
    </>
  );
}
