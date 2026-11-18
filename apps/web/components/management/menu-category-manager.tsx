"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { MenuCategory } from "@restroflow/contracts";
import { useMutation } from "@tanstack/react-query";
import { Pencil, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/auth-api";
import {
  createMenuCategory,
  deactivateMenuCategory,
  updateMenuCategory,
} from "@/lib/menu-api";

const schema = z.object({
  name: z.string().trim().min(1, "Enter a category name.").max(100),
  description: z.string().trim().max(500),
  sortOrder: z.number().int().min(0),
});
type Values = z.infer<typeof schema>;

export function MenuCategoryManager({
  restaurantId,
  categories,
  canManage,
  onChanged,
}: {
  restaurantId: string;
  categories: MenuCategory[];
  canManage: boolean;
  onChanged: () => Promise<unknown>;
}) {
  const [editor, setEditor] = useState<MenuCategory | "new" | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema) });
  useEffect(() => {
    reset({
      name: editor && editor !== "new" ? editor.name : "",
      description: editor && editor !== "new" ? (editor.description ?? "") : "",
      sortOrder:
        editor && editor !== "new" ? editor.sortOrder : categories.length,
    });
  }, [categories.length, editor, reset]);
  const save = useMutation({
    mutationFn: (values: Values) =>
      editor && editor !== "new"
        ? updateMenuCategory(restaurantId, editor.id, {
            ...values,
            description: values.description || null,
          })
        : createMenuCategory(restaurantId, {
            ...values,
            description: values.description || null,
            isActive: true,
          }),
    onSuccess: async () => {
      setEditor(null);
      await onChanged();
    },
  });
  const status = useMutation({
    mutationFn: (category: MenuCategory) =>
      category.isActive
        ? deactivateMenuCategory(restaurantId, category.id)
        : updateMenuCategory(restaurantId, category.id, { isActive: true }),
    onSuccess: onChanged,
  });

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Categories</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Inactive categories make their items effectively unavailable without
            deleting history.
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setEditor("new")}>
            <Plus className="size-4" /> Add category
          </Button>
        )}
      </div>
      {categories.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <h3 className="font-bold">No categories yet</h3>
            <p className="text-muted-foreground mt-1 text-sm">
              Create the first section for your menu.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {categories.map((category) => (
            <Card
              key={category.id}
              className={!category.isActive ? "opacity-65" : undefined}
            >
              <CardContent className="flex items-start justify-between gap-4 p-5">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold">{category.name}</h3>
                    <span className="text-muted-foreground rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-semibold">
                      #{category.sortOrder}
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {category.description || "No description"}
                  </p>
                  <p className="mt-2 text-xs font-semibold">
                    {category.isActive ? "Active" : "Inactive"}
                  </p>
                </div>
                {canManage && (
                  <div className="flex shrink-0 gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditor(category)}
                    >
                      <Pencil className="size-4" /> Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => status.mutate(category)}
                      disabled={status.isPending}
                    >
                      {category.isActive ? "Deactivate" : "Activate"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <Dialog
        open={editor !== null}
        onClose={() => setEditor(null)}
        title={editor === "new" ? "Add category" : "Edit category"}
        description="Categories control menu organization and effective item availability."
      >
        <form
          className="space-y-4 p-5 sm:p-6"
          onSubmit={(event) =>
            void handleSubmit((values) => save.mutateAsync(values))(event)
          }
        >
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold">Name</span>
            <Input {...register("name")} />
            {errors.name && (
              <p className="text-xs text-red-700">{errors.name.message}</p>
            )}
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold">Description</span>
            <Textarea rows={3} {...register("description")} />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold">Display order</span>
            <Input
              type="number"
              min={0}
              {...register("sortOrder", { valueAsNumber: true })}
            />
          </label>
          {save.isError && (
            <p
              role="alert"
              className="rounded-lg bg-red-50 p-3 text-sm text-red-800"
            >
              {save.error instanceof ApiError
                ? save.error.message
                : "The category could not be saved."}
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
            <Button type="submit" disabled={save.isPending}>
              Save category
            </Button>
          </div>
        </form>
      </Dialog>
    </section>
  );
}
