"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { MenuItem, Order } from "@restroflow/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Clock3,
  History,
  Leaf,
  LoaderCircle,
  Minus,
  Plus,
  RefreshCw,
  Search,
  ShoppingBag,
  Trash2,
  XCircle,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { useAuth } from "@/components/auth/auth-provider";
import { MenuItemImage } from "@/components/menu/menu-item-image";
import { PriceDisplay } from "@/components/menu/price-display";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/auth-api";
import { fetchMenuItems } from "@/lib/menu-api";
import {
  addOrderItems,
  createOrder,
  fetchOrder,
  fetchOrderHistory,
  fetchOrders,
  updateOrderStatus,
} from "@/lib/order-api";
import { fetchTables } from "@/lib/table-api";
import { cn } from "@/lib/utils";
import {
  createModifierFormSchema,
  type ModifierFormValues,
} from "@/lib/pos-validation";
import {
  cartEstimatedTotal,
  cartLineTotal,
  useOrderCartStore,
  type CartModifier,
} from "@/stores/order-cart-store";

function errorText(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

function statusClass(status: Order["status"]) {
  if (status === "SERVED") return "bg-emerald-100 text-emerald-800";
  if (status === "CANCELLED" || status === "REJECTED")
    return "bg-red-100 text-red-800";
  if (status === "READY") return "bg-sky-100 text-sky-800";
  return "bg-amber-100 text-amber-900";
}

function ModifierDialog({
  item,
  onClose,
}: {
  item: MenuItem | null;
  onClose: () => void;
}) {
  const addLine = useOrderCartStore((state) => state.addLine);
  const groups = useMemo(() => item?.modifierGroups ?? [], [item]);
  const schema = useMemo(
    () => createModifierFormSchema(groups.map(({ group }) => group)),
    [groups],
  );
  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm<ModifierFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { modifierIds: [], quantity: 1, instructions: "" },
  });
  const selectedIds = useWatch({ control, name: "modifierIds" });
  const quantity = useWatch({ control, name: "quantity" });
  const selectionError = groups.find(({ group }) => {
    const count = group.modifiers.filter((modifier) =>
      selectedIds.includes(modifier.id),
    ).length;
    return count < group.minSelections || count > group.maxSelections;
  });

  const toggle = (groupId: string, modifierId: string, maximum: number) => {
    const group = groups.find(({ group }) => group.id === groupId)?.group;
    if (!group) return;
    const selectedInGroup = group.modifiers.filter((modifier) =>
      selectedIds.includes(modifier.id),
    );
    let next = selectedIds;
    if (selectedIds.includes(modifierId)) {
      next = selectedIds.filter((id) => id !== modifierId);
    } else if (selectedInGroup.length < maximum) {
      next = [...selectedIds, modifierId];
    } else if (maximum === 1) {
      const groupIds = new Set(group.modifiers.map((modifier) => modifier.id));
      next = [...selectedIds.filter((id) => !groupIds.has(id)), modifierId];
    }
    setValue("modifierIds", next, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const confirm = handleSubmit((values) => {
    if (!item) return;
    const modifiers: CartModifier[] = groups.flatMap(({ group }) =>
      group.modifiers
        .filter((modifier) => values.modifierIds.includes(modifier.id))
        .map((modifier) => ({
          id: modifier.id,
          groupId: group.id,
          groupName: group.name,
          name: modifier.name,
          priceDeltaMinor: modifier.priceDeltaMinor,
        })),
    );
    addLine({
      menuItemId: item.id,
      name: item.name,
      imageUrl: item.imageUrl,
      unitPriceMinor: item.priceMinor,
      quantity: values.quantity,
      modifiers,
      specialInstructions: values.instructions || null,
    });
    onClose();
  });

  return (
    <Dialog
      open={Boolean(item)}
      onClose={onClose}
      title={item?.name ?? "Customize item"}
      description="Selections and prices are revalidated by the server when you submit."
    >
      <form
        className="space-y-5 p-5 sm:p-6"
        onSubmit={(event) => void confirm(event)}
        noValidate
      >
        {groups.map(({ group }) => {
          const selectedCount = group.modifiers.filter((modifier) =>
            selectedIds.includes(modifier.id),
          ).length;
          return (
            <fieldset key={group.id} className="space-y-2">
              <legend className="flex w-full items-center justify-between text-sm font-bold">
                <span>{group.name}</span>
                <span className="text-muted-foreground text-xs font-medium">
                  {group.minSelections > 0
                    ? `${group.minSelections}–${group.maxSelections} required`
                    : `Up to ${group.maxSelections}`}
                </span>
              </legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {group.modifiers.map((modifier) => {
                  const checked = selectedIds.includes(modifier.id);
                  return (
                    <label
                      key={modifier.id}
                      className={cn(
                        "flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm",
                        checked && "border-primary bg-accent",
                      )}
                    >
                      <input
                        type={group.maxSelections === 1 ? "radio" : "checkbox"}
                        name={`modifier-${group.id}`}
                        checked={checked}
                        onChange={() =>
                          toggle(group.id, modifier.id, group.maxSelections)
                        }
                      />
                      <span className="flex-1 font-medium">
                        {modifier.name}
                      </span>
                      {modifier.priceDeltaMinor > 0 && (
                        <PriceDisplay amountMinor={modifier.priceDeltaMinor} />
                      )}
                    </label>
                  );
                })}
              </div>
              {selectedCount < group.minSelections && (
                <p className="text-xs text-amber-800" role="status">
                  Choose {group.minSelections - selectedCount} more.
                </p>
              )}
            </fieldset>
          );
        })}
        <label className="block text-sm font-bold">
          Special instructions
          <Textarea
            className="mt-2"
            maxLength={500}
            placeholder="Allergies or preparation notes"
            {...register("instructions")}
          />
          {errors.instructions && (
            <span className="mt-1 block text-xs text-red-700" role="alert">
              {errors.instructions.message}
            </span>
          )}
        </label>
        <div className="flex items-center justify-between gap-4">
          <div
            className="flex items-center rounded-lg border"
            aria-label="Quantity"
          >
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() =>
                setValue("quantity", Math.max(1, quantity - 1), {
                  shouldValidate: true,
                })
              }
              aria-label="Decrease quantity"
            >
              <Minus className="size-4" />
            </Button>
            <span className="w-10 text-center font-bold">{quantity}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() =>
                setValue("quantity", Math.min(99, quantity + 1), {
                  shouldValidate: true,
                })
              }
              aria-label="Increase quantity"
            >
              <Plus className="size-4" />
            </Button>
          </div>
          <Button type="submit" size="lg" disabled={Boolean(selectionError)}>
            Add to cart
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export function WaiterPos() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const membership = user?.memberships.find((candidate) =>
    ["ADMIN", "MANAGER", "WAITER"].includes(candidate.role),
  );
  const restaurantId = membership?.restaurantId;
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [customizing, setCustomizing] = useState<MenuItem | null>(null);
  const [addToOrderId, setAddToOrderId] = useState<string | null>(null);
  const [viewOrderId, setViewOrderId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const submission = useRef<{ key: string; fingerprint: string } | null>(null);
  const lines = useOrderCartStore((state) => state.lines);
  const setQuantity = useOrderCartStore((state) => state.setQuantity);
  const removeLine = useOrderCartStore((state) => state.removeLine);
  const clearCart = useOrderCartStore((state) => state.clear);

  const tables = useQuery({
    queryKey: ["tables", restaurantId, "occupied"],
    queryFn: () => fetchTables(restaurantId!, { occupancy: "occupied" }),
    enabled: Boolean(restaurantId),
  });
  const menu = useQuery({
    queryKey: ["pos-menu", restaurantId],
    queryFn: () =>
      fetchMenuItems(restaurantId!, {
        page: 1,
        limit: 100,
        availability: "available",
        status: "active",
      }),
    enabled: Boolean(restaurantId),
  });
  const orders = useQuery({
    queryKey: ["orders", restaurantId, sessionId],
    queryFn: () =>
      fetchOrders(restaurantId!, {
        tableSessionId: sessionId!,
        page: 1,
        limit: 100,
      }),
    enabled: Boolean(restaurantId && sessionId),
  });
  const orderDetail = useQuery({
    queryKey: ["order", restaurantId, viewOrderId],
    queryFn: () => fetchOrder(restaurantId!, viewOrderId!),
    enabled: Boolean(restaurantId && viewOrderId),
  });
  const history = useQuery({
    queryKey: ["order-history", restaurantId, viewOrderId],
    queryFn: () => fetchOrderHistory(restaurantId!, viewOrderId!),
    enabled: Boolean(restaurantId && viewOrderId),
  });

  const selectedTable = tables.data?.find(
    (table) => table.activeSession?.id === sessionId,
  );
  const addTarget = orders.data?.orders.find(
    (order) => order.id === addToOrderId,
  );
  const categories = useMemo(() => {
    const unique = new Map<string, string>();
    for (const item of menu.data?.items ?? [])
      unique.set(item.category.id, item.category.name);
    return [...unique.entries()];
  }, [menu.data]);
  const visibleItems = (menu.data?.items ?? []).filter(
    (item) =>
      (!categoryId || item.categoryId === categoryId) &&
      (!search ||
        `${item.name} ${item.description ?? ""}`
          .toLowerCase()
          .includes(search.toLowerCase())),
  );

  const refreshOrders = async () => {
    await queryClient.invalidateQueries({
      queryKey: ["orders", restaurantId, sessionId],
    });
  };
  const submitOrder = useMutation({
    mutationFn: async () => {
      if (!restaurantId || !sessionId || lines.length === 0)
        throw new Error("Order is incomplete.");
      const items = lines.map((line) => ({
        menuItemId: line.menuItemId,
        quantity: line.quantity,
        modifierIds: line.modifiers.map((modifier) => modifier.id),
        specialInstructions: line.specialInstructions,
      }));
      const fingerprint = JSON.stringify({
        sessionId,
        addToOrderId: addTarget?.id ?? null,
        version: addTarget?.version ?? null,
        items,
      });
      const key =
        submission.current?.fingerprint === fingerprint
          ? submission.current.key
          : crypto.randomUUID();
      submission.current = { key, fingerprint };
      return addTarget
        ? addOrderItems(restaurantId, addTarget.id, key, {
            version: addTarget.version,
            items,
          })
        : createOrder(restaurantId, key, { tableSessionId: sessionId, items });
    },
    onSuccess: async (order) => {
      clearCart();
      setAddToOrderId(null);
      submission.current = null;
      setNotice(`Order ${order.orderNumber} confirmed by the server.`);
      await refreshOrders();
    },
  });
  const cancelOrder = useMutation({
    mutationFn: (order: Order) =>
      updateOrderStatus(restaurantId!, order.id, {
        version: order.version,
        status: "CANCELLED",
        reason: "Cancelled from waiter POS",
      }),
    onSuccess: async () => {
      setNotice("Order cancelled.");
      await refreshOrders();
    },
  });

  if (tables.isPending || menu.isPending) {
    return (
      <div className="grid min-h-96 place-items-center" aria-live="polite">
        <span className="text-muted-foreground inline-flex items-center gap-2 text-sm">
          <LoaderCircle className="size-4 animate-spin" /> Loading waiter POS
        </span>
      </div>
    );
  }
  if (tables.isError || menu.isError) {
    return (
      <Card className="mx-auto max-w-xl p-8 text-center" role="alert">
        <XCircle className="mx-auto size-9 text-red-700" />
        <h1 className="mt-3 text-xl font-bold">POS unavailable</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Tables or menu data could not be loaded. No draft order was submitted.
        </p>
        <Button
          className="mt-5"
          variant="outline"
          onClick={() => {
            void tables.refetch();
            void menu.refetch();
          }}
        >
          <RefreshCw className="size-4" /> Try again
        </Button>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <header>
        <p className="text-primary text-xs font-bold tracking-[.16em] uppercase">
          Waiter point of sale
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          Create an order
        </h1>
        <p className="text-muted-foreground mt-2">
          Select an active table session, customize menu items, and submit once.
        </p>
      </header>

      {notice && (
        <div
          className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"
          role="status"
        >
          <CheckCircle2 className="size-4" /> {notice}
        </div>
      )}

      <section aria-labelledby="active-tables-heading">
        <div className="flex items-center justify-between">
          <h2 id="active-tables-heading" className="text-lg font-bold">
            Active tables
          </h2>
          <span className="text-muted-foreground text-sm">
            {tables.data.length} occupied
          </span>
        </div>
        {tables.data.length === 0 ? (
          <Card className="mt-3 p-6 text-center">
            <p className="font-bold">No active table sessions</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Open a session from Service floor before taking an order.
            </p>
          </Card>
        ) : (
          <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
            {tables.data.map((table) => (
              <Button
                key={table.id}
                size="lg"
                variant={
                  sessionId === table.activeSession?.id ? "default" : "outline"
                }
                className="min-w-36 shrink-0"
                onClick={() => {
                  if (sessionId !== table.activeSession?.id) {
                    clearCart();
                    setAddToOrderId(null);
                  }
                  setSessionId(table.activeSession?.id ?? null);
                  setNotice(null);
                }}
              >
                {table.displayName}
                <span className="text-xs opacity-75">#{table.tableNumber}</span>
              </Button>
            ))}
          </div>
        )}
      </section>

      {!sessionId ? (
        <Card className="grid min-h-80 place-items-center p-8 text-center">
          <div>
            <ShoppingBag className="text-muted-foreground mx-auto size-10" />
            <h2 className="mt-4 text-xl font-bold">Choose a table</h2>
            <p className="text-muted-foreground mt-2 text-sm">
              The cart is tied to one active table session.
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <label className="relative">
                <span className="sr-only">Search menu</span>
                <Search className="text-muted-foreground absolute top-3.5 left-3 size-4" />
                <Input
                  className="pl-9"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search the menu"
                />
              </label>
              <Button variant="outline" onClick={() => void menu.refetch()}>
                <RefreshCw className="size-4" /> Refresh menu
              </Button>
            </div>
            <div
              className="flex gap-2 overflow-x-auto pb-1"
              aria-label="Menu categories"
            >
              <Button
                size="sm"
                variant={categoryId === null ? "default" : "outline"}
                onClick={() => setCategoryId(null)}
              >
                All
              </Button>
              {categories.map(([id, name]) => (
                <Button
                  key={id}
                  size="sm"
                  className="shrink-0"
                  variant={categoryId === id ? "default" : "outline"}
                  onClick={() => setCategoryId(id)}
                >
                  {name}
                </Button>
              ))}
            </div>
            {visibleItems.length === 0 ? (
              <Card className="p-10 text-center">
                <h2 className="font-bold">No available menu items</h2>
                <p className="text-muted-foreground mt-2 text-sm">
                  Change the category or search, or refresh availability.
                </p>
              </Card>
            ) : (
              <section
                className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
                aria-label="Menu items"
              >
                {visibleItems.map((item) => (
                  <Card
                    key={item.id}
                    className="flex min-h-48 flex-col overflow-hidden"
                  >
                    <MenuItemImage
                      imageUrl={item.imageUrl}
                      alt={item.name}
                      className="aspect-[16/8] w-full"
                    />
                    <div className="flex flex-1 flex-col p-4">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-bold">{item.name}</h3>
                        {item.isVegetarian && (
                          <Leaf
                            className="size-4 shrink-0 text-emerald-700"
                            aria-label="Vegetarian"
                          />
                        )}
                      </div>
                      <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                        {item.description || "Freshly prepared"}
                      </p>
                      <div className="mt-auto flex items-end justify-between gap-3 pt-4">
                        <PriceDisplay
                          amountMinor={item.priceMinor}
                          className="font-bold"
                        />
                        <Button size="sm" onClick={() => setCustomizing(item)}>
                          <Plus className="size-4" /> Add
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </section>
            )}
          </div>

          <Card className="xl:sticky xl:top-24">
            <div className="border-b p-5">
              <p className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                {addTarget ? `Add to ${addTarget.orderNumber}` : "New order"}
              </p>
              <h2 className="mt-1 text-lg font-bold">
                {selectedTable?.displayName ?? "Selected table"}
              </h2>
            </div>
            <div className="max-h-[45vh] space-y-3 overflow-y-auto p-4">
              {lines.length === 0 ? (
                <div className="py-8 text-center">
                  <ShoppingBag className="text-muted-foreground mx-auto size-7" />
                  <p className="mt-3 text-sm font-bold">Cart is empty</p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Add an available menu item to begin.
                  </p>
                </div>
              ) : (
                lines.map((line) => (
                  <div key={line.key} className="rounded-xl border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold">{line.name}</p>
                        {line.modifiers.length > 0 && (
                          <p className="text-muted-foreground mt-1 text-xs">
                            {line.modifiers
                              .map((modifier) => modifier.name)
                              .join(", ")}
                          </p>
                        )}
                        {line.specialInstructions && (
                          <p className="mt-1 text-xs italic">
                            “{line.specialInstructions}”
                          </p>
                        )}
                      </div>
                      <PriceDisplay
                        amountMinor={cartLineTotal(line)}
                        className="text-sm font-bold"
                      />
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center rounded-md border">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() =>
                            setQuantity(line.key, line.quantity - 1)
                          }
                          aria-label={`Decrease ${line.name}`}
                        >
                          <Minus className="size-3" />
                        </Button>
                        <span className="w-8 text-center text-sm font-bold">
                          {line.quantity}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() =>
                            setQuantity(
                              line.key,
                              Math.min(99, line.quantity + 1),
                            )
                          }
                          aria-label={`Increase ${line.name}`}
                        >
                          <Plus className="size-3" />
                        </Button>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-red-700"
                        onClick={() => removeLine(line.key)}
                        aria-label={`Remove ${line.name}`}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="space-y-3 border-t p-5">
              <div className="flex items-center justify-between font-bold">
                <span>Estimated total</span>
                <PriceDisplay amountMinor={cartEstimatedTotal(lines)} />
              </div>
              <p className="text-muted-foreground text-xs">
                Final prices and total come from PostgreSQL after submission.
              </p>
              {submitOrder.isError && (
                <div
                  className="rounded-lg bg-red-50 p-3 text-sm text-red-800"
                  role="alert"
                >
                  {errorText(
                    submitOrder.error,
                    "The order was not confirmed. Retry safely with the same cart.",
                  )}
                </div>
              )}
              <Button
                size="lg"
                className="w-full"
                disabled={lines.length === 0 || submitOrder.isPending}
                onClick={() => submitOrder.mutate()}
              >
                {submitOrder.isPending && (
                  <LoaderCircle className="size-4 animate-spin" />
                )}
                {submitOrder.isError
                  ? "Retry submission"
                  : addTarget
                    ? "Add items to order"
                    : "Submit order"}
              </Button>
              {addTarget && (
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => setAddToOrderId(null)}
                >
                  Cancel add-items mode
                </Button>
              )}
            </div>
          </Card>
        </div>
      )}

      {sessionId && (
        <section className="space-y-3" aria-labelledby="table-orders-heading">
          <div className="flex items-center justify-between">
            <h2 id="table-orders-heading" className="text-xl font-bold">
              Table orders
            </h2>
            {orders.isFetching && (
              <LoaderCircle className="text-muted-foreground size-4 animate-spin" />
            )}
          </div>
          {orders.isError ? (
            <Card className="p-5" role="alert">
              <p className="font-bold text-red-800">
                Orders could not be loaded.
              </p>
              <Button
                className="mt-3"
                variant="outline"
                onClick={() => void orders.refetch()}
              >
                Try again
              </Button>
            </Card>
          ) : orders.data?.orders.length === 0 ? (
            <Card className="p-6 text-center text-sm">
              No orders for this session yet.
            </Card>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {orders.data?.orders.map((order) => (
                <Card key={order.id} className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold">{order.orderNumber}</p>
                      <p className="text-muted-foreground mt-1 text-xs">
                        {order.items.reduce(
                          (total, item) => total + item.quantity,
                          0,
                        )}{" "}
                        items · {new Date(order.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-1 text-xs font-bold",
                        statusClass(order.status),
                      )}
                    >
                      {order.status}
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <PriceDisplay
                      amountMinor={order.totalMinor}
                      className="font-bold"
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setViewOrderId(order.id)}
                      >
                        <History className="size-4" /> Details
                      </Button>
                      {(order.status === "PENDING" ||
                        order.status === "ACCEPTED") && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setAddToOrderId(order.id)}
                          >
                            Add items
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={cancelOrder.isPending}
                            onClick={() => cancelOrder.mutate(order)}
                          >
                            Cancel order
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>
      )}

      <ModifierDialog
        key={customizing?.id ?? "closed"}
        item={customizing}
        onClose={() => setCustomizing(null)}
      />
      <Dialog
        open={Boolean(viewOrderId)}
        onClose={() => setViewOrderId(null)}
        title={orderDetail.data?.orderNumber ?? "Order details"}
        description="Immutable item batches and status history from the server."
      >
        <div className="space-y-5 p-5 sm:p-6">
          {orderDetail.isPending || history.isPending ? (
            <p className="text-muted-foreground inline-flex items-center gap-2 text-sm">
              <LoaderCircle className="size-4 animate-spin" /> Loading order
            </p>
          ) : orderDetail.isError || history.isError ? (
            <p
              className="rounded-lg bg-red-50 p-3 text-sm text-red-800"
              role="alert"
            >
              Order details could not be loaded.
            </p>
          ) : orderDetail.data ? (
            <>
              <div className="space-y-2">
                {orderDetail.data.items.map((item) => (
                  <div key={item.id} className="rounded-xl border p-3 text-sm">
                    <div className="flex justify-between gap-3">
                      <strong>
                        {item.quantity} × {item.itemNameSnapshot}
                      </strong>
                      <PriceDisplay amountMinor={item.lineTotalMinor} />
                    </div>
                    <p className="text-muted-foreground mt-1 text-xs">
                      Batch {item.batchNumber}
                    </p>
                    {item.modifiers.length > 0 && (
                      <p className="text-muted-foreground mt-1 text-xs">
                        {item.modifiers
                          .map((modifier) => modifier.modifierNameSnapshot)
                          .join(", ")}
                      </p>
                    )}
                  </div>
                ))}
              </div>
              <ol className="space-y-3 border-t pt-5">
                {history.data?.map((entry) => (
                  <li key={entry.id} className="flex gap-3 text-sm">
                    <Clock3 className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                    <div>
                      <p className="font-bold">
                        {entry.previousStatus
                          ? `${entry.previousStatus} → `
                          : ""}
                        {entry.newStatus}
                      </p>
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        {entry.actor.displayName} ·{" "}
                        {new Date(entry.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </>
          ) : null}
        </div>
      </Dialog>
    </div>
  );
}
