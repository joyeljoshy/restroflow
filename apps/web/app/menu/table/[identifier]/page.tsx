import type { Metadata } from "next";

import { CustomerMenu } from "@/components/customer/customer-menu";

export const metadata: Metadata = {
  title: "Restaurant menu",
  description: "Browse the menu and order securely from your table.",
  robots: { index: false, follow: false, noarchive: true },
};

export default async function CustomerMenuPage({
  params,
}: {
  params: Promise<{ identifier: string }>;
}) {
  const { identifier } = await params;
  return <CustomerMenu identifier={identifier} />;
}
