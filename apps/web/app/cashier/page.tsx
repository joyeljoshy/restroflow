import { WorkspacePlaceholder } from "@/components/layout/workspace-placeholder";

export default function CashierPage() {
  return (
    <WorkspacePlaceholder
      eyebrow="Checkout"
      title="Cashier workspace"
      description="The authenticated cashier shell is ready. Billing and payment workflows remain outside Part 2."
      metrics={[
        {
          label: "Open checks",
          value: "—",
          note: "Billing is not implemented",
        },
        { label: "Payments", value: "—", note: "Payments are not implemented" },
        {
          label: "Shift total",
          value: "₹—",
          note: "Analytics are not implemented",
        },
      ]}
    />
  );
}
