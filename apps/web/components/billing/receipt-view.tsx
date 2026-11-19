import type { Bill } from "@restroflow/contracts";

import { BillItemList } from "./bill-item-list";
import { BillStatusBadge } from "./bill-status-badge";
import { TaxBreakdown } from "./tax-breakdown";
import { formatMinorCurrency } from "@/lib/currency";

export function ReceiptView({ bill }: { bill: Bill }) {
  return (
    <article
      className="receipt rounded-xl border bg-white p-5 sm:p-7"
      aria-labelledby="receipt-title"
    >
      <header className="border-b pb-5 text-center">
        <p className="text-primary text-xs font-bold tracking-[.18em] uppercase">
          Receipt
        </p>
        <h2 id="receipt-title" className="mt-2 text-2xl font-black">
          {bill.restaurant.name}
        </h2>
        {bill.restaurant.address && (
          <p className="text-muted-foreground mt-1 text-sm">
            {bill.restaurant.address}
          </p>
        )}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm">
          <strong>{bill.billNumber}</strong>
          <span aria-hidden="true">·</span>
          <span>{bill.table.displayName}</span>
          <BillStatusBadge status={bill.status} />
        </div>
        <time className="text-muted-foreground mt-2 block text-xs">
          {new Date(bill.finalizedAt).toLocaleString()}
        </time>
      </header>

      <BillItemList items={bill.items} currency={bill.currency} />
      <TaxBreakdown
        subtotalMinor={bill.subtotalMinor}
        taxMinor={bill.taxMinor}
        totalMinor={bill.totalMinor}
        taxName={bill.taxName}
        taxRateBasisPoints={bill.taxRateBasisPoints}
        pricesIncludeTax={bill.pricesIncludeTax}
        currency={bill.currency}
      />

      <section className="mt-6 border-t pt-4" aria-labelledby="payments-title">
        <h3 id="payments-title" className="font-bold">
          Recorded payments
        </h3>
        {bill.payments.length === 0 ? (
          <p className="text-muted-foreground mt-2 text-sm">
            No payments recorded.
          </p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {bill.payments.map((payment) => (
              <li key={payment.id} className="flex justify-between gap-4">
                <span>
                  {payment.method === "CASH"
                    ? "Cash"
                    : "UPI (manually confirmed)"}
                  {payment.reference ? ` · ${payment.reference}` : ""}
                </span>
                <strong className="tabular-nums">
                  {formatMinorCurrency(payment.amountMinor, bill.currency)}
                </strong>
              </li>
            ))}
          </ul>
        )}
        <dl className="mt-4 space-y-2 border-t pt-3 text-sm">
          <div className="flex justify-between">
            <dt>Paid</dt>
            <dd>{formatMinorCurrency(bill.amountPaidMinor, bill.currency)}</dd>
          </div>
          <div className="flex justify-between font-bold">
            <dt>Outstanding</dt>
            <dd>{formatMinorCurrency(bill.outstandingMinor, bill.currency)}</dd>
          </div>
        </dl>
      </section>
      <p className="text-muted-foreground mt-6 text-center text-xs">
        Cash and UPI payments shown here were recorded manually by staff.
      </p>
    </article>
  );
}
