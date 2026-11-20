"use client";

import type {
  AnalyticsGranularity,
  AnalyticsRangeQuery,
} from "@restroflow/contracts";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Clock3,
  CreditCard,
  IndianRupee,
  RefreshCw,
  ReceiptText,
  ShoppingBag,
  Utensils,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  fetchAnalyticsOverview,
  fetchKitchenAnalytics,
  fetchOrderAnalytics,
  fetchPaymentAnalytics,
  fetchPopularItemsAnalytics,
  fetchSalesAnalytics,
  fetchTableAnalytics,
} from "@/lib/analytics-api";
import { formatMinorCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";

const chartColors = ["#047857", "#d97706"];

function localDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function initialRange(): AnalyticsRangeQuery {
  const end = new Date();
  end.setDate(end.getDate() + 1);
  const start = new Date();
  start.setDate(start.getDate() - 29);
  return {
    startDate: localDate(start),
    endDate: localDate(end),
    granularity: "day",
  };
}

function chartMoney(value: string): number | null {
  const amount = BigInt(value);
  return amount <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(amount) : null;
}

export function analyticsDateLabel(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function Comparison({ value }: { value: number | null }) {
  if (value === null)
    return <span className="text-muted-foreground">No prior baseline</span>;
  return (
    <span className={value >= 0 ? "text-emerald-700" : "text-rose-700"}>
      {value >= 0 ? "+" : ""}
      {value.toFixed(2)}% vs prior period
    </span>
  );
}

function KpiCard({
  label,
  value,
  note,
  icon: Icon,
}: {
  label: string;
  value: string;
  note: ReactNode;
  icon: typeof IndianRupee;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-muted-foreground text-sm font-medium">{label}</p>
            <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
          </div>
          <span className="bg-accent text-accent-foreground grid size-10 place-items-center rounded-xl">
            <Icon className="size-5" aria-hidden="true" />
          </span>
        </div>
        <p className="mt-3 text-xs leading-5">{note}</p>
      </CardContent>
    </Card>
  );
}

function LoadingCard() {
  return (
    <Card aria-label="Loading analytics metric">
      <CardContent className="p-5">
        <div className="bg-muted h-4 w-24 animate-pulse rounded" />
        <div className="bg-muted mt-4 h-8 w-36 animate-pulse rounded" />
        <div className="bg-muted mt-4 h-3 w-28 animate-pulse rounded" />
      </CardContent>
    </Card>
  );
}

function PanelMessage({
  title,
  detail,
  error = false,
}: {
  title: string;
  detail: string;
  error?: boolean;
}) {
  return (
    <div
      className={cn(
        "grid min-h-64 place-items-center rounded-lg border border-dashed p-6 text-center",
        error && "border-rose-300 bg-rose-50",
      )}
      role={error ? "alert" : undefined}
    >
      <div>
        <p className="font-semibold">{title}</p>
        <p className="text-muted-foreground mt-1 max-w-sm text-sm leading-6">
          {detail}
        </p>
      </div>
    </div>
  );
}

function ChartCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <p className="text-muted-foreground text-sm leading-6">{description}</p>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function AnalyticsDashboard() {
  const { user } = useAuth();
  const membership = user?.memberships.find((item) =>
    ["ADMIN", "MANAGER"].includes(item.role),
  );
  const restaurantId = membership?.restaurantId ?? "";
  const [filters, setFilters] = useState<AnalyticsRangeQuery>(initialRange);
  const validRange = filters.startDate < filters.endDate;
  const query = useMemo(
    () => ({
      startDate: filters.startDate,
      endDate: filters.endDate,
      granularity: filters.granularity,
    }),
    [filters.endDate, filters.granularity, filters.startDate],
  );
  const enabled = Boolean(restaurantId && validRange);
  const key = [restaurantId, query] as const;

  const overview = useQuery({
    queryKey: ["analytics", "overview", ...key],
    queryFn: () => fetchAnalyticsOverview(restaurantId, query),
    enabled,
  });
  const sales = useQuery({
    queryKey: ["analytics", "sales", ...key],
    queryFn: () => fetchSalesAnalytics(restaurantId, query),
    enabled,
  });
  const payments = useQuery({
    queryKey: ["analytics", "payments", ...key],
    queryFn: () => fetchPaymentAnalytics(restaurantId, query),
    enabled,
  });
  const popularItems = useQuery({
    queryKey: ["analytics", "popular-items", ...key],
    queryFn: () => fetchPopularItemsAnalytics(restaurantId, query),
    enabled,
  });
  const orders = useQuery({
    queryKey: ["analytics", "orders", ...key],
    queryFn: () => fetchOrderAnalytics(restaurantId, query),
    enabled,
  });
  const tables = useQuery({
    queryKey: ["analytics", "tables", ...key],
    queryFn: () => fetchTableAnalytics(restaurantId, query),
    enabled,
  });
  const kitchen = useQuery({
    queryKey: ["analytics", "kitchen", ...key],
    queryFn: () => fetchKitchenAnalytics(restaurantId, query),
    enabled,
  });
  const requests = [
    overview,
    sales,
    payments,
    popularItems,
    orders,
    tables,
    kitchen,
  ];
  const isRefreshing = requests.some((request) => request.isFetching);
  const currency = overview.data?.context.currency ?? "INR";
  const salesData = sales.data?.points.map((point) => ({
    period: point.period,
    label: analyticsDateLabel(point.period),
    value: chartMoney(point.amountMinor),
  }));
  const paymentData = payments.data?.methods.map((method) => ({
    name: method.method === "UPI" ? "UPI (manual)" : "Cash",
    value: chartMoney(method.amountMinor),
    exact: method.amountMinor,
  }));
  const paymentTrendData = payments.data?.points.map((point) => ({
    period: point.period,
    label: analyticsDateLabel(point.period),
    value: chartMoney(point.amountMinor),
  }));
  const orderData = orders.data?.points.map((point) => ({
    period: point.period,
    label: analyticsDateLabel(point.period),
    value: point.created,
  }));
  const popularData = popularItems.data?.items.map((item) => ({
    name: item.itemName,
    value: item.quantitySold,
  }));
  const unsafeChartMoney =
    salesData?.some((point) => point.value === null) ||
    paymentData?.some((point) => point.value === null) ||
    paymentTrendData?.some((point) => point.value === null);

  async function refresh() {
    await Promise.all(requests.map((request) => request.refetch()));
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-7">
      <header className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-primary text-sm font-bold tracking-[.14em] uppercase">
            Restaurant intelligence
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Analytics dashboard
          </h1>
          <p className="text-muted-foreground mt-2 max-w-3xl text-sm leading-6 sm:text-base">
            Finalized sales, recorded payments, order activity, tables, and
            kitchen performance from persisted restaurant data.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => void refresh()}
          disabled={!enabled || isRefreshing}
        >
          <RefreshCw
            className={cn("size-4", isRefreshing && "animate-spin")}
            aria-hidden="true"
          />
          Refresh
        </Button>
      </header>

      <Card>
        <CardContent className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_12rem_auto] xl:items-end">
          <label className="grid gap-2 text-sm font-semibold">
            Start date
            <Input
              type="date"
              value={filters.startDate}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  startDate: event.target.value,
                }))
              }
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            End date (exclusive)
            <Input
              type="date"
              value={filters.endDate}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  endDate: event.target.value,
                }))
              }
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            Group by
            <Select
              value={filters.granularity}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  granularity: event.target.value as AnalyticsGranularity,
                }))
              }
            >
              <option value="day">Day</option>
              <option value="week">Week</option>
              <option value="month">Month</option>
            </Select>
          </label>
          <p className="text-muted-foreground text-xs leading-5 xl:max-w-60">
            {overview.data
              ? `Business dates use ${overview.data.context.timezone}.`
              : "Dates are interpreted in the restaurant timezone."}
          </p>
          {!validRange && (
            <p
              className="text-sm text-rose-700 sm:col-span-2 xl:col-span-4"
              role="alert"
            >
              End date must be after start date.
            </p>
          )}
        </CardContent>
      </Card>

      <section aria-labelledby="summary-heading">
        <h2 id="summary-heading" className="sr-only">
          Summary metrics
        </h2>
        {overview.isPending ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 8 }, (_, index) => (
              <LoadingCard key={index} />
            ))}
          </div>
        ) : overview.isError ? (
          <PanelMessage
            error
            title="Summary unavailable"
            detail="RestroFlow could not load the analytics summary. Refresh to try again."
          />
        ) : overview.data ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Finalized sales"
              value={formatMinorCurrency(
                overview.data.finalizedSales.value,
                currency,
              )}
              note={
                <Comparison
                  value={overview.data.finalizedSales.changePercent}
                />
              }
              icon={IndianRupee}
            />
            <KpiCard
              label="Recorded payments"
              value={formatMinorCurrency(
                overview.data.recordedPayments.value,
                currency,
              )}
              note={
                <Comparison
                  value={overview.data.recordedPayments.changePercent}
                />
              }
              icon={CreditCard}
            />
            <KpiCard
              label="Current outstanding"
              value={formatMinorCurrency(
                overview.data.currentOutstandingMinor,
                currency,
              )}
              note={`${formatMinorCurrency(overview.data.periodOutstandingMinor, currency)} from bills finalized in this period`}
              icon={ReceiptText}
            />
            <KpiCard
              label="Finalized bills"
              value={overview.data.finalizedBillCount.value.toLocaleString()}
              note={
                <Comparison
                  value={overview.data.finalizedBillCount.changePercent}
                />
              }
              icon={ReceiptText}
            />
            <KpiCard
              label="Completed orders"
              value={overview.data.completedOrderCount.value.toLocaleString()}
              note={
                <Comparison
                  value={overview.data.completedOrderCount.changePercent}
                />
              }
              icon={ShoppingBag}
            />
            <KpiCard
              label="Average bill value"
              value={formatMinorCurrency(
                overview.data.averageBillValueMinor,
                currency,
              )}
              note="Rounded to nearest minor unit across finalized bills"
              icon={BarChart3}
            />
            <KpiCard
              label="Active table sessions"
              value={overview.data.activeTableSessions.toLocaleString()}
              note="Current open sessions; not period-limited"
              icon={Utensils}
            />
            <KpiCard
              label="Active kitchen orders"
              value={overview.data.activeKitchenOrders.toLocaleString()}
              note="Pending through ready; current operational state"
              icon={Clock3}
            />
          </div>
        ) : null}
      </section>

      {unsafeChartMoney && (
        <div
          className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"
          role="status"
        >
          One or more monetary aggregates exceed the exact JavaScript charting
          range. Exact KPI values remain available, but affected charts are
          withheld to avoid precision loss.
        </div>
      )}

      <section
        className="grid gap-5 xl:grid-cols-2"
        aria-label="Analytics charts"
      >
        <ChartCard
          title="Finalized sales trend"
          description="Immutable bill totals grouped by bill finalization time."
        >
          {sales.isError ? (
            <PanelMessage
              error
              title="Sales trend unavailable"
              detail="Refresh to retry this report."
            />
          ) : sales.isPending ? (
            <PanelMessage
              title="Loading sales trend"
              detail="Aggregating finalized bills…"
            />
          ) : !salesData?.length ? (
            <PanelMessage
              title="No finalized bills"
              detail="There are no finalized bill totals in this period."
            />
          ) : salesData.some((point) => point.value === null) ? (
            <PanelMessage
              title="Chart range exceeded"
              detail="Exact values are too large to chart without precision loss."
            />
          ) : (
            <div className="h-72" aria-label="Finalized sales trend chart">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={salesData} margin={{ left: 8, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} fontSize={12} />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={72}
                    fontSize={12}
                    tickFormatter={(value: number) =>
                      formatMinorCurrency(value, currency)
                    }
                  />
                  <Tooltip
                    formatter={(value) =>
                      formatMinorCurrency(String(value), currency)
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    name="Finalized sales"
                    stroke="#047857"
                    strokeWidth={3}
                    dot={false}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard
          title="Recorded payment methods"
          description="Cash and manually recorded UPI payments by recording time."
        >
          {payments.isError ? (
            <PanelMessage
              error
              title="Payments unavailable"
              detail="Refresh to retry this report."
            />
          ) : payments.isPending ? (
            <PanelMessage
              title="Loading payments"
              detail="Aggregating payment records…"
            />
          ) : !paymentData?.length ? (
            <PanelMessage
              title="No recorded payments"
              detail="No cash or UPI payments were recorded in this period."
            />
          ) : paymentData.some((point) => point.value === null) ? (
            <PanelMessage
              title="Chart range exceeded"
              detail="Exact values are too large to chart without precision loss."
            />
          ) : (
            <div className="grid items-center gap-4 sm:grid-cols-2">
              <div
                className="h-64"
                aria-label="Payment method distribution chart"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={paymentData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={52}
                      outerRadius={86}
                      paddingAngle={3}
                    >
                      {paymentData.map((entry, index) => (
                        <Cell
                          key={entry.name}
                          fill={chartColors[index % chartColors.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) =>
                        formatMinorCurrency(String(value), currency)
                      }
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <dl className="space-y-3">
                {paymentData.map((entry, index) => (
                  <div
                    key={entry.name}
                    className="flex items-center justify-between gap-4 rounded-lg border p-3"
                  >
                    <dt className="flex items-center gap-2 text-sm font-medium">
                      <span
                        className="size-2.5 rounded-full"
                        style={{
                          backgroundColor:
                            chartColors[index % chartColors.length],
                        }}
                      />
                      {entry.name}
                    </dt>
                    <dd className="text-sm font-bold">
                      {formatMinorCurrency(entry.exact, currency)}
                    </dd>
                  </div>
                ))}
                <div className="bg-muted/60 rounded-lg p-3">
                  <dt className="text-muted-foreground text-sm">
                    Partially paid bills now
                  </dt>
                  <dd className="mt-1 text-lg font-bold">
                    {payments.data?.partiallyPaidBillCount ?? 0}
                  </dd>
                </div>
              </dl>
            </div>
          )}
        </ChartCard>

        <ChartCard
          title="Recorded payments over time"
          description="Payment records grouped by their own recording timestamp, independently of bill finalization."
        >
          {payments.isError ? (
            <PanelMessage
              error
              title="Payment trend unavailable"
              detail="Refresh to retry this report."
            />
          ) : payments.isPending ? (
            <PanelMessage
              title="Loading payment trend"
              detail="Aggregating recorded payments…"
            />
          ) : !paymentTrendData?.some(
              (point) => point.value !== null && point.value > 0,
            ) ? (
            <PanelMessage
              title="No recorded payments"
              detail="No cash or UPI payments were recorded in this period."
            />
          ) : paymentTrendData.some((point) => point.value === null) ? (
            <PanelMessage
              title="Chart range exceeded"
              detail="Exact values are too large to chart without precision loss."
            />
          ) : (
            <div className="h-72" aria-label="Recorded payments trend chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={paymentTrendData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} fontSize={12} />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={72}
                    fontSize={12}
                    tickFormatter={(value: number) =>
                      formatMinorCurrency(value, currency)
                    }
                  />
                  <Tooltip
                    formatter={(value) =>
                      formatMinorCurrency(String(value), currency)
                    }
                  />
                  <Bar
                    dataKey="value"
                    name="Recorded payments"
                    fill="#d97706"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard
          title="Order volume"
          description="Submitted orders grouped by Order.createdAt; add-item batches do not create orders."
        >
          {orders.isError ? (
            <PanelMessage
              error
              title="Order volume unavailable"
              detail="Refresh to retry this report."
            />
          ) : orders.isPending ? (
            <PanelMessage
              title="Loading order volume"
              detail="Aggregating submitted orders…"
            />
          ) : !orderData?.some((point) => point.value > 0) ? (
            <PanelMessage
              title="No submitted orders"
              detail="No waiter or customer orders were submitted in this period."
            />
          ) : (
            <div className="h-72" aria-label="Order volume chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={orderData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} fontSize={12} />
                  <YAxis
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    width={36}
                  />
                  <Tooltip />
                  <Bar
                    dataKey="value"
                    name="Orders created"
                    fill="#047857"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard
          title="Popular dishes"
          description="Quantity from finalized bill-item snapshots, ranked by menu-item identity."
        >
          {popularItems.isError ? (
            <PanelMessage
              error
              title="Popular items unavailable"
              detail="Refresh to retry this report."
            />
          ) : popularItems.isPending ? (
            <PanelMessage
              title="Loading popular items"
              detail="Ranking finalized bill items…"
            />
          ) : !popularData?.length ? (
            <PanelMessage
              title="No billed items"
              detail="No finalized bill items are available in this period."
            />
          ) : (
            <div className="space-y-4">
              {popularItems.data?.items.map((item, index) => (
                <div
                  key={item.menuItemId}
                  className="grid grid-cols-[1.5rem_1fr_auto] items-center gap-3"
                >
                  <span className="text-muted-foreground text-sm font-bold">
                    {index + 1}
                  </span>
                  <div>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-semibold">{item.itemName}</span>
                      <span>{item.quantitySold} sold</span>
                    </div>
                    <div className="bg-muted mt-2 h-2 overflow-hidden rounded-full">
                      <div
                        className="bg-primary h-full rounded-full"
                        style={{ width: `${item.popularityPercent}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-sm font-bold">
                    {formatMinorCurrency(item.salesContributionMinor, currency)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </ChartCard>
      </section>

      <section
        className="grid gap-5 xl:grid-cols-3"
        aria-label="Operational analytics"
      >
        <ChartCard
          title="Order outcomes"
          description="Served, cancelled, and rejected counts use their status-transition timestamps."
        >
          {orders.data ? (
            <dl className="grid grid-cols-2 gap-3">
              {[
                ["Created", orders.data.ordersCreated],
                ["Served", orders.data.ordersServed],
                ["Cancelled", orders.data.ordersCancelled],
                ["Rejected", orders.data.ordersRejected],
                ["Waiter source", orders.data.sourceBreakdown.waiter],
                ["Customer source", orders.data.sourceBreakdown.customer],
              ].map(([label, value]) => (
                <div key={String(label)} className="bg-muted/60 rounded-lg p-3">
                  <dt className="text-muted-foreground text-sm">{label}</dt>
                  <dd className="mt-1 text-xl font-bold">{value}</dd>
                </div>
              ))}
              <div className="col-span-2 rounded-lg border p-3">
                <dt className="text-muted-foreground text-sm">
                  Peak ordering hour
                </dt>
                <dd className="mt-1 font-bold">
                  {orders.data.peakOrderingHour === null
                    ? "Insufficient data"
                    : `${String(orders.data.peakOrderingHour).padStart(2, "0")}:00–${String((orders.data.peakOrderingHour + 1) % 24).padStart(2, "0")}:00 local`}
                </dd>
              </div>
            </dl>
          ) : (
            <PanelMessage
              title="Order outcomes unavailable"
              detail="This panel will appear when the report loads."
            />
          )}
        </ChartCard>

        <ChartCard
          title="Table usage"
          description="Completed-session frequency and duration; no inferred occupancy percentage."
        >
          {tables.data ? (
            <div className="space-y-4">
              <dl className="grid grid-cols-2 gap-3">
                <div className="bg-muted/60 rounded-lg p-3">
                  <dt className="text-muted-foreground text-sm">
                    Occupied now
                  </dt>
                  <dd className="mt-1 text-xl font-bold">
                    {tables.data.currentlyOccupiedTables}
                  </dd>
                </div>
                <div className="bg-muted/60 rounded-lg p-3">
                  <dt className="text-muted-foreground text-sm">
                    Available now
                  </dt>
                  <dd className="mt-1 text-xl font-bold">
                    {tables.data.availableTables}
                  </dd>
                </div>
                <div className="bg-muted/60 rounded-lg p-3">
                  <dt className="text-muted-foreground text-sm">
                    Completed sessions
                  </dt>
                  <dd className="mt-1 text-xl font-bold">
                    {tables.data.completedSessions}
                  </dd>
                </div>
                <div className="bg-muted/60 rounded-lg p-3">
                  <dt className="text-muted-foreground text-sm">
                    Avg. duration
                  </dt>
                  <dd className="mt-1 text-xl font-bold">
                    {tables.data.averageOccupiedDurationMinutes === null
                      ? "—"
                      : `${tables.data.averageOccupiedDurationMinutes} min`}
                  </dd>
                </div>
              </dl>
              <div>
                <h3 className="text-sm font-semibold">Most used tables</h3>
                <ul className="mt-2 space-y-2">
                  {tables.data.usage.slice(0, 5).map((item) => (
                    <li
                      key={item.tableId}
                      className="flex justify-between gap-3 text-sm"
                    >
                      <span>{item.displayName}</span>
                      <span className="font-semibold">
                        {item.completedSessions} sessions
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <PanelMessage
              title="Table analytics unavailable"
              detail="This panel will appear when the report loads."
            />
          )}
        </ChartCard>

        <ChartCard
          title="Kitchen performance"
          description="Valid item-level submitted → preparing → ready transitions only."
        >
          {kitchen.data ? (
            <dl className="space-y-3">
              {[
                ["Orders preparing", kitchen.data.activePreparingOrders],
                ["Ready for serving", kitchen.data.readyForServingOrders],
                [
                  "Avg. queue to preparing",
                  kitchen.data.averageQueueToPreparingMinutes === null
                    ? "Insufficient data"
                    : `${kitchen.data.averageQueueToPreparingMinutes} min`,
                ],
                [
                  "Avg. preparation",
                  kitchen.data.averagePreparationMinutes === null
                    ? "Insufficient data"
                    : `${kitchen.data.averagePreparationMinutes} min`,
                ],
                [
                  "Avg. submitted to ready",
                  kitchen.data.averageTotalToReadyMinutes === null
                    ? "Insufficient data"
                    : `${kitchen.data.averageTotalToReadyMinutes} min`,
                ],
                ["Completed item samples", kitchen.data.completedItemSamples],
              ].map(([label, value]) => (
                <div
                  key={String(label)}
                  className="flex items-center justify-between gap-4 rounded-lg border p-3"
                >
                  <dt className="text-muted-foreground text-sm">{label}</dt>
                  <dd className="text-right text-sm font-bold">{value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <PanelMessage
              title="Kitchen analytics unavailable"
              detail="This panel will appear when the report loads."
            />
          )}
        </ChartCard>
      </section>

      <p className="text-muted-foreground text-xs leading-5">
        Current outstanding is the present unpaid balance across all finalized
        and partially paid bills. Period outstanding includes only bills
        finalized in the selected range. UPI values represent staff-recorded
        receipts, not provider settlements.
      </p>
    </div>
  );
}
