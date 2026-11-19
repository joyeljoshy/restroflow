"use client";

import type {
  CreateTableRequest,
  RestaurantTable,
} from "@restroflow/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  Clock3,
  History,
  LoaderCircle,
  Pencil,
  Plus,
  Printer,
  QrCode,
  RefreshCw,
  Search,
  XCircle,
} from "lucide-react";
import { useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { TableCard } from "@/components/tables/table-card";
import { TableForm } from "@/components/tables/table-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ApiError } from "@/lib/auth-api";
import {
  closeTableSession,
  createTable,
  deactivateTable,
  fetchTableQrCode,
  fetchTableSessions,
  fetchTables,
  openTableSession,
  rotateTableQrCode,
  updateTable,
} from "@/lib/table-api";

type Confirmation = {
  kind: "open" | "close" | "deactivate" | "state";
  table: RestaurantTable;
};

function errorText(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

export function TableDashboard({
  workspace,
}: {
  workspace: "admin" | "waiter";
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const membership = user?.memberships.find((candidate) =>
    workspace === "admin"
      ? candidate.role === "ADMIN" || candidate.role === "MANAGER"
      : ["ADMIN", "MANAGER", "WAITER"].includes(candidate.role),
  );
  const restaurantId = membership?.restaurantId;
  const canConfigure = workspace === "admin" && membership?.role === "ADMIN";
  const canChangeState =
    workspace === "admin" &&
    (membership?.role === "ADMIN" || membership?.role === "MANAGER");
  const [search, setSearch] = useState("");
  const [occupancy, setOccupancy] = useState<
    "all" | "available" | "occupied" | "out_of_service"
  >("all");
  const [editor, setEditor] = useState<RestaurantTable | "new" | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [historyTable, setHistoryTable] = useState<RestaurantTable | null>(
    null,
  );
  const [qrTable, setQrTable] = useState<RestaurantTable | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const tables = useQuery({
    queryKey: ["tables", restaurantId, search, occupancy],
    queryFn: () => fetchTables(restaurantId!, { search, occupancy }),
    enabled: Boolean(restaurantId),
  });
  const history = useQuery({
    queryKey: ["table-sessions", restaurantId, historyTable?.id],
    queryFn: () => fetchTableSessions(restaurantId!, historyTable!.id),
    enabled: Boolean(restaurantId && historyTable),
  });
  const qrCode = useQuery({
    queryKey: ["table-qr", restaurantId, qrTable?.id],
    queryFn: () => fetchTableQrCode(restaurantId!, qrTable!.id),
    enabled: Boolean(restaurantId && qrTable && canConfigure),
  });

  const refreshTables = async () => {
    await queryClient.invalidateQueries({ queryKey: ["tables", restaurantId] });
  };

  const saveTable = useMutation({
    mutationFn: async (input: CreateTableRequest) => {
      if (editor === "new") return createTable(restaurantId!, input);
      if (editor) return updateTable(restaurantId!, editor.id, input);
      throw new Error("No table selected.");
    },
    onSuccess: async () => {
      setEditor(null);
      setNotice("Table details saved.");
      await refreshTables();
    },
  });
  const action = useMutation({
    mutationFn: async (target: Confirmation) => {
      if (target.kind === "open")
        return openTableSession(restaurantId!, target.table.id);
      if (target.kind === "close")
        return closeTableSession(restaurantId!, target.table.activeSession!.id);
      if (target.kind === "deactivate")
        return canConfigure
          ? deactivateTable(restaurantId!, target.table.id)
          : updateTable(restaurantId!, target.table.id, { isActive: false });
      return updateTable(restaurantId!, target.table.id, {
        isActive: !target.table.isActive,
      });
    },
    onSuccess: async (_result, target) => {
      setConfirmation(null);
      setNotice(
        target.kind === "open"
          ? "Table session opened."
          : target.kind === "close"
            ? "Table session closed."
            : target.table.isActive
              ? "Table is now out of service."
              : "Table is back in service.",
      );
      await refreshTables();
      await queryClient.invalidateQueries({ queryKey: ["table-sessions"] });
    },
  });
  const rotateQr = useMutation({
    mutationFn: () => rotateTableQrCode(restaurantId!, qrTable!.id),
    onSuccess: (code) => {
      queryClient.setQueryData(["table-qr", restaurantId, qrTable?.id], code);
      setNotice(
        "QR code rotated. Previous codes no longer identify this table.",
      );
    },
  });

  const downloadQr = () => {
    if (!qrCode.data) return;
    const url = URL.createObjectURL(
      new Blob([qrCode.data.svg], { type: "image/svg+xml" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = qrCode.data.fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const printQr = () => {
    if (!qrCode.data || !qrTable) return;
    const printWindow = window.open("", "_blank", "noopener,noreferrer");
    if (!printWindow) return;
    const heading = printWindow.document.createElement("h1");
    heading.textContent = qrTable.displayName;
    const qr = printWindow.document.createElement("div");
    qr.innerHTML = qrCode.data.svg;
    printWindow.document.body.append(heading, qr);
    printWindow.document.body.style.cssText =
      "font-family:sans-serif;text-align:center;padding:32px";
    printWindow.print();
  };

  if (tables.isPending) {
    return (
      <div className="grid min-h-80 place-items-center" aria-live="polite">
        <span className="text-muted-foreground inline-flex items-center gap-2 text-sm">
          <LoaderCircle className="size-4 animate-spin" /> Loading tables
        </span>
      </div>
    );
  }
  if (tables.isError) {
    return (
      <Card className="mx-auto max-w-xl p-7 text-center" role="alert">
        <XCircle className="mx-auto size-9 text-red-700" />
        <h1 className="mt-4 text-xl font-bold">Tables unavailable</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          RestroFlow could not load the restaurant floor.
        </p>
        <Button
          className="mt-5"
          variant="outline"
          onClick={() => void tables.refetch()}
        >
          <RefreshCw className="size-4" /> Try again
        </Button>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-primary text-xs font-bold tracking-[.16em] uppercase">
            {workspace === "admin" ? "Dining room setup" : "Service floor"}
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            {workspace === "admin" ? "Table management" : "Restaurant tables"}
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            {workspace === "admin"
              ? "Configure tables, manage live sessions, and maintain printable QR codes."
              : "See live availability and open or close dining sessions."}
          </p>
        </div>
        {canConfigure && (
          <Button onClick={() => setEditor("new")}>
            <Plus className="size-4" /> Add table
          </Button>
        )}
      </header>

      {notice && (
        <div
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"
          role="status"
        >
          {notice}
        </div>
      )}

      <div className="grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-[1fr_220px]">
        <label className="relative">
          <span className="sr-only">Search tables</span>
          <Search className="text-muted-foreground absolute top-3.5 left-3 size-4" />
          <Input
            className="pl-9"
            placeholder="Search number or display name"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search tables"
          />
        </label>
        <label>
          <span className="sr-only">Filter table status</span>
          <Select
            value={occupancy}
            onChange={(event) =>
              setOccupancy(event.target.value as typeof occupancy)
            }
            aria-label="Filter table status"
          >
            <option value="all">All tables</option>
            <option value="available">Available</option>
            <option value="occupied">Occupied</option>
            <option value="out_of_service">Out of service</option>
          </Select>
        </label>
      </div>

      {tables.data.length === 0 ? (
        <Card className="p-10 text-center">
          <h2 className="text-lg font-bold">No tables found</h2>
          <p className="text-muted-foreground mt-2 text-sm">
            {search || occupancy !== "all"
              ? "Try a different search or status filter."
              : canConfigure
                ? "Add the first table to begin setting up the dining room."
                : "An administrator has not configured tables yet."}
          </p>
        </Card>
      ) : (
        <section
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
          aria-label="Restaurant tables"
        >
          {tables.data.map((table) => (
            <TableCard
              key={table.id}
              table={table}
              actions={
                <>
                  {table.occupancy === "AVAILABLE" && (
                    <Button
                      size="sm"
                      onClick={() => setConfirmation({ kind: "open", table })}
                    >
                      <Clock3 className="size-4" /> Open session
                    </Button>
                  )}
                  {table.occupancy === "OCCUPIED" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setConfirmation({ kind: "close", table })}
                    >
                      Close session
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setHistoryTable(table)}
                  >
                    <History className="size-4" /> History
                  </Button>
                  {canConfigure && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditor(table)}
                      >
                        <Pencil className="size-4" /> Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setQrTable(table)}
                      >
                        <QrCode className="size-4" /> QR code
                      </Button>
                    </>
                  )}
                  {canChangeState && table.occupancy !== "OCCUPIED" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setConfirmation({
                          kind: table.isActive ? "deactivate" : "state",
                          table,
                        })
                      }
                    >
                      <Archive className="size-4" />
                      {table.isActive ? "Out of service" : "Return to service"}
                    </Button>
                  )}
                </>
              }
            />
          ))}
        </section>
      )}

      <Dialog
        open={editor !== null}
        onClose={() => setEditor(null)}
        title={editor === "new" ? "Add table" : "Edit table"}
        description="Table numbers are unique within this restaurant."
      >
        <TableForm
          key={editor === "new" ? "new" : editor?.id}
          table={editor === "new" ? null : editor}
          onSubmit={(input) =>
            saveTable.mutateAsync(input).then(() => undefined)
          }
          isSaving={saveTable.isPending}
          error={
            saveTable.isError
              ? errorText(saveTable.error, "The table could not be saved.")
              : null
          }
        />
      </Dialog>

      <Dialog
        open={confirmation !== null}
        onClose={() => setConfirmation(null)}
        title={
          confirmation?.kind === "open"
            ? "Open table session"
            : confirmation?.kind === "close"
              ? "Close table session"
              : confirmation?.table.isActive
                ? "Take table out of service"
                : "Return table to service"
        }
        description="This operation is recorded against your staff session."
      >
        <div className="space-y-5 p-5 sm:p-6">
          <p className="text-sm">
            Confirm this change for{" "}
            <strong>{confirmation?.table.displayName}</strong>?
          </p>
          {action.isError && (
            <p
              className="rounded-lg bg-red-50 p-3 text-sm text-red-800"
              role="alert"
            >
              {errorText(action.error, "The table could not be updated.")}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmation(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => confirmation && action.mutate(confirmation)}
              disabled={action.isPending}
            >
              {action.isPending && (
                <LoaderCircle className="size-4 animate-spin" />
              )}{" "}
              Confirm
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={historyTable !== null}
        onClose={() => setHistoryTable(null)}
        title={`${historyTable?.displayName ?? "Table"} session history`}
        description="Closed sessions remain available as historical records."
      >
        <div className="p-5 sm:p-6">
          {history.isPending ? (
            <p className="text-muted-foreground inline-flex items-center gap-2 text-sm">
              <LoaderCircle className="size-4 animate-spin" /> Loading history
            </p>
          ) : history.isError ? (
            <p
              className="rounded-lg bg-red-50 p-3 text-sm text-red-800"
              role="alert"
            >
              Session history could not be loaded.
            </p>
          ) : history.data.length === 0 ? (
            <p className="text-muted-foreground text-sm">No sessions yet.</p>
          ) : (
            <ol className="space-y-3">
              {history.data.map((session) => (
                <li key={session.id} className="rounded-xl border p-4 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <strong>
                      {session.status === "OPEN" ? "Open" : "Closed"}
                    </strong>
                    <time>{new Date(session.openedAt).toLocaleString()}</time>
                  </div>
                  <p className="text-muted-foreground mt-2">
                    Opened by {session.openedBy.displayName}
                    {session.closedBy &&
                      ` · Closed by ${session.closedBy.displayName}`}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </div>
      </Dialog>

      <Dialog
        open={qrTable !== null}
        onClose={() => setQrTable(null)}
        title={`${qrTable?.displayName ?? "Table"} QR code`}
        description="The QR identifies this table but does not authorize customer ordering."
      >
        <div className="space-y-5 p-5 text-center sm:p-6">
          {qrCode.isPending ? (
            <p className="text-muted-foreground inline-flex items-center gap-2 text-sm">
              <LoaderCircle className="size-4 animate-spin" /> Generating QR
              code
            </p>
          ) : qrCode.isError ? (
            <p
              className="rounded-lg bg-red-50 p-3 text-sm text-red-800"
              role="alert"
            >
              The QR code could not be loaded.
            </p>
          ) : qrCode.data ? (
            <>
              <img
                className="mx-auto size-64 max-w-full"
                src={`data:image/svg+xml,${encodeURIComponent(qrCode.data.svg)}`}
                alt={`QR code for ${qrTable?.displayName ?? "table"}`}
              />
              <p className="text-muted-foreground text-xs break-all">
                {qrCode.data.targetUrl}
              </p>
              {rotateQr.isError && (
                <p
                  className="rounded-lg bg-red-50 p-3 text-sm text-red-800"
                  role="alert"
                >
                  The QR code could not be rotated.
                </p>
              )}
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="outline" onClick={downloadQr}>
                  Download SVG
                </Button>
                <Button variant="outline" onClick={printQr}>
                  <Printer className="size-4" /> Print
                </Button>
                <Button
                  onClick={() => rotateQr.mutate()}
                  disabled={rotateQr.isPending}
                >
                  {rotateQr.isPending && (
                    <LoaderCircle className="size-4 animate-spin" />
                  )}{" "}
                  Rotate QR
                </Button>
              </div>
            </>
          ) : null}
        </div>
      </Dialog>
    </div>
  );
}
