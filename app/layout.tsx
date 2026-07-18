import type { Metadata } from "next";
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
