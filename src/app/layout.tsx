import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Open Agent Studio",
  description: "Build, test, and deploy AI agents visually.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-bg text-ink antialiased">{children}</body>
    </html>
  );
}
