import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "LocalLoop",
  description: "Open-source DMV-area local event discovery."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
