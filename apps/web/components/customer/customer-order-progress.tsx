import type { CustomerOrder } from "@restroflow/contracts";
import { ChefHat } from "lucide-react";

const copy: Record<CustomerOrder["status"], string> = {
  PENDING: "Sent to the restaurant",
  ACCEPTED: "Accepted by the kitchen",
  PREPARING: "Your food is being prepared",
  READY: "Ready for serving",
  SERVED: "Served",
  CANCELLED: "Cancelled",
  REJECTED: "Unable to prepare",
};

const percentages: Record<CustomerOrder["status"], number> = {
  PENDING: 15,
  ACCEPTED: 35,
  PREPARING: 60,
  READY: 85,
  SERVED: 100,
  CANCELLED: 100,
  REJECTED: 100,
};

export function CustomerOrderProgress({
  status,
}: {
  status: CustomerOrder["status"];
}) {
  return (
    <>
      <h3 className="mt-1 text-lg font-black">{copy[status]}</h3>
      <div
        className="mt-4 h-2 overflow-hidden rounded-full bg-stone-200"
        role="progressbar"
        aria-label="Order progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percentages[status]}
      >
        <div
          className="h-full rounded-full bg-emerald-600 transition-[width]"
          style={{ width: `${percentages[status]}%` }}
        />
      </div>
      {status === "READY" && (
        <p className="mt-4 rounded-xl bg-sky-50 p-3 text-sm font-bold text-sky-800">
          <ChefHat className="mr-2 inline size-4" />
          Your order is ready for serving.
        </p>
      )}
    </>
  );
}
