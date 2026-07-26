import Link from "next/link";
import { FileQuestion } from "lucide-react";

import { Button } from "@/src/components/ui/button";

/**
 * Root not-found boundary. Next renders this for any unmatched URL across the
 * whole app (v13.3+), wrapped only by the root layout — so it sits outside the
 * `(app)` shell and stands alone the way the login page does, rather than under
 * the top bar. Styled to the same empty-state vocabulary as the in-app empty
 * and error states so a mistyped URL lands somewhere finished instead of on the
 * bare framework 404. Next injects `noindex` for 404s automatically.
 */
export default function NotFound() {
  return (
    // flex-1 fills the flex-col <body> from the root layout and centres the card
    <main className="text-text-2 flex flex-1 flex-col items-center justify-center px-6 py-[60px] text-center">
      <div className="bg-surface-2 text-text-3 mb-4 flex size-14 items-center justify-center rounded-[14px] border">
        <FileQuestion className="size-[26px]" />
      </div>
      <h1 className="mb-1.5 text-[17px]">Page not found</h1>
      <p className="text-text-3 max-w-[380px] text-sm">
        The page you&apos;re looking for doesn&apos;t exist or may have moved.
      </p>

      <Button asChild size="lg" className="mt-5">
        <Link href="/tasks">Back to tasks</Link>
      </Button>
    </main>
  );
}
