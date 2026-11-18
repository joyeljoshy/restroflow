"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, LoaderCircle, RefreshCw, Store } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/auth-api";
import { fetchRestaurant, updateRestaurant } from "@/lib/management-api";

const settingsFormSchema = z.object({
  name: z.string().trim().min(1, "Restaurant name is required.").max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Use lowercase letters, numbers, and single hyphens.",
    ),
  address: z.string().trim().max(500),
  phone: z.string().trim().max(40),
  email: z.union([z.literal(""), z.email("Enter a valid contact email.")]),
  timezone: z.string().min(1),
  currency: z.string().regex(/^[A-Z]{3}$/),
  taxName: z.string().trim().min(1, "Tax name is required.").max(40),
  taxRate: z
    .string()
    .regex(/^\d{1,3}(?:\.\d{1,2})?$/, "Enter a percentage from 0 to 100.")
    .refine((value) => Number(value) <= 100, "Tax cannot exceed 100%."),
  pricesIncludeTax: z.boolean(),
});

type SettingsForm = z.infer<typeof settingsFormSchema>;

const timezones = [
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Europe/London",
  "Europe/Paris",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "UTC",
];

const currencies = ["INR", "USD", "EUR", "GBP", "AED", "SGD", "AUD", "JPY"];

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p className="text-sm text-red-700" role="alert">
      {message}
    </p>
  ) : null;
}

