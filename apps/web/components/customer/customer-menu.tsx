"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  customerOrderChangedEventSchema,
  type CustomerOrder,
  type PublicMenuItem,
} from "@restroflow/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Clock3,
  Leaf,
  LoaderCircle,
  Minus,
  Plus,
  RefreshCw,
  Search,
  ShoppingBag,
  Trash2,
  UtensilsCrossed,
  Wifi,
  WifiOff,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { io } from "socket.io-client";
import { z } from "zod";

import { MenuItemImage } from "@/components/menu/menu-item-image";
import { CustomerOrderProgress } from "@/components/customer/customer-order-progress";
import { PriceDisplay } from "@/components/menu/price-display";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, apiUrl } from "@/lib/auth-api";
import {
  activateCustomerSession,
  createCustomerOrder,
  fetchCustomerOrders,
  fetchCustomerSession,
  fetchPublicMenu,
} from "@/lib/customer-api";
import {
  createModifierFormSchema,
  type ModifierFormValues,
} from "@/lib/pos-validation";
import {
  cartEstimatedTotal,
  cartLineTotal,
  type CartModifier,
} from "@/stores/order-cart-store";
import { useCustomerCartStore } from "@/stores/customer-cart-store";

function errorText(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

function ItemDialog({
  item,
  onClose,
}: {
  item: PublicMenuItem | null;
  onClose: () => void;
}) {
  const addLine = useCustomerCartStore((state) => state.addLine);
  const groups = useMemo(() => item?.modifierGroups ?? [], [item]);
  const schema = useMemo(
    () => createModifierFormSchema(groups.map(({ group }) => group)),
    [groups],
  );
  const {
    register,
    control,
    setValue,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ModifierFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { modifierIds: [], quantity: 1, instructions: "" },
  });
  const selectedIds = useWatch({ control, name: "modifierIds" });
  const quantity = useWatch({ control, name: "quantity" });

  useEffect(() => reset(), [item, reset]);

  const toggle = (groupId: string, modifierId: string, maximum: number) => {
    const group = groups.find(({ group }) => group.id === groupId)?.group;
    if (!group) return;
    const groupIds = new Set(group.modifiers.map((modifier) => modifier.id));
    const selectedInGroup = selectedIds.filter((id) => groupIds.has(id));
    let next = selectedIds;
    if (selectedIds.includes(modifierId))
      next = selectedIds.filter((id) => id !== modifierId);
    else if (selectedInGroup.length < maximum)
      next = [...selectedIds, modifierId];
    else if (maximum === 1)
      next = [...selectedIds.filter((id) => !groupIds.has(id)), modifierId];
    setValue("modifierIds", next, { shouldValidate: true, shouldDirty: true });
  };

  const submit = handleSubmit((values) => {
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
      description="Choose your options. The restaurant confirms final pricing when you order."
    >
      <form
        className="space-y-5 p-5 sm:p-6"
        onSubmit={(event) => void submit(event)}
        noValidate
      >
        {item && (
          <div className="flex items-center justify-between rounded-xl bg-stone-50 p-3">
            <span className="text-sm text-stone-600">Base price</span>
            <PriceDisplay amountMinor={item.priceMinor} className="font-bold" />
          </div>
        )}
        {groups.map(({ group }) => (
          <fieldset key={group.id} className="space-y-2">
            <legend className="flex w-full justify-between gap-3 text-sm font-bold">
              <span>{group.name}</span>
              <span className="text-muted-foreground text-xs font-medium">
                {group.minSelections > 0
                  ? `Choose ${group.minSelections}–${group.maxSelections}`
                  : `Up to ${group.maxSelections}`}
              </span>
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {group.modifiers.map((modifier) => {
                const checked = selectedIds.includes(modifier.id);
                return (
                  <label
                    key={modifier.id}
                    className={`flex min-h-12 cursor-pointer items-center justify-between rounded-xl border p-3 text-sm ${checked ? "border-emerald-600 bg-emerald-50" : "bg-white"}`}
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type={group.maxSelections === 1 ? "radio" : "checkbox"}
                        name={`group-${group.id}`}
                        checked={checked}
                        onChange={() =>
                          toggle(group.id, modifier.id, group.maxSelections)
                        }
                      />
                      {modifier.name}
                    </span>
                    {modifier.priceDeltaMinor > 0 && (
                      <PriceDisplay
                        amountMinor={modifier.priceDeltaMinor}
                        className="text-xs font-semibold"
                      />
                    )}
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}
        {errors.modifierIds && (
          <p className="text-sm text-red-700" role="alert">
            {errors.modifierIds.message}
          </p>
        )}
        <label className="block space-y-2 text-sm font-bold">
          <span>Special instructions</span>
          <Textarea
            {...register("instructions")}
            placeholder="Allergies or preparation requests"
          />
        </label>
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold">Quantity</span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="icon"
              variant="outline"
              aria-label="Decrease quantity"
              onClick={() => setValue("quantity", Math.max(1, quantity - 1))}
            >
              <Minus className="size-4" />
            </Button>
            <output className="w-8 text-center font-bold">{quantity}</output>
            <Button
              type="button"
              size="icon"
              variant="outline"
              aria-label="Increase quantity"
              onClick={() => setValue("quantity", Math.min(99, quantity + 1))}
            >
              <Plus className="size-4" />
            </Button>
          </div>
        </div>
        <Button className="min-h-12 w-full" type="submit">
          Add to cart
        </Button>
      </form>
    </Dialog>
  );
}

const activationSchema = z.object({
  activationCode: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code from your server."),
});

function ActivationDialog({
  open,
  identifier,
  onClose,
}: {
  open: boolean;
  identifier: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<{ activationCode: string }>({
    resolver: zodResolver(activationSchema),
  });
  const activation = useMutation({
    mutationFn: (code: string) => activateCustomerSession(identifier, code),
    onSuccess: (session) => {
      queryClient.setQueryData(["customer-session"], session);
      queryClient.setQueryData(["customer-orders"], []);
      void queryClient.invalidateQueries({ queryKey: ["customer-orders"] });
      onClose();
    },
  });
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Activate ordering"
      description="Ask your server for the short-lived code for this table."
    >
      <form
        className="space-y-4 p-5 sm:p-6"
        onSubmit={(event) =>
          void handleSubmit((value) => activation.mutate(value.activationCode))(
            event,
          )
        }
        noValidate
      >
        <label className="block space-y-2 text-sm font-bold">
          <span>6-digit activation code</span>
          <Input
            {...register("activationCode")}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            className="h-14 text-center font-mono text-2xl tracking-[.25em]"
          />
        </label>
        {errors.activationCode && (
          <p className="text-sm text-red-700" role="alert">
            {errors.activationCode.message}
          </p>
        )}
        {activation.isError && (
          <p
            className="rounded-xl bg-red-50 p-3 text-sm text-red-800"
            role="alert"
          >
            {errorText(activation.error, "The code could not be verified.")}
          </p>
        )}
        <Button className="min-h-12 w-full" disabled={activation.isPending}>
          {activation.isPending && (
            <LoaderCircle className="size-4 animate-spin" />
          )}
          Activate ordering
        </Button>
      </form>
    </Dialog>
  );
}

export function CustomerMenu({ identifier }: { identifier: string }) {
  const queryClient = useQueryClient();
  const ensureScope = useCustomerCartStore((state) => state.ensureScope);
  const lines = useCustomerCartStore((state) => state.lines);
  const setQuantity = useCustomerCartStore((state) => state.setQuantity);
  const removeLine = useCustomerCartStore((state) => state.removeLine);
  const clear = useCustomerCartStore((state) => state.clear);
  const [search, setSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState<PublicMenuItem | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [activationOpen, setActivationOpen] = useState(false);
  const [confirmed, setConfirmed] = useState<CustomerOrder | null>(null);
  const [connection, setConnection] = useState<
    "offline" | "connecting" | "connected"
  >("offline");
  const submissionKey = useRef<string | null>(null);

  useEffect(() => ensureScope(identifier), [ensureScope, identifier]);

  const menu = useQuery({
    queryKey: ["public-menu", identifier],
    queryFn: () => fetchPublicMenu(identifier),
  });
  const session = useQuery({
    queryKey: ["customer-session"],
    queryFn: fetchCustomerSession,
    retry: false,
  });
  const orders = useQuery({
    queryKey: ["customer-orders"],
    queryFn: fetchCustomerOrders,
    enabled: Boolean(session.data),
    refetchInterval: connection === "connected" ? 60_000 : 15_000,
  });
  const sessionInvalid =
    orders.error instanceof ApiError && orders.error.status === 401;

  const orderIds = useMemo(
    () =>
      (orders.data ?? [])
        .map((order) => order.id)
        .sort()
        .join(","),
    [orders.data],
  );
  useEffect(() => {
    if (!session.data || sessionInvalid) return;
    const socket = io(apiUrl, {
      withCredentials: true,
      auth: { audience: "customer" },
      transports: ["websocket", "polling"],
      reconnection: true,
    });
    const seen = new Set<string>();
    const versions = new Map<string, number>();
    const reconcile = () =>
      void queryClient.invalidateQueries({ queryKey: ["customer-orders"] });
    socket.on("connect", () => {
      const ids = orderIds.split(",").filter(Boolean);
      if (ids.length === 0) {
        setConnection("connected");
        reconcile();
        return;
      }
      setConnection("connecting");
      let pending = ids.length;
      for (const orderId of ids)
        socket.emit("customer:subscribe", { orderId }, () => {
          pending -= 1;
          if (pending === 0) {
            setConnection("connected");
            reconcile();
          }
        });
    });
    socket.on("disconnect", () => setConnection("connecting"));
    socket.on("connect_error", () => setConnection("connecting"));
    socket.io.on("reconnect_attempt", () => setConnection("connecting"));
    socket.on("customer:order-changed", (input: unknown) => {
      const parsed = customerOrderChangedEventSchema.safeParse(input);
      if (!parsed.success || seen.has(parsed.data.eventId)) return;
      seen.add(parsed.data.eventId);
      const latest = versions.get(parsed.data.orderId) ?? 0;
      if (parsed.data.orderVersion < latest) return;
      versions.set(parsed.data.orderId, parsed.data.orderVersion);
      reconcile();
    });
    return () => {
      socket.removeAllListeners();
      socket.io.removeAllListeners();
      socket.disconnect();
      setConnection("offline");
    };
  }, [orderIds, queryClient, session.data, sessionInvalid]);

  const submitOrder = useMutation({
    mutationFn: () => {
      submissionKey.current ??= crypto.randomUUID();
      return createCustomerOrder(submissionKey.current, {
        items: lines.map((line) => ({
          menuItemId: line.menuItemId,
          quantity: line.quantity,
          modifierIds: line.modifiers.map((modifier) => modifier.id),
          specialInstructions: line.specialInstructions,
        })),
      });
    },
    onSuccess: async (order) => {
      setConfirmed(order);
      submissionKey.current = null;
      clear();
      setCartOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["customer-orders"] });
    },
  });

  const filtered = useMemo(() => {
    if (!menu.data) return [];
    const term = search.trim().toLocaleLowerCase();
    return menu.data.items.filter(
      (item) =>
        !term ||
        `${item.name} ${item.description ?? ""}`
          .toLocaleLowerCase()
          .includes(term),
    );
  }, [menu.data, search]);

  if (menu.isPending)
    return (
      <main className="mx-auto grid min-h-screen max-w-6xl place-items-center p-6">
        <p className="inline-flex items-center gap-2 text-sm text-stone-600">
          <LoaderCircle className="size-5 animate-spin" /> Loading today’s menu
        </p>
      </main>
    );
  if (menu.isError)
    return (
      <main className="mx-auto grid min-h-screen max-w-xl place-items-center p-6">
        <Card className="p-8 text-center">
          <XCircle className="mx-auto size-10 text-red-700" />
          <h1 className="mt-4 text-2xl font-black">Menu unavailable</h1>
          <p className="mt-2 text-sm text-stone-600">
            {errorText(
              menu.error,
              "This QR code is invalid or no longer active.",
            )}
          </p>
          <Button
            className="mt-5"
            variant="outline"
            onClick={() => void menu.refetch()}
          >
            <RefreshCw className="size-4" /> Try again
          </Button>
        </Card>
      </main>
    );

  const total = cartEstimatedTotal(lines);
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#ecfdf5_0,#fafaf9_22rem)] pb-28">
      <header className="border-b border-emerald-900/10 bg-emerald-950 px-4 py-8 text-white sm:py-12">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-2 text-sm font-bold text-emerald-100">
              <UtensilsCrossed className="size-5" /> RestroFlow
            </span>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold">
              Table {menu.data.context.table.tableNumber}
            </span>
          </div>
          <h1 className="mt-8 text-4xl font-black tracking-tight sm:text-5xl">
            {menu.data.context.restaurant.name}
          </h1>
          <p className="mt-2 text-emerald-100">
            Ordering for {menu.data.context.table.displayName}
          </p>
        </div>
      </header>

      <div className="sticky top-0 z-30 border-b bg-stone-50/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-6xl gap-3 overflow-x-auto">
          <label className="relative min-w-56 flex-1">
            <Search className="absolute top-3 left-3 size-4 text-stone-500" />
            <Input
              className="pl-9"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search the menu"
              aria-label="Search menu"
            />
          </label>
          <Button
            variant="outline"
            className="shrink-0"
            onClick={() => setCartOpen(true)}
          >
            <ShoppingBag className="size-4" /> Cart (
            {lines.reduce((sum, line) => sum + line.quantity, 0)})
          </Button>
        </div>
        <nav
          className="mx-auto mt-3 flex max-w-6xl gap-2 overflow-x-auto pb-1"
          aria-label="Menu categories"
        >
          {menu.data.categories.map((category) => (
            <a
              key={category.id}
              href={`#category-${category.id}`}
              className="shrink-0 rounded-full border bg-white px-4 py-2 text-xs font-bold"
            >
              {category.name}
            </a>
          ))}
        </nav>
      </div>

      <div className="mx-auto max-w-6xl space-y-10 px-4 py-8">
        {!menu.data.context.hasActiveSession && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <Clock3 className="mr-2 inline size-4" />
            You can browse, but ordering opens after staff starts your table
            session.
          </div>
        )}
        {sessionInvalid && (
          <div
            className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between"
            role="alert"
          >
            <span>
              Your ordering access has expired. Ask staff for a new code.
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setActivationOpen(true)}
            >
              Activate again
            </Button>
          </div>
        )}
        {orders.isError && !sessionInvalid && (
          <div
            className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
            role="alert"
          >
            Order tracking is temporarily unavailable. It will retry
            automatically.
          </div>
        )}
        {menu.data.categories.map((category) => {
          const items = filtered.filter(
            (item) => item.categoryId === category.id,
          );
          if (!items.length) return null;
          return (
            <section
              key={category.id}
              id={`category-${category.id}`}
              className="scroll-mt-32"
            >
              <h2 className="text-2xl font-black">{category.name}</h2>
              {category.description && (
                <p className="mt-1 text-sm text-stone-600">
                  {category.description}
                </p>
              )}
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((item) => (
                  <Card key={item.id} className="group overflow-hidden">
                    <MenuItemImage
                      imageUrl={item.imageUrl}
                      alt={item.name}
                      className="aspect-[16/10] w-full"
                    />
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-black">{item.name}</h3>
                          {item.isVegetarian && (
                            <span className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                              <Leaf className="size-3" /> Vegetarian
                            </span>
                          )}
                        </div>
                        <PriceDisplay
                          amountMinor={item.priceMinor}
                          currency={menu.data.context.restaurant.currency}
                          className="font-bold"
                        />
                      </div>
                      <p className="mt-3 line-clamp-2 min-h-10 text-sm text-stone-600">
                        {item.description || "Prepared fresh to order."}
                      </p>
                      <Button
                        className="mt-4 min-h-11 w-full"
                        onClick={() => setSelectedItem(item)}
                      >
                        Customize & add
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          );
        })}
        {filtered.length === 0 && (
          <Card className="p-10 text-center">
            <h2 className="font-black">No dishes found</h2>
            <p className="mt-2 text-sm text-stone-600">
              Try a different search.
            </p>
          </Card>
        )}

        {(orders.data?.length || confirmed) && (
          <section aria-labelledby="orders-title">
            <div className="flex items-center justify-between">
              <h2 id="orders-title" className="text-2xl font-black">
                Your orders
              </h2>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-stone-600">
                {connection === "connected" ? (
                  <Wifi className="size-3 text-emerald-700" />
                ) : (
                  <WifiOff className="size-3 text-amber-700" />
                )}
                {connection === "connected" ? "Live" : "Reconnecting"}
              </span>
            </div>
            <div className="mt-4 grid gap-4">
              {(orders.data ?? (confirmed ? [confirmed] : [])).map((order) => (
                <Card key={order.id} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold tracking-wider text-stone-500 uppercase">
                        Order {order.orderNumber}
                      </p>
                    </div>
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800">
                      {order.status}
                    </span>
                  </div>
                  <CustomerOrderProgress status={order.status} />
                  <ul className="mt-4 space-y-2 text-sm">
                    {order.items.map((item) => (
                      <li key={item.id} className="flex justify-between gap-3">
                        <span>
                          {item.quantity} × {item.itemNameSnapshot}
                        </span>
                        <span className="text-xs font-bold text-stone-500">
                          {item.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Card>
              ))}
            </div>
          </section>
        )}
      </div>

      {lines.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-white/95 p-3 backdrop-blur">
          <Button
            className="mx-auto flex min-h-12 w-full max-w-xl justify-between px-5"
            onClick={() => setCartOpen(true)}
          >
            <span>
              View cart · {lines.reduce((sum, line) => sum + line.quantity, 0)}{" "}
              items
            </span>
            <PriceDisplay
              amountMinor={total}
              currency={menu.data.context.restaurant.currency}
            />
          </Button>
        </div>
      )}

      <ItemDialog item={selectedItem} onClose={() => setSelectedItem(null)} />
      <ActivationDialog
        open={activationOpen}
        identifier={identifier}
        onClose={() => setActivationOpen(false)}
      />
      <Dialog
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        title="Your cart"
        description="Estimated total only; the restaurant validates prices when you submit."
      >
        <div className="space-y-4 p-5 sm:p-6">
          {lines.length === 0 ? (
            <p className="py-8 text-center text-sm text-stone-600">
              Your cart is empty.
            </p>
          ) : (
            lines.map((line) => (
              <div key={line.key} className="rounded-xl border p-4">
                <div className="flex justify-between gap-3">
                  <div>
                    <h3 className="font-bold">{line.name}</h3>
                    {line.modifiers.length > 0 && (
                      <p className="mt-1 text-xs text-stone-600">
                        {line.modifiers
                          .map((modifier) => modifier.name)
                          .join(", ")}
                      </p>
                    )}
                    {line.specialInstructions && (
                      <p className="mt-1 text-xs text-stone-600 italic">
                        “{line.specialInstructions}”
                      </p>
                    )}
                  </div>
                  <PriceDisplay
                    amountMinor={cartLineTotal(line)}
                    currency={menu.data.context.restaurant.currency}
                    className="font-bold"
                  />
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button
                      size="icon"
                      variant="outline"
                      aria-label={`Decrease ${line.name}`}
                      onClick={() => setQuantity(line.key, line.quantity - 1)}
                    >
                      <Minus className="size-4" />
                    </Button>
                    <span className="w-6 text-center font-bold">
                      {line.quantity}
                    </span>
                    <Button
                      size="icon"
                      variant="outline"
                      aria-label={`Increase ${line.name}`}
                      onClick={() => setQuantity(line.key, line.quantity + 1)}
                    >
                      <Plus className="size-4" />
                    </Button>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Remove ${line.name}`}
                    onClick={() => removeLine(line.key)}
                  >
                    <Trash2 className="size-4 text-red-700" />
                  </Button>
                </div>
              </div>
            ))
          )}
          {lines.length > 0 && (
            <>
              <div className="flex justify-between border-t pt-4 text-lg font-black">
                <span>Estimated subtotal</span>
                <PriceDisplay
                  amountMinor={total}
                  currency={menu.data.context.restaurant.currency}
                />
              </div>
              {submitOrder.isError && (
                <p
                  className="rounded-xl bg-red-50 p-3 text-sm text-red-800"
                  role="alert"
                >
                  {errorText(
                    submitOrder.error,
                    "We could not confirm the order. Your cart is safe; retry to reconcile the same request.",
                  )}
                </p>
              )}
              <Button
                className="min-h-12 w-full"
                disabled={
                  submitOrder.isPending || !menu.data.context.hasActiveSession
                }
                onClick={() => {
                  if (session.data && !sessionInvalid) submitOrder.mutate();
                  else {
                    setCartOpen(false);
                    setActivationOpen(true);
                  }
                }}
              >
                {submitOrder.isPending && (
                  <LoaderCircle className="size-4 animate-spin" />
                )}
                {session.data ? "Submit order" : "Activate & submit"}
              </Button>
            </>
          )}
        </div>
      </Dialog>
      <Dialog
        open={Boolean(confirmed)}
        onClose={() => setConfirmed(null)}
        title="Order confirmed"
        description="The restaurant has received your order."
      >
        <div className="p-6 text-center">
          <CheckCircle2 className="mx-auto size-14 text-emerald-600" />
          <p className="mt-4 text-sm text-stone-600">Order number</p>
          <p className="mt-1 text-2xl font-black">{confirmed?.orderNumber}</p>
          <Button
            className="mt-5"
            onClick={() => {
              setConfirmed(null);
              document
                .getElementById("orders-title")
                ?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            Track order
          </Button>
        </div>
      </Dialog>
    </main>
  );
}
