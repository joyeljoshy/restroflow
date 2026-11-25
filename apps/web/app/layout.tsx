import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://restroflow-joyel.vercel.app"),
  title: {
    default: "RestroFlow | Restaurant Operations Management",
    template: "%s | RestroFlow",
  },
  description:
    "RestroFlow is a modern restaurant management platform for menu management, table operations, ordering, kitchen workflows, billing, and analytics.",
  applicationName: "RestroFlow",
  authors: [{ name: "RestroFlow" }],
  creator: "RestroFlow",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "RestroFlow",
    title: "RestroFlow | Restaurant Operations Management",
    description:
      "Modern restaurant operations for menus, tables, orders, kitchen workflows, billing, and analytics.",
  },
  twitter: {
    card: "summary_large_image",
    title: "RestroFlow | Restaurant Operations Management",
    description:
      "Modern restaurant operations for menus, tables, orders, kitchen workflows, billing, and analytics.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  category: "technology",
};

export const viewport: Viewport = {
  themeColor: "#24745b",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
