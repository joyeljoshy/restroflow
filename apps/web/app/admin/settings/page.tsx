import type { Metadata } from "next";

import { RestaurantSettings } from "@/components/management/restaurant-settings";

export const metadata: Metadata = { title: "Restaurant settings" };

export default function RestaurantSettingsPage() {
  return <RestaurantSettings />;
}