export function RestaurantSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const membership = user?.memberships.find(
    (candidate) => candidate.role === "ADMIN" || candidate.role === "MANAGER",
  );
  const restaurantId = membership?.restaurantId;
  const canEdit = membership?.role === "ADMIN";
  const queryKey = ["restaurant", restaurantId] as const;
  const restaurantQuery = useQuery({
    queryKey,
    queryFn: () => fetchRestaurant(restaurantId!),
    enabled: Boolean(restaurantId),
  });
  const {
    register,
    reset,
    handleSubmit,
    setError,
    formState: { errors, isDirty },
  } = useForm<SettingsForm>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: {
      name: "",
      slug: "",
      address: "",
      phone: "",
      email: "",
      timezone: "Asia/Kolkata",
      currency: "INR",
      taxName: "Tax",
      taxRate: "0",
      pricesIncludeTax: false,
    },
  });
  const updateMutation = useMutation({
    mutationFn: (values: SettingsForm) =>
      updateRestaurant(restaurantId!, {
        name: values.name,
        slug: values.slug,
        address: values.address || null,
        phone: values.phone || null,
        email: values.email || null,
        timezone: values.timezone,
        currency: values.currency,
        taxName: values.taxName,
        taxRateBasisPoints: Math.round(Number(values.taxRate) * 100),
        pricesIncludeTax: values.pricesIncludeTax,
      }),
    onSuccess: (restaurant) => {
      queryClient.setQueryData(queryKey, restaurant);
      reset({
        name: restaurant.name,
        slug: restaurant.slug,
        address: restaurant.address ?? "",
        phone: restaurant.phone ?? "",
        email: restaurant.email ?? "",
        timezone: restaurant.timezone,
        currency: restaurant.currency,
        taxName: restaurant.taxName,
        taxRate: String(restaurant.taxRateBasisPoints / 100),
        pricesIncludeTax: restaurant.pricesIncludeTax,
      });
    },
  });

  useEffect(() => {
    const restaurant = restaurantQuery.data;
    if (!restaurant) return;
    reset({
      name: restaurant.name,
      slug: restaurant.slug,
      address: restaurant.address ?? "",
      phone: restaurant.phone ?? "",
      email: restaurant.email ?? "",
      timezone: restaurant.timezone,
      currency: restaurant.currency,
      taxName: restaurant.taxName,
      taxRate: String(restaurant.taxRateBasisPoints / 100),
      pricesIncludeTax: restaurant.pricesIncludeTax,
    });
  }, [reset, restaurantQuery.data]);

  const submit = handleSubmit(async (values) => {
    try {
      await updateMutation.mutateAsync(values);
    } catch (error) {
      setError("root", {
        message:
          error instanceof ApiError
            ? error.message
            : "Restaurant settings could not be saved.",
      });
    }
  });

  if (restaurantQuery.isPending) {
    return (
      <div className="grid min-h-80 place-items-center" aria-live="polite">
        <span className="text-muted-foreground inline-flex items-center gap-2 text-sm">
          <LoaderCircle className="size-4 animate-spin" /> Loading restaurant
          settings
        </span>
      </div>
    );
  }

  if (restaurantQuery.isError) {
    return (
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle>Settings unavailable</CardTitle>
          <p className="text-muted-foreground text-sm">
            RestroFlow could not load the restaurant profile.
          </p>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            onClick={() => void restaurantQuery.refetch()}
          >
            <RefreshCw className="size-4" /> Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-primary text-xs font-bold tracking-[.16em] uppercase">
            Restaurant configuration
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            Keep the restaurant identity, contact details, and tax defaults
            accurate.
          </p>
        </div>
        {!canEdit && (
          <span className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-900">
            Manager view · read only
          </span>
        )}
      </header>

      <form onSubmit={(event) => void submit(event)} noValidate>
        <fieldset
          disabled={!canEdit || updateMutation.isPending}
          className="space-y-6"
        >
          <Card>
            <CardHeader className="border-b">
              <div className="flex items-center gap-3">
                <span className="bg-accent text-accent-foreground grid size-10 place-items-center rounded-lg">
                  <Store className="size-5" />
                </span>
                <div>
                  <CardTitle>Restaurant profile</CardTitle>
                  <p className="text-muted-foreground text-sm">
                    Public identity and contact information.
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-5 pt-6 sm:grid-cols-2">
              <label className="space-y-2 text-sm font-semibold">
                Restaurant name
                <Input
                  {...register("name")}
                  aria-invalid={Boolean(errors.name)}
                />
                <FieldError message={errors.name?.message} />
              </label>
              <label className="space-y-2 text-sm font-semibold">
                Slug
                <Input
                  {...register("slug")}
                  aria-invalid={Boolean(errors.slug)}
                />
                <FieldError message={errors.slug?.message} />
              </label>
              <label className="space-y-2 text-sm font-semibold sm:col-span-2">
                Address
                <Textarea
                  {...register("address")}
                  aria-invalid={Boolean(errors.address)}
                />
                <FieldError message={errors.address?.message} />
              </label>
              <label className="space-y-2 text-sm font-semibold">
                Phone
                <Input
                  type="tel"
                  {...register("phone")}
                  aria-invalid={Boolean(errors.phone)}
                />
                <FieldError message={errors.phone?.message} />
              </label>
              <label className="space-y-2 text-sm font-semibold">
                Contact email
                <Input
                  type="email"
                  {...register("email")}
                  aria-invalid={Boolean(errors.email)}
                />
                <FieldError message={errors.email?.message} />
              </label>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle>Locale and tax</CardTitle>
              <p className="text-muted-foreground text-sm">
                Operational defaults used when future billing workflows are
                added.
              </p>
            </CardHeader>
            <CardContent className="grid gap-5 pt-6 sm:grid-cols-2">
              <label className="space-y-2 text-sm font-semibold">
                Timezone
                <Select {...register("timezone")}>
                  {timezones.map((timezone) => (
                    <option key={timezone}>{timezone}</option>
                  ))}
                </Select>
              </label>
              <label className="space-y-2 text-sm font-semibold">
                Currency
                <Select {...register("currency")}>
                  {currencies.map((currency) => (
                    <option key={currency}>{currency}</option>
                  ))}
                </Select>
              </label>
              <label className="space-y-2 text-sm font-semibold">
                Tax label
                <Input
                  {...register("taxName")}
                  aria-invalid={Boolean(errors.taxName)}
                />
                <FieldError message={errors.taxName?.message} />
              </label>
              <label className="space-y-2 text-sm font-semibold">
                Tax rate (%)
                <Input
                  inputMode="decimal"
                  {...register("taxRate")}
                  aria-invalid={Boolean(errors.taxRate)}
                />
                <FieldError message={errors.taxRate?.message} />
              </label>
              <label className="bg-muted/60 flex items-start gap-3 rounded-xl p-4 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  className="mt-1 size-4 accent-emerald-700"
                  {...register("pricesIncludeTax")}
                />
                <span>
                  <span className="block font-semibold">
                    Menu prices include tax
                  </span>
                  <span className="text-muted-foreground mt-1 block leading-5">
                    Treat displayed prices as tax-inclusive when order billing
                    is introduced.
                  </span>
                </span>
              </label>
            </CardContent>
          </Card>
        </fieldset>

        {errors.root?.message && (
          <p
            className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800"
            role="alert"
          >
            {errors.root.message}
          </p>
        )}
        {updateMutation.isSuccess && !isDirty && (
          <p
            className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-emerald-700"
            role="status"
          >
            <CheckCircle2 className="size-4" /> Settings saved
          </p>
        )}
        {canEdit && (
          <div className="mt-6 flex justify-end">
            <Button
              type="submit"
              disabled={!isDirty || updateMutation.isPending}
            >
              {updateMutation.isPending && (
                <LoaderCircle className="size-4 animate-spin" />
              )}
              {updateMutation.isPending ? "Saving…" : "Save settings"}
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}
