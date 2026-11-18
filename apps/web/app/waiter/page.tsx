import { WorkspacePlaceholder } from "@/components/layout/workspace-placeholder";
export default function WaiterPage() {
  return (
    <WorkspacePlaceholder
      eyebrow="Dining room"
      title="Service floor"
      description="Table sessions and point-of-sale ordering will be added after their secure backend foundations are requested."
      metrics={[
        { label: "My tables", value: "—", note: "Waiting for table sessions" },
        {
          label: "Open orders",
          value: "—",
          note: "Waiting for order workflow",
        },
        {
          label: "Ready to serve",
          value: "—",
          note: "Waiting for kitchen updates",
        },
      ]}
    />
  );
}
