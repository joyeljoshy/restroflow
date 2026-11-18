import type { Metadata } from "next";

import { StaffDashboard } from "@/components/management/staff-dashboard";

export const metadata: Metadata = { title: "Staff management" };

export default function StaffManagementPage() {
  return <StaffDashboard />;
}
