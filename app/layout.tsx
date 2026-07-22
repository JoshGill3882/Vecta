import type { Metadata, Viewport } from "next";
import "./globals.css";
import { geistSans, geistMono } from "@/src/lib/fonts";

const title = "Task Manager";
const description = "Self-hosted, single-user task management.";

export const metadata: Metadata = {
  title,
  description,
  applicationName: title,
  // No `url`/`images` here on purpose: the app is self-hosted with no fixed
  // public URL, and URL-based fields would require `metadataBase`. Static copy
  // only — nothing user- or instance-specific that could leak when shared.
  openGraph: {
    title,
    description,
    siteName: title,
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary",
    title,
    description,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Make the on-screen keyboard shrink the layout viewport, so `dvh` and fixed
  // positioning describe the space the user can actually see and the task
  // dialog's footer stays reachable with the keyboard up. Without it the
  // keyboard overlays the page and the viewport still reports full height.
  //
  // Chrome/Android honours this; iOS Safari ignores it, and only the
  // visualViewport API reports the keyboard there — see useVisibleViewport.
  interactiveWidget: "resizes-content",
  // Deliberately no `maximumScale`/`userScalable`: both would block pinch-zoom,
  // which people rely on to read. Next's docs show them, they are not defaults.
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
