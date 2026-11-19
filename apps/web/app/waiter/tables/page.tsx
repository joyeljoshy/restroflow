import type { Metadata } from "next";

import { TableDashboard } from "@/components/tables/table-dashboard";

export const metadata: Metadata = { title: "Restaurant tables" };

export default function WaiterTablesPage() {
  return <TableDashboard workspace="waiter" />;
}
