"use client";

import type {
  ActiveBillingSession,
  BillStatus,
  CreatePaymentRequest,
} from "@restroflow/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LoaderCircle,
  Printer,
  ReceiptText,
  RefreshCw,
  Search,
  XCircle,
} from "lucide-react";
import { useRef, useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ApiError } from "@/lib/auth-api";
import {
  fetchActiveBillingSessions,
  fetchBill,
  fetchBillPreview,
  fetchBills,
  finalizeBill,
  recordPayment,
} from "@/lib/billing-api";
import { formatMinorCurrency } from "@/lib/currency";
import { closeTableSession } from "@/lib/table-api";

import { BillItemList } from "./bill-item-list";
import { BillStatusBadge } from "./bill-status-badge";
import { PaymentForm } from "./payment-form";
import { ReceiptView } from "./receipt-view";
import { TaxBreakdown } from "./tax-breakdown";

function errorText(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function CashierDashboard() {
  const { user } = useAuth();
  const membership = user?.memberships[0];
  const restaurantId = membership?.restaurantId;
  const queryClient = useQueryClient();
  const [selectedSession, setSelectedSession] =
    useState<ActiveBillingSession | null>(null);
  const [selectedBillId, setSelectedBillId] = useState<string | null>(null);
  const [confirmFinalize, setConfirmFinalize] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [historySearch, setHistorySearch] = useState("");
  const [historyStatus, setHistoryStatus] = useState<BillStatus | "ALL">("ALL");
  const paymentKey = useRef<string | null>(null);

  const sessions = useQuery({
    queryKey: ["billing-sessions", restaurantId],
    queryFn: () => fetchActiveBillingSessions(restaurantId!),
    enabled: Boolean(restaurantId),
  });
  const preview = useQuery({
    queryKey: ["bill-preview", restaurantId, selectedSession?.tableSessionId],
    queryFn: () =>
      fetchBillPreview(restaurantId!, selectedSession!.tableSessionId),
    enabled: Boolean(
      restaurantId &&
      selectedSession &&
      !selectedSession.billId &&
      !selectedBillId,
    ),
  });
  const bill = useQuery({
    queryKey: ["bill", restaurantId, selectedBillId],
    queryFn: () => fetchBill(restaurantId!, selectedBillId!),
    enabled: Boolean(restaurantId && selectedBillId),
  });
  const history = useQuery({
    queryKey: ["bills", restaurantId, historySearch, historyStatus],
    queryFn: () =>
      fetchBills(restaurantId!, {
        page: 1,
        limit: 20,
        search: historySearch || undefined,
        status: historyStatus === "ALL" ? undefined : historyStatus,
      }),
    enabled: Boolean(restaurantId),
  });

  const invalidateBilling = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["billing-sessions"] }),
      queryClient.invalidateQueries({ queryKey: ["bill"] }),
      queryClient.invalidateQueries({ queryKey: ["bills"] }),
    ]);
  };

  const finalize = useMutation({
    mutationFn: () =>
      finalizeBill(restaurantId!, selectedSession!.tableSessionId),
    onSuccess: async (created) => {
      setConfirmFinalize(false);
      setSelectedBillId(created.id);
      setNotice(`Bill ${created.billNumber} finalized.`);
      await invalidateBilling();
    },
  });
  const payment = useMutation({
    mutationFn: ({
      key,
      input,
    }: {
      key: string;
      input: CreatePaymentRequest;
    }) => recordPayment(restaurantId!, selectedBillId!, key, input),
    onSuccess: async (result) => {
      paymentKey.current = null;
      setNotice(
        `${result.payment.method === "CASH" ? "Cash" : "UPI"} payment recorded manually.`,
      );
      queryClient.setQueryData(
        ["bill", restaurantId, selectedBillId],
        result.bill,
      );
      await invalidateBilling();
    },
  });
  const closeSession = useMutation({
    mutationFn: () =>
      closeTableSession(
        restaurantId!,
        (bill.data?.tableSessionId ?? selectedSession?.tableSessionId)!,
      ),
    onSuccess: async () => {
      setNotice("Paid table session closed.");
      setSelectedSession(null);
      setSelectedBillId(null);
      await invalidateBilling();
    },
  });

  const selectSession = (session: ActiveBillingSession) => {
    setSelectedSession(session);
    setSelectedBillId(session.billId);
    setNotice(null);
  };

  if (sessions.isPending) {
    return (
      <div className="grid min-h-80 place-items-center" aria-live="polite">
        <span className="text-muted-foreground inline-flex items-center gap-2 text-sm">
          <LoaderCircle className="size-4 animate-spin" /> Loading cashier
          workspace
        </span>
      </div>
    );
  }
  if (sessions.isError) {
    return (
      <Card className="mx-auto max-w-xl p-8 text-center" role="alert">
        <XCircle className="mx-auto size-9 text-red-700" />
        <h1 className="mt-4 text-xl font-bold">Billing is unavailable</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          {errorText(sessions.error, "Active tables could not be loaded.")}
        </p>
        <Button
          className="mt-5"
          variant="outline"
          onClick={() => void sessions.refetch()}
        >
          <RefreshCw className="size-4" /> Try again
        </Button>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-7">
      <header>
        <p className="text-primary text-xs font-bold tracking-[.16em] uppercase">
          Checkout
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          Cashier workspace
        </h1>
        <p className="text-muted-foreground mt-2 max-w-2xl">
          Finalize served orders, manually record cash or UPI receipts, and
          close fully paid tables.
        </p>
      </header>

      {notice && (
        <div
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"
          role="status"
        >
          {notice}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[330px_1fr]">
        <aside className="space-y-3" aria-labelledby="active-tables-title">
          <div className="flex items-center justify-between">
            <h2 id="active-tables-title" className="text-lg font-bold">
              Active tables
            </h2>
            <span className="text-muted-foreground text-sm">
              {sessions.data.length}
            </span>
          </div>
          {sessions.data.length === 0 ? (
            <Card className="text-muted-foreground p-6 text-center text-sm">
              No open table sessions.
            </Card>
          ) : (
            sessions.data.map((session) => (
              <button
                type="button"
                key={session.tableSessionId}
                onClick={() => selectSession(session)}
                className="focus-visible:ring-ring w-full rounded-xl border bg-white p-4 text-left shadow-sm transition hover:border-emerald-300 focus-visible:ring-2 focus-visible:outline-none"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <strong>{session.table.displayName}</strong>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {session.orderCount} order
                      {session.orderCount === 1 ? "" : "s"}
                      {session.unresolvedOrderCount > 0 &&
                        ` · ${session.unresolvedOrderCount} unresolved`}
                    </p>
                  </div>
                  <BillStatusBadge status={session.billingStatus} />
                </div>
                {session.outstandingMinor !== null && (
                  <p className="mt-3 text-sm font-bold tabular-nums">
                    Due{" "}
                    {formatMinorCurrency(
                      session.outstandingMinor,
                      session.currency,
                    )}
                  </p>
                )}
              </button>
            ))
          )}
        </aside>

        <main>
          {!selectedSession && !selectedBillId ? (
            <Card className="grid min-h-72 place-items-center p-8 text-center">
              <div>
                <ReceiptText className="text-primary mx-auto size-10" />
                <h2 className="mt-4 text-xl font-bold">Select a table</h2>
                <p className="text-muted-foreground mt-2 text-sm">
                  Review a live check or open a historical receipt below.
                </p>
              </div>
            </Card>
          ) : selectedBillId ? (
            bill.isPending ? (
              <Card className="grid min-h-72 place-items-center p-8">
                <LoaderCircle
                  className="size-5 animate-spin"
                  aria-label="Loading bill"
                />
              </Card>
            ) : bill.isError || !bill.data ? (
              <Card className="p-8 text-center text-red-800" role="alert">
                {errorText(bill.error, "The bill could not be loaded.")}
              </Card>
            ) : (
              <BillDetail
                bill={bill.data}
                canClose={Boolean(selectedSession)}
                paymentPending={payment.isPending}
                paymentError={
                  payment.isError
                    ? errorText(payment.error, "Payment could not be recorded.")
                    : null
                }
                closePending={closeSession.isPending}
                closeError={
                  closeSession.isError
                    ? errorText(
                        closeSession.error,
                        "The table could not be closed.",
                      )
                    : null
                }
                onClose={() => closeSession.mutate()}
                onPayment={async (input) => {
                  paymentKey.current ??= crypto.randomUUID();
                  try {
                    await payment.mutateAsync({
                      key: paymentKey.current,
                      input,
                    });
                  } catch (error) {
                    if (error instanceof ApiError && error.status < 500)
                      paymentKey.current = null;
                    throw error;
                  }
                }}
              />
            )
          ) : preview.isPending ? (
            <Card className="grid min-h-72 place-items-center p-8">
              <LoaderCircle
                className="size-5 animate-spin"
                aria-label="Calculating bill"
              />
            </Card>
          ) : preview.isError || !preview.data ? (
            <Card className="p-8 text-center" role="alert">
              <XCircle className="mx-auto size-8 text-red-700" />
              <p className="mt-3 text-sm text-red-800">
                {errorText(
                  preview.error,
                  "The bill preview could not be calculated.",
                )}
              </p>
            </Card>
          ) : (
            <Card className="p-5 sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-4">
                <div>
                  <p className="text-primary text-xs font-bold tracking-[.16em] uppercase">
                    Live preview
                  </p>
                  <h2 className="mt-1 text-2xl font-bold">
                    {preview.data.table.displayName}
                  </h2>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Calculated from immutable served-order snapshots.
                  </p>
                </div>
                <BillStatusBadge status="UNBILLED" />
              </div>
              <BillItemList
                items={preview.data.items}
                currency={preview.data.currency}
              />
              <TaxBreakdown {...preview.data} />
              {preview.data.blockingOrderCount > 0 && (
                <p
                  className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900"
                  role="status"
                >
                  Resolve {preview.data.blockingOrderCount} active order
                  {preview.data.blockingOrderCount === 1 ? "" : "s"} before
                  finalizing.
                </p>
              )}
              {finalize.isError && (
                <p
                  className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800"
                  role="alert"
                >
                  {errorText(
                    finalize.error,
                    "The bill could not be finalized.",
                  )}
                </p>
              )}
              <Button
                className="mt-5 w-full"
                disabled={!preview.data.canFinalize}
                onClick={() => setConfirmFinalize(true)}
              >
                Finalize immutable bill
              </Button>
            </Card>
          )}
        </main>
      </div>

      <BillHistory
        query={history}
        search={historySearch}
        status={historyStatus}
        onSearch={setHistorySearch}
        onStatus={setHistoryStatus}
        onSelect={(billId) => {
          setSelectedSession(null);
          setSelectedBillId(billId);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      />

      <Dialog
        open={confirmFinalize}
        onClose={() => setConfirmFinalize(false)}
        title="Finalize this bill?"
        description="Item prices, tax settings, and totals become immutable after finalization."
      >
        <div className="space-y-5 p-5 sm:p-6">
          <p className="text-sm">
            Confirm that all orders for{" "}
            <strong>{selectedSession?.table.displayName}</strong> are complete
            and ready to bill.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmFinalize(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => finalize.mutate()}
              disabled={finalize.isPending}
            >
              {finalize.isPending && (
                <LoaderCircle className="size-4 animate-spin" />
              )}
              Finalize bill
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

function BillDetail({
  bill,
  canClose,
  paymentPending,
  paymentError,
  closePending,
  closeError,
  onPayment,
  onClose,
}: {
  bill: Awaited<ReturnType<typeof fetchBill>>;
  canClose: boolean;
  paymentPending: boolean;
  paymentError: string | null;
  closePending: boolean;
  closeError: string | null;
  onPayment: (input: CreatePaymentRequest) => Promise<void>;
  onClose: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-end gap-2 print:hidden">
        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="size-4" /> Print receipt
        </Button>
        {bill.status === "PAID" && canClose && (
          <Button onClick={onClose} disabled={closePending}>
            {closePending && <LoaderCircle className="size-4 animate-spin" />}
            Close table
          </Button>
        )}
      </div>
      <ReceiptView bill={bill} />
      {bill.outstandingMinor > 0 && (
        <PaymentForm
          key={`${bill.id}-${bill.outstandingMinor}`}
          outstandingMinor={bill.outstandingMinor}
          currency={bill.currency}
          isSubmitting={paymentPending}
          error={paymentError}
          onSubmit={onPayment}
        />
      )}
      {closeError && (
        <p
          className="rounded-lg bg-red-50 p-3 text-sm text-red-800"
          role="alert"
        >
          {closeError}
        </p>
      )}
    </div>
  );
}

type HistoryQuery = ReturnType<
  typeof useQuery<Awaited<ReturnType<typeof fetchBills>>>
>;

function BillHistory({
  query,
  search,
  status,
  onSearch,
  onStatus,
  onSelect,
}: {
  query: HistoryQuery;
  search: string;
  status: BillStatus | "ALL";
  onSearch: (value: string) => void;
  onStatus: (value: BillStatus | "ALL") => void;
  onSelect: (billId: string) => void;
}) {
  return (
    <section className="space-y-4" aria-labelledby="history-title">
      <div>
        <h2 id="history-title" className="text-xl font-bold">
          Bill history
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Search historical receipts and recorded payments.
        </p>
      </div>
      <div className="grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-[1fr_220px]">
        <label className="relative">
          <span className="sr-only">Search bill history</span>
          <Search className="text-muted-foreground absolute top-3.5 left-3 size-4" />
          <Input
            className="pl-9"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Bill or table"
          />
        </label>
        <Select
          value={status}
          onChange={(event) =>
            onStatus(event.target.value as BillStatus | "ALL")
          }
          aria-label="Filter bill status"
        >
          <option value="ALL">All statuses</option>
          <option value="FINALIZED">Payment due</option>
          <option value="PARTIALLY_PAID">Partially paid</option>
          <option value="PAID">Paid</option>
        </Select>
      </div>
      {query.isPending ? (
        <p className="text-muted-foreground text-sm">Loading history…</p>
      ) : query.isError ? (
        <p className="text-sm text-red-800" role="alert">
          Bill history could not be loaded.
        </p>
      ) : query.data?.bills.length === 0 ? (
        <Card className="text-muted-foreground p-8 text-center text-sm">
          No bills match this view.
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {query.data?.bills.map((bill) => (
            <button
              type="button"
              key={bill.id}
              className="rounded-xl border bg-white p-4 text-left shadow-sm hover:border-emerald-300"
              onClick={() => onSelect(bill.id)}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <strong>{bill.billNumber}</strong>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {bill.table.displayName}
                  </p>
                </div>
                <BillStatusBadge status={bill.status} />
              </div>
              <p className="mt-3 font-bold tabular-nums">
                {formatMinorCurrency(bill.totalMinor, bill.currency)}
              </p>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
