import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Access unavailable",
  robots: { index: false, follow: false, noarchive: true },
};

export default function UnauthorizedLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return children;
}
