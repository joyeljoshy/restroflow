"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { CreatePaymentRequest } from "@restroflow/contracts";
import { LoaderCircle } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { majorAmountToMinor } from "@/lib/currency";

export const paymentFormSchema = z
  .object({
    amount: z.string().trim().min(1, "Enter an amount."),
    method: z.enum(["CASH", "UPI"]),
    reference: z.string().trim().max(120),
    confirmed: z.boolean(),
  })
  .refine((value) => majorAmountToMinor(value.amount) !== null, {
    path: ["amount"],
    message: "Enter a positive amount with no more than two decimal places.",
  })
  .refine((value) => value.confirmed, {
    path: ["confirmed"],
    message: "Confirm receipt before recording this payment.",
  });

type PaymentFields = z.infer<typeof paymentFormSchema>;

export function PaymentForm({
  outstandingMinor,
  currency,
  onSubmit,
  isSubmitting,
  error,
}: {
  outstandingMinor: number;
  currency: string;
  onSubmit: (input: CreatePaymentRequest) => Promise<void>;
  isSubmitting: boolean;
  error?: string | null;
}) {
  const form = useForm<PaymentFields>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      amount: (outstandingMinor / 100).toFixed(2),
      method: "CASH",
      reference: "",
      confirmed: false,
    },
  });
  const selectedMethod = useWatch({ control: form.control, name: "method" });

  return (
    <form
      className="space-y-4 rounded-xl border bg-stone-50 p-4"
      onSubmit={(event) => {
        void form.handleSubmit(async (values) => {
          const amountMinor = majorAmountToMinor(values.amount);
          if (amountMinor === null) return;
          await onSubmit({
            amountMinor,
            method: values.method,
            reference: values.reference || null,
            receivedExternally: true,
          });
        })(event);
      }}
    >
      <h3 className="font-bold">Record payment</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1.5 text-sm font-medium">
          <span>Amount ({currency})</span>
          <Input inputMode="decimal" {...form.register("amount")} />
          {form.formState.errors.amount && (
            <span className="block text-xs text-red-700" role="alert">
              {form.formState.errors.amount.message}
            </span>
          )}
        </label>
        <label className="space-y-1.5 text-sm font-medium">
          <span>Method</span>
          <Select {...form.register("method")}>
            <option value="CASH">Cash</option>
            <option value="UPI">UPI</option>
          </Select>
        </label>
      </div>
      <label className="space-y-1.5 text-sm font-medium">
        <span>
          {selectedMethod === "UPI"
            ? "UPI reference (optional)"
            : "Internal note (optional)"}
        </span>
        <Input {...form.register("reference")} maxLength={120} />
      </label>
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          className="mt-1 size-4 accent-emerald-700"
          {...form.register("confirmed")}
        />
        <span>
          I confirm this payment was received in cash or externally via UPI.
          RestroFlow does not verify or collect it.
        </span>
      </label>
      {form.formState.errors.confirmed && (
        <p className="text-xs text-red-700" role="alert">
          {form.formState.errors.confirmed.message}
        </p>
      )}
      {error && (
        <p
          className="rounded-lg bg-red-50 p-3 text-sm text-red-800"
          role="alert"
        >
          {error}
        </p>
      )}
      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting && <LoaderCircle className="size-4 animate-spin" />}
        Record {selectedMethod === "UPI" ? "UPI" : "cash"} payment
      </Button>
    </form>
  );
}
