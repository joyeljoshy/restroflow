"use client";

import type { CreateMenuItemRequest, MenuItem } from "@restroflow/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Utensils,
} from "lucide-react";
import { useDeferredValue, useEffect, useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { MenuItemCard } from "@/components/menu/menu-item-card";
import { MenuCategoryList } from "@/components/menu/menu-category-list";
import { MenuItemForm } from "@/components/menu/menu-item-form";
import { MenuCategoryManager } from "@/components/management/menu-category-manager";
import { ModifierGroupManager } from "@/components/management/modifier-group-manager";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ApiError } from "@/lib/auth-api";
import { fetchRestaurant } from "@/lib/management-api";
import {
  assignMenuItemModifierGroups,
  createMenuItem,
  deactivateMenuItem,
  fetchMenuCategories,
  fetchMenuItems,
  fetchModifierGroups,
  updateMenuItem,
  updateMenuItemAvailability,
  uploadMenuImage,
} from "@/lib/menu-api";

type View = "items" | "categories" | "modifiers";

export function MenuDashboard() {
  const { user } = useAuth();
  const membership = user?.memberships[0];
  const restaurantId = membership?.restaurantId;
  const canManage = membership?.role === "ADMIN";
  const queryClient = useQueryClient();
  const [view, setView] = useState<View>("items");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [availability, setAvailability] = useState<
    "all" | "available" | "unavailable"
  >("all");
  const [status, setStatus] = useState<"active" | "inactive" | "all">("active");
  const [page, setPage] = useState(1);
  const [editor, setEditor] = useState<MenuItem | "new" | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<MenuItem | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 3500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const categories = useQuery({
    queryKey: ["menu", "categories", restaurantId],
    queryFn: () => fetchMenuCategories(restaurantId!),
    enabled: Boolean(restaurantId),
  });
  const groups = useQuery({
    queryKey: ["menu", "modifier-groups", restaurantId],
    queryFn: () => fetchModifierGroups(restaurantId!),
    enabled: Boolean(restaurantId),
  });
  const restaurant = useQuery({
    queryKey: ["restaurant", restaurantId],
    queryFn: () => fetchRestaurant(restaurantId!),
    enabled: Boolean(restaurantId),
  });
  const items = useQuery({
    queryKey: [
      "menu",
      "items",
      restaurantId,
      deferredSearch,
      categoryId,
      availability,
      status,
      page,
    ],
    queryFn: () =>
      fetchMenuItems(restaurantId!, {
        search: deferredSearch || undefined,
        categoryId: categoryId ?? undefined,
        availability,
        status,
        page,
        limit: 12,
      }),
    enabled: Boolean(restaurantId),
  });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["menu", "items", restaurantId],
      }),
      queryClient.invalidateQueries({
        queryKey: ["menu", "categories", restaurantId],
      }),
      queryClient.invalidateQueries({
        queryKey: ["menu", "modifier-groups", restaurantId],
      }),
    ]);
  };
  const saveItem = useMutation({
    mutationFn: async ({
      input,
      modifierGroupIds,
    }: {
      input: CreateMenuItemRequest;
      modifierGroupIds: string[];
    }) => {
      const saved =
        editor && editor !== "new"
          ? await updateMenuItem(restaurantId!, editor.id, input)
          : await createMenuItem(restaurantId!, input);
      return assignMenuItemModifierGroups(restaurantId!, saved.id, {
        assignments: modifierGroupIds.map((modifierGroupId, sortOrder) => ({
          modifierGroupId,
          sortOrder,
        })),
      });
    },
    onSuccess: async () => {
      setEditor(null);
      setNotice("Menu item saved.");
      await refresh();
    },
  });
  const availabilityMutation = useMutation({
    mutationFn: (item: MenuItem) =>
      updateMenuItemAvailability(restaurantId!, item.id, !item.isAvailable),
    onSuccess: async () => {
      setNotice("Availability updated.");
      await refresh();
    },
  });
  const archiveMutation = useMutation({
    mutationFn: (item: MenuItem) => deactivateMenuItem(restaurantId!, item.id),
    onSuccess: async () => {
      setArchiveTarget(null);
      setNotice("Menu item archived.");
      await refresh();
    },
  });

  const errorMessage = saveItem.isError
    ? saveItem.error instanceof ApiError
      ? saveItem.error.message
      : "The menu item could not be saved."
    : undefined;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {notice && (
        <div
          className="fixed top-20 right-5 z-[80] rounded-xl bg-emerald-900 px-4 py-3 text-sm font-semibold text-white shadow-xl"
          role="status"
        >
          {notice}
        </div>
      )}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-primary text-xs font-bold tracking-[.16em] uppercase">
            Menu operations
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            Menu management
          </h1>
          <p className="text-muted-foreground mt-2">
            Organize categories, dishes, availability, and reusable modifiers.
          </p>
        </div>
        {canManage && view === "items" && (
          <Button
            onClick={() => setEditor("new")}
            disabled={!categories.data?.some((category) => category.isActive)}
          >
            <Plus className="size-4" /> Add item
          </Button>
        )}
      </header>

      {!canManage && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
          Manager view · menu changes remain restricted to administrators under
          the current permission model.
        </div>
      )}

      <div
        className="flex gap-1 rounded-xl bg-stone-100 p-1"
        role="tablist"
        aria-label="Menu management sections"
      >
        {(["items", "categories", "modifiers"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={view === tab}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold capitalize transition-colors ${view === tab ? "bg-white shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => setView(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {view === "categories" && restaurantId && (
        <MenuCategoryManager
          restaurantId={restaurantId}
          categories={categories.data ?? []}
          canManage={canManage}
          onChanged={refresh}
        />
      )}
      {view === "modifiers" && restaurantId && (
        <ModifierGroupManager
          restaurantId={restaurantId}
          groups={groups.data ?? []}
          canManage={canManage}
          onChanged={refresh}
        />
      )}
      {view === "items" && (
        <section className="space-y-5">
          <Card>
            <CardContent className="grid gap-3 p-4 md:grid-cols-[minmax(15rem,1fr)_12rem_12rem]">
              <label className="relative">
                <span className="sr-only">Search menu items</span>
                <Search className="text-muted-foreground pointer-events-none absolute top-3.5 left-3 size-4" />
                <Input
                  className="pl-9"
                  placeholder="Search dishes and descriptions"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                />
              </label>
              <label>
                <span className="sr-only">Availability filter</span>
                <Select
                  value={availability}
                  onChange={(event) => {
                    setAvailability(event.target.value as typeof availability);
                    setPage(1);
                  }}
                >
                  <option value="all">All availability</option>
                  <option value="available">Available</option>
                  <option value="unavailable">Unavailable</option>
                </Select>
              </label>
              <label>
                <span className="sr-only">Status filter</span>
                <Select
                  value={status}
                  onChange={(event) => {
                    setStatus(event.target.value as typeof status);
                    setPage(1);
                  }}
                >
                  <option value="active">Active items</option>
                  <option value="inactive">Archived items</option>
                  <option value="all">All statuses</option>
                </Select>
              </label>
            </CardContent>
          </Card>
          <MenuCategoryList
            categories={categories.data ?? []}
            selectedId={categoryId}
            onSelect={(selected) => {
              setCategoryId(selected);
              setPage(1);
            }}
          />
          {items.isPending || categories.isPending || groups.isPending ? (
            <div
              className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
              aria-label="Loading menu items"
            >
              {Array.from({ length: 6 }, (_, index) => (
                <div
                  key={index}
                  className="bg-card h-80 animate-pulse rounded-2xl border"
                >
                  <div className="bg-muted h-44" />
                  <div className="space-y-3 p-4">
                    <div className="bg-muted h-4 w-2/3 rounded" />
                    <div className="bg-muted h-3 w-full rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : items.isError || categories.isError || groups.isError ? (
            <Card>
              <CardHeader>
                <CardTitle>Menu unavailable</CardTitle>
                <p className="text-muted-foreground text-sm">
                  The menu data could not be loaded.
                </p>
              </CardHeader>
              <CardContent>
                <Button variant="outline" onClick={() => void refresh()}>
                  <RefreshCw className="size-4" /> Try again
                </Button>
              </CardContent>
            </Card>
          ) : items.data.items.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Utensils className="text-muted-foreground mx-auto size-9" />
                <h2 className="mt-4 font-bold">No menu items match</h2>
                <p className="text-muted-foreground mt-1 text-sm">
                  Adjust filters or add a menu item.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex items-center justify-between text-sm">
                <p className="text-muted-foreground">
                  <strong className="text-foreground">
                    {items.data.pagination.total}
                  </strong>{" "}
                  items
                </p>
                <p className="text-muted-foreground">
                  Page {items.data.pagination.page} of{" "}
                  {items.data.pagination.totalPages}
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {items.data.items.map((item) => (
                  <MenuItemCard
                    key={item.id}
                    item={item}
                    currency={restaurant.data?.currency ?? "INR"}
                    actions={
                      canManage ? (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditor(item)}
                          >
                            <Pencil className="size-4" /> Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => availabilityMutation.mutate(item)}
                            disabled={
                              !item.isActive || availabilityMutation.isPending
                            }
                          >
                            {item.isAvailable
                              ? "Mark unavailable"
                              : "Mark available"}
                          </Button>
                          {item.isActive && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setArchiveTarget(item)}
                            >
                              <Archive className="size-4" /> Archive
                            </Button>
                          )}
                        </>
                      ) : undefined
                    }
                  />
                ))}
              </div>
              {items.data.pagination.totalPages > 1 && (
                <div className="flex justify-center gap-2">
                  <Button
                    variant="outline"
                    disabled={page === 1}
                    onClick={() => setPage((current) => current - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    disabled={page >= items.data.pagination.totalPages}
                    onClick={() => setPage((current) => current + 1)}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </section>
      )}

      <Dialog
        open={editor !== null}
        onClose={() => setEditor(null)}
        title={editor === "new" ? "Add menu item" : "Edit menu item"}
        description="Prices are saved in integer minor units by the API."
      >
        {restaurantId && (
          <MenuItemForm
            item={editor === "new" ? null : editor}
            categories={categories.data ?? []}
            modifierGroups={groups.data ?? []}
            onUpload={(file) => uploadMenuImage(restaurantId, file)}
            onSubmit={(input, modifierGroupIds) =>
              saveItem
                .mutateAsync({ input, modifierGroupIds })
                .then(() => undefined)
            }
            isSaving={saveItem.isPending}
            error={errorMessage}
          />
        )}
      </Dialog>
      <Dialog
        open={archiveTarget !== null}
        onClose={() => setArchiveTarget(null)}
        title="Archive menu item"
        description="Archived items remain available for future historical order references."
      >
        <div className="space-y-5 p-5 sm:p-6">
          <p className="text-sm">
            Archive <strong>{archiveTarget?.name}</strong>? It will also be
            marked unavailable.
          </p>
          {archiveMutation.isError && (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
              The item could not be archived.
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setArchiveTarget(null)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                archiveTarget && archiveMutation.mutate(archiveTarget)
              }
              disabled={archiveMutation.isPending}
            >
              {archiveMutation.isPending && (
                <LoaderCircle className="size-4 animate-spin" />
              )}{" "}
              Archive item
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
