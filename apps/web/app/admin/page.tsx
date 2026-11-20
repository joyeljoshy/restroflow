import { WorkspacePlaceholder } from "@/components/layout/workspace-placeholder";

export default function AdminPage() {
  return (
    <WorkspacePlaceholder
      eyebrow="Operations overview"
      title="Restaurant command center"
      description="Manage the restaurant workspace here, or open Analytics for finalized financial and operational reporting."
      metrics={[
        {
          label: "Team access",
          value: "Ready",
          note: "Profiles, roles, and account status",
        },
        {
          label: "Order operations",
          value: "Live",
          note: "Waiter, customer, and kitchen workflows",
        },
        {
          label: "Analytics",
          value: "Live",
          note: "Persisted sales, payment, table, and kitchen reports",
        },
      ]}
    />
  );
}
