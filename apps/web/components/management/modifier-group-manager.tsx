"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { ModifierGroup } from "@restroflow/contracts";
import { useMutation } from "@tanstack/react-query";
import { Plus, Settings2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { PriceDisplay } from "@/components/menu/price-display";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/auth-api";
import {
  createModifier,
  createModifierGroup,
  deactivateModifierGroup,
  updateModifier,
  updateModifierGroup,
} from "@/lib/menu-api";

const groupSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    minSelections: z.number().int().min(0).max(50),
    maxSelections: z.number().int().min(1).max(50),
  })
  .refine((value) => value.minSelections <= value.maxSelections, {
    path: ["maxSelections"],
    message: "Maximum must be at least the minimum.",
  });
const optionSchema = z.object({
  name: z.string().trim().min(1).max(100),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/, "Enter a valid surcharge."),
});
type GroupValues = z.infer<typeof groupSchema>;
type OptionValues = z.infer<typeof optionSchema>;

export function ModifierGroupManager({
  restaurantId,
  groups,
  canManage,
  onChanged,
}: {
  restaurantId: string;
  groups: ModifierGroup[];
  canManage: boolean;
  onChanged: () => Promise<unknown>;
}) {
  const [editor, setEditor] = useState<ModifierGroup | "new" | null>(null);
  const [optionGroup, setOptionGroup] = useState<ModifierGroup | null>(null);
  const groupForm = useForm<GroupValues>({
    resolver: zodResolver(groupSchema),
  });
  const optionForm = useForm<OptionValues>({
    resolver: zodResolver(optionSchema),
    defaultValues: { name: "", price: "0.00" },
  });
  useEffect(() => {
    groupForm.reset({
      name: editor && editor !== "new" ? editor.name : "",
      minSelections: editor && editor !== "new" ? editor.minSelections : 0,
      maxSelections: editor && editor !== "new" ? editor.maxSelections : 1,
    });
  }, [editor, groupForm]);
  const saveGroup = useMutation({
    mutationFn: (values: GroupValues) =>
      editor && editor !== "new"
        ? updateModifierGroup(restaurantId, editor.id, values)
        : createModifierGroup(restaurantId, { ...values, isActive: true }),
    onSuccess: async () => {
      setEditor(null);
      await onChanged();
    },
  });
  const statusGroup = useMutation({
    mutationFn: (group: ModifierGroup) =>
      group.isActive
        ? deactivateModifierGroup(restaurantId, group.id)
        : updateModifierGroup(restaurantId, group.id, { isActive: true }),
    onSuccess: onChanged,
  });
  const addOption = useMutation({
    mutationFn: (values: OptionValues) =>
      createModifier(restaurantId, optionGroup!.id, {
        name: values.name,
        priceDeltaMinor: Math.round(Number(values.price) * 100),
        isAvailable: true,
      }),
    onSuccess: async () => {
      setOptionGroup(null);
      optionForm.reset({ name: "", price: "0.00" });
      await onChanged();
    },
  });
  const optionStatus = useMutation({
    mutationFn: ({
      groupId,
      modifierId,
      isAvailable,
    }: {
      groupId: string;
      modifierId: string;
      isAvailable: boolean;
    }) => updateModifier(restaurantId, groupId, modifierId, { isAvailable }),
    onSuccess: onChanged,
  });

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Modifier groups</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Reusable choices such as spice level, toppings, or portion size.
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setEditor("new")}>
            <Plus className="size-4" /> Add group
          </Button>
        )}
      </div>
      {groups.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <Settings2 className="text-muted-foreground mx-auto size-8" />
            <h3 className="mt-3 font-bold">No modifier groups</h3>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {groups.map((group) => (
            <Card
              key={group.id}
              className={!group.isActive ? "opacity-65" : undefined}
            >
              <CardContent className="space-y-4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold">{group.name}</h3>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {group.isRequired ? "Required" : "Optional"} · select{" "}
                      {group.minSelections}–{group.maxSelections}
                    </p>
                  </div>
                  {canManage && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditor(group)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={statusGroup.isPending}
                        onClick={() => statusGroup.mutate(group)}
                      >
                        {group.isActive ? "Deactivate" : "Activate"}
                      </Button>
                    </div>
                  )}
                </div>
                <div className="divide-y rounded-xl border">
                  {group.modifiers.length === 0 ? (
                    <p className="text-muted-foreground p-3 text-sm">
                      No options yet.
                    </p>
                  ) : (
                    group.modifiers.map((modifier) => (
                      <div
                        key={modifier.id}
                        className="flex items-center justify-between gap-3 p-3 text-sm"
                      >
                        <span
                          className={
                            !modifier.isAvailable
                              ? "text-muted-foreground line-through"
                              : "font-medium"
                          }
                        >
                          {modifier.name}
                        </span>
                        <div className="flex items-center gap-3">
                          <PriceDisplay
                            amountMinor={modifier.priceDeltaMinor}
                            className="text-xs"
                          />
                          {canManage && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                optionStatus.mutate({
                                  groupId: group.id,
                                  modifierId: modifier.id,
                                  isAvailable: !modifier.isAvailable,
                                })
                              }
                            >
                              {modifier.isAvailable ? "Disable" : "Enable"}
                            </Button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
                {canManage && group.isActive && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setOptionGroup(group)}
                  >
                    <Plus className="size-4" /> Add option
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <Dialog
        open={editor !== null}
        onClose={() => setEditor(null)}
        title={editor === "new" ? "Add modifier group" : "Edit modifier group"}
      >
        <form
          className="space-y-4 p-5 sm:p-6"
          onSubmit={(event) =>
            void groupForm.handleSubmit((values) =>
              saveGroup.mutateAsync(values),
            )(event)
          }
        >
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold">Group name</span>
            <Input {...groupForm.register("name")} />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="space-y-1.5">
              <span className="text-sm font-semibold">Minimum</span>
              <Input
                type="number"
                min={0}
                {...groupForm.register("minSelections", {
                  valueAsNumber: true,
                })}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-semibold">Maximum</span>
              <Input
                type="number"
                min={1}
                {...groupForm.register("maxSelections", {
                  valueAsNumber: true,
                })}
              />
              {groupForm.formState.errors.maxSelections && (
                <p className="text-xs text-red-700">
                  {groupForm.formState.errors.maxSelections.message}
                </p>
              )}
            </label>
          </div>
          {saveGroup.isError && (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
              {saveGroup.error instanceof ApiError
                ? saveGroup.error.message
                : "The group could not be saved."}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditor(null)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saveGroup.isPending}>
              Save group
            </Button>
          </div>
        </form>
      </Dialog>
      <Dialog
        open={optionGroup !== null}
        onClose={() => setOptionGroup(null)}
        title={`Add option${optionGroup ? ` to ${optionGroup.name}` : ""}`}
      >
        <form
          className="space-y-4 p-5 sm:p-6"
          onSubmit={(event) =>
            void optionForm.handleSubmit((values) =>
              addOption.mutateAsync(values),
            )(event)
          }
        >
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold">Option name</span>
            <Input {...optionForm.register("name")} />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold">Price surcharge</span>
            <Input inputMode="decimal" {...optionForm.register("price")} />
          </label>
          {addOption.isError && (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
              {addOption.error instanceof ApiError
                ? addOption.error.message
                : "The option could not be added."}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOptionGroup(null)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={addOption.isPending}>
              Add option
            </Button>
          </div>
        </form>
      </Dialog>
    </section>
  );
}
