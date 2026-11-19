import type { Metadata } from "next";

import { TableDashboard } from "@/components/tables/table-dashboard";

export const metadata: Metadata = { title: "Table management" };

export default function AdminTablesPage() {
  return <TableDashboard workspace="admin" />;
}
