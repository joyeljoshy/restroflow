import { WorkspacePlaceholder } from "@/components/layout/workspace-placeholder";
export default function AdminPage() {
  return (
    <WorkspacePlaceholder
      eyebrow="Operations overview"
      title="Good evening, Admin"
      description="Restaurant health, team access, and analytics will come together here as their domain features are implemented."
      metrics={[
        {
          label: "Team access",
          value: "Ready",
          note: "Profiles, roles, and account status",
        },
        {
          label: "Open orders",
          value: "—",
          note: "Order workflows are not implemented",
        },
        {
          label: "Net sales",
          value: "₹—",
          note: "Billing and analytics are not implemented",
        },
      ]}
    />
  );
}
