import { WorkspacePlaceholder } from "@/components/layout/workspace-placeholder";
export default function WaiterPage() {
  return (
    <WorkspacePlaceholder
      eyebrow="Dining room"
      title="Service floor"
      description="Live table sessions are available from Service floor. Point-of-sale ordering remains intentionally out of scope."
      metrics={[
        { label: "Tables", value: "Ready", note: "Open the Service floor" },
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
