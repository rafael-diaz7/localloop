import type { Metadata } from "next";

import "./globals.css";
import { ThemeProvider } from "./ThemeProvider";
import { ThemeSelector } from "./ThemeSelector";

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
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <ThemeSelector />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
