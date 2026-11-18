import { WorkspacePlaceholder } from "@/components/layout/workspace-placeholder";
export default function KitchenPage() {
  return (
    <WorkspacePlaceholder
      eyebrow="Kitchen display"
      title="Order board"
      description="Incoming tickets, preparation timers, and ready states will be implemented with the order workflow."
      metrics={[
        { label: "New", value: "—", note: "Waiting for order domain" },
        {
          label: "Preparing",
          value: "—",
          note: "Waiting for kitchen workflow",
        },
        {
          label: "Average time",
          value: "— min",
          note: "Waiting for operational data",
        },
      ]}
    />
  );
}
