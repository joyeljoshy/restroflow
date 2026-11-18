"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type {
  CreateMenuItemRequest,
  MenuCategory,
  MenuItem,
  ModifierGroup,
} from "@restroflow/contracts";
import { ImageUp, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { MenuItemImage } from "./menu-item-image";
import { ModifierSelector } from "./modifier-selector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export const menuItemFormSchema = z.object({
  categoryId: z.uuid("Choose a category."),
  name: z.string().trim().min(1, "Enter an item name.").max(120),
  description: z.string().trim().max(1000),
  price: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Enter a valid nonnegative price."),
  imageUrl: z.string().trim().max(2048),
  sortOrder: z.number().int().min(0).max(100_000),
  isAvailable: z.boolean(),
  isVegetarian: z.boolean(),
  isActive: z.boolean(),
});

type FormValues = z.infer<typeof menuItemFormSchema>;

export function MenuItemForm({
  item,
  categories,
  modifierGroups,
  onSubmit,
  onUpload,
  isSaving,
  error,
}: {
  item: MenuItem | null;
  categories: MenuCategory[];
  modifierGroups: ModifierGroup[];
  onSubmit: (
    input: CreateMenuItemRequest,
    modifierGroupIds: string[],
  ) => Promise<void>;
  onUpload: (file: File) => Promise<string>;
  isSaving: boolean;
  error?: string;
}) {
  const [selectedGroups, setSelectedGroups] = useState<string[]>(
    () => item?.modifierGroups.map(({ group }) => group.id) ?? [],
  );
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(menuItemFormSchema),
    defaultValues: {
      categoryId:
        item?.categoryId ??
        categories.find((category) => category.isActive)?.id ??
        "",
      name: item?.name ?? "",
      description: item?.description ?? "",
      price: item ? (item.priceMinor / 100).toFixed(2) : "",
      imageUrl: item?.imageUrl ?? "",
      sortOrder: item?.sortOrder ?? 0,
      isAvailable: item?.isAvailable ?? true,
      isVegetarian: item?.isVegetarian ?? false,
      isActive: item?.isActive ?? true,
    },
  });
  const imageUrl = useWatch({ control, name: "imageUrl" });

  const submit = handleSubmit(async (values) => {
    await onSubmit(
      {
        categoryId: values.categoryId,
        name: values.name,
        description: values.description || null,
        priceMinor: Math.round(Number(values.price) * 100),
        imageUrl: values.imageUrl || null,
        sortOrder: values.sortOrder,
        isAvailable: values.isAvailable,
        isVegetarian: values.isVegetarian,
        isActive: values.isActive,
      },
      selectedGroups,
    );
  });

  async function upload(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      setValue("imageUrl", await onUpload(file), { shouldValidate: true });
    } catch (uploadFailure) {
      setUploadError(
        uploadFailure instanceof Error
          ? uploadFailure.message
          : "The image could not be uploaded.",
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="space-y-5 p-5 sm:p-6"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1.5 sm:col-span-2">
          <span className="text-sm font-semibold">Item name</span>
          <Input {...register("name")} aria-invalid={Boolean(errors.name)} />
          {errors.name && (
            <p className="text-xs text-red-700">{errors.name.message}</p>
          )}
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-semibold">Category</span>
          <Select
            {...register("categoryId")}
            aria-invalid={Boolean(errors.categoryId)}
          >
            <option value="">Choose a category</option>
            {categories
              .filter(
                (category) =>
                  category.isActive || category.id === item?.categoryId,
              )
              .map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                  {category.isActive ? "" : " (inactive)"}
                </option>
              ))}
          </Select>
          {errors.categoryId && (
            <p className="text-xs text-red-700">{errors.categoryId.message}</p>
          )}
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-semibold">Price</span>
          <Input
            inputMode="decimal"
            placeholder="0.00"
            {...register("price")}
            aria-invalid={Boolean(errors.price)}
          />
          {errors.price && (
            <p className="text-xs text-red-700">{errors.price.message}</p>
          )}
        </label>
        <label className="space-y-1.5 sm:col-span-2">
          <span className="text-sm font-semibold">Description</span>
          <Textarea rows={3} {...register("description")} />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-semibold">Display order</span>
          <Input
            type="number"
            min={0}
            {...register("sortOrder", { valueAsNumber: true })}
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-semibold">Image URL</span>
          <Input placeholder="https://…" {...register("imageUrl")} />
        </label>
        <div className="sm:col-span-2">
          <p className="mb-1.5 text-sm font-semibold">Image preview</p>
          <MenuItemImage
            imageUrl={imageUrl || null}
            alt="Menu item preview"
            className="h-40 w-full rounded-xl border sm:w-64"
          />
        </div>
        <label className="border-input hover:bg-muted/40 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed p-4 text-sm font-semibold sm:col-span-2">
          {uploading ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <ImageUp className="size-4" />
          )}
          {uploading
            ? "Uploading image"
            : "Upload JPEG, PNG, or WebP (max 3 MB)"}
          <input
            className="sr-only"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => void upload(event.target.files?.[0])}
            disabled={uploading}
          />
        </label>
      </div>
      {uploadError && (
        <p
          className="rounded-lg bg-red-50 p-3 text-sm text-red-800"
          role="alert"
        >
          {uploadError}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        {(["isVegetarian", "isAvailable", "isActive"] as const).map((field) => (
          <label
            key={field}
            className="bg-muted/40 flex items-center gap-2 rounded-lg border p-3 text-sm font-medium"
          >
            <input
              type="checkbox"
              className="size-4 accent-emerald-700"
              {...register(field)}
            />
            {field === "isVegetarian"
              ? "Vegetarian"
              : field === "isAvailable"
                ? "Available"
                : "Active"}
          </label>
        ))}
      </div>
      <ModifierSelector
        groups={modifierGroups}
        selectedIds={selectedGroups}
        onChange={setSelectedGroups}
      />
      {error && (
        <p
          className="rounded-lg bg-red-50 p-3 text-sm text-red-800"
          role="alert"
        >
          {error}
        </p>
      )}
      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={
            isSaving ||
            uploading ||
            categories.every((category) => !category.isActive)
          }
        >
          {isSaving && <LoaderCircle className="size-4 animate-spin" />}
          {item ? "Save changes" : "Create menu item"}
        </Button>
      </div>
    </form>
  );
}
