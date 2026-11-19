"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type {
  CreateTableRequest,
  RestaurantTable,
} from "@restroflow/contracts";
import { LoaderCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const formSchema = z.object({
  tableNumber: z.string().trim().min(1, "Table number is required.").max(30),
  displayName: z.string().trim().min(1, "Display name is required.").max(100),
  capacity: z
    .number({ error: "Capacity is required." })
    .int("Use a whole number.")
    .min(1, "Capacity must be at least 1.")
    .max(1_000),
  isActive: z.boolean(),
});

type TableFormValues = z.infer<typeof formSchema>;

export function TableForm({
  table,
  onSubmit,
  isSaving,
  error,
}: {
  table: RestaurantTable | null;
  onSubmit: (input: CreateTableRequest) => Promise<void>;
  isSaving: boolean;
  error: string | null;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<TableFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      tableNumber: table?.tableNumber ?? "",
      displayName: table?.displayName ?? "",
      capacity: table?.capacity ?? 2,
      isActive: table?.isActive ?? true,
    },
  });

  return (
    <form
      className="space-y-5 p-5 sm:p-6"
      noValidate
      onSubmit={(event) => void handleSubmit(onSubmit)(event)}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="space-y-2 text-sm font-semibold">
          Table number
          <Input
            {...register("tableNumber")}
            aria-invalid={Boolean(errors.tableNumber)}
          />
          {errors.tableNumber && (
            <span className="block text-sm text-red-700" role="alert">
              {errors.tableNumber.message}
            </span>
          )}
        </label>
        <label className="space-y-2 text-sm font-semibold">
          Seating capacity
          <Input
            type="number"
            min={1}
            max={1000}
            {...register("capacity", { valueAsNumber: true })}
            aria-invalid={Boolean(errors.capacity)}
          />
          {errors.capacity && (
            <span className="block text-sm text-red-700" role="alert">
              {errors.capacity.message}
            </span>
          )}
        </label>
      </div>
      <label className="space-y-2 text-sm font-semibold">
        Display name
        <Input
          {...register("displayName")}
          aria-invalid={Boolean(errors.displayName)}
        />
        {errors.displayName && (
          <span className="block text-sm text-red-700" role="alert">
            {errors.displayName.message}
          </span>
        )}
      </label>
      <label className="bg-muted/60 flex items-start gap-3 rounded-xl p-4 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 size-4 accent-emerald-700"
          {...register("isActive")}
        />
        <span>
          <span className="block font-semibold">In service</span>
          <span className="text-muted-foreground mt-1 block">
            Out-of-service tables cannot open dining sessions.
          </span>
        </span>
      </label>
      {error && (
        <p
          className="rounded-lg bg-red-50 p-3 text-sm text-red-800"
          role="alert"
        >
          {error}
        </p>
      )}
      <div className="flex justify-end">
        <Button type="submit" disabled={isSaving}>
          {isSaving && <LoaderCircle className="size-4 animate-spin" />}
          {table ? "Save changes" : "Create table"}
        </Button>
      </div>
    </form>
  );
}
