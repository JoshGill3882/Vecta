"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { List, ScrollText, Tag, type LucideIcon } from "lucide-react";

import { Button } from "@/src/shared/components/ui/button";
import { cn } from "@/src/shared/lib/utils";

/** One destination in the app navigation. */
type Tab = {
  /** Where the tab links to. */
  href: string;
  /** Text shown in the tab. */
  label: string;
  /** Icon shown before the label. */
  Icon: LucideIcon;
};

/** The app's destinations, in the order both navigations show them. */
const TABS: Tab[] = [
  { href: "/tasks", label: "Tasks", Icon: List },
  { href: "/categories", label: "Categories", Icon: Tag },
];

/** Whether a tab should read as the current page.
 *
 * Matches the tab's own route and anything nested under it, but not a sibling
 * that merely shares a prefix: a "/team-settings" route must not light up the
 * "/team" tab.
 *
 * @param pathname The current path.
 * @param href The tab's destination.
 * @returns True when the tab is current.
 */
function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Desktop tabs — sit inline in the top bar, hidden on narrow viewports. */
export function AppNav() {
  const pathname = usePathname();
  return (
    <nav className="ml-2 hidden items-center gap-0.5 min-[720px]:flex">
      {TABS.map(({ href, label, Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "focus-visible:ring-ring inline-flex h-[34px] items-center gap-[7px] rounded-lg px-[13px] text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none",
              active
                ? "bg-secondary text-foreground"
                : "text-text-3 hover:bg-secondary/60 hover:text-foreground"
            )}
          >
            <Icon className="size-[15px]" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Mobile tabs — a segmented row beneath the bar, shown only on narrow viewports. */
export function AppNavMobile() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 px-4 pb-2.5 min-[720px]:hidden">
      {TABS.map(({ href, label, Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex h-11 flex-1 items-center justify-center gap-[7px] rounded-[9px] border text-sm font-medium transition-colors",
              active
                ? "border-border-strong bg-secondary text-foreground"
                : "border-border text-text-3"
            )}
          >
            <Icon className="size-[15px]" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/** The Logs button - an icon link beside Log out, shown at every width.
 *
 * Kept out of the tabs: the log is visited rarely, and a third tab would crowd
 * the phone's row. It is lit like a tab while the Logs page is open.
 */
export function LogsLink() {
  const pathname = usePathname();
  const active = isActive(pathname, "/logs");
  return (
    <Button
      asChild
      variant="ghost"
      size="icon"
      className={active ? "bg-secondary text-foreground" : "text-text-3"}
    >
      <Link href="/logs" aria-label="Logs" title="Logs" aria-current={active ? "page" : undefined}>
        <ScrollText className="size-4" />
      </Link>
    </Button>
  );
}
