import type { Metadata } from "next";

import { WaiterPos } from "@/components/orders/waiter-pos";

export const metadata: Metadata = { title: "Waiter POS" };

export default function WaiterPosPage() {
  return <WaiterPos />;
}
