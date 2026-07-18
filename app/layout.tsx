import type { Metadata } from "next";
import "./globals.css";
import { geistSans, geistMono } from "@/src/lib/fonts";

export const metadata: Metadata = {
  title: "Task Manager",
  description: "Self-hosted, single-user task management.",
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
