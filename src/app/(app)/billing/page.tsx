"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { formatCurrency, monthName } from "@/lib/utils";

interface SOVLineItem {
  id: string;
  description: string;
  scheduledValue: number;
  isLocked: boolean;
  order: number;
}

interface Contract {
  id: string;
  value: number;
  retainagePercent: number;
  projectId: string;
  project: {
    id: string;
    name: string;
    contractNumber: string | null;
  };
  sovLineItems: SOVLineItem[];
  applications: Array<{
    id: string;
    appNumber: number;
    status: string;
    lineItems: Array<{
      sovLineItemId: string;
      thisPeriodPct: number;
      previousBilledPct: number;
    }>;
  }>;
}

interface BillingRow {
  sovId: string;
  description: string;
  scheduledValue: number;
  isLocked: boolean;
  previousBilledPct: number;
  thisPeriodPct: number;
  thisPeriodAmt: number;
  totalPct: number;
  balance: number;
  warning: boolean;
}

const MONTHS = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: monthName(i + 1) }));
const YEARS = [2023, 2024, 2025, 2026, 2027];

export default function BillingPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const preselectedContractId = searchParams.get("contractId");

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [selectedContractId, setSelectedContractId] = useState(preselectedContractId || "");
  const [periodMonth, setPeriodMonth] = useState(new Date().getMonth() + 1);
  const [periodYear, setPeriodYear] = useState(new Date().getFullYear());
  const [rows, setRows] = useState<BillingRow[]>([]);
  const [lienWaiverAccepted, setLienWaiverAccepted] = useState(false);
  const [signedByName, setSignedByName] = useState("");
  const [signedAt, setSignedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const selectedContract = contracts.find((c) => c.id === selectedContractId);

  useEffect(() => {
    fetch("/api/contracts")
      .then((r) => r.json())
      .then((data) => {
        setContracts(data);
        if (preselectedContractId) setSelectedContractId(preselectedContractId);
        else if (data.length > 0 && !selectedContractId) setSelectedContractId(data[0].id);
      });
  }, []);

  const buildRows = useCallback((contract: Contract) => {
    const lastApp = contract.applications
      .filter((a) => a.status !== "DRAFT")
      .sort((a, b) => b.appNumber - a.appNumber)[0];

    const newRows: BillingRow[] = contract.sovLineItems
      .sort((a, b) => a.order - b.order)
      .map((sov) => {
        const prevItem = lastApp?.lineItems.find((li) => li.sovLineItemId === sov.id);
        const previousBilledPct = prevItem
          ? prevItem.previousBilledPct + prevItem.thisPeriodPct
          : 0;
        const remaining = 100 - previousBilledPct;
        const suggested = Math.min(remaining * 0.3, remaining);
        const thisPeriodPct = sov.isLocked ? 0 : Math.max(0, parseFloat(suggested.toFixed(1)));
        const thisPeriodAmt = (sov.scheduledValue * thisPeriodPct) / 100;
        const totalPct = previousBilledPct + thisPeriodPct;
        const balance = sov.scheduledValue - (sov.scheduledValue * totalPct) / 100;

        return {
          sovId: sov.id,
          description: sov.description,
          scheduledValue: sov.scheduledValue,
          isLocked: sov.isLocked,
          previousBilledPct,
          thisPeriodPct,
          thisPeriodAmt,
          totalPct,
          balance,
          warning: false,
        };
      });
    setRows(newRows);
  }, []);

  useEffect(() => {
    if (selectedContract) {
      buildRows(selectedContract);
    }
  }, [selectedContractId, selectedContract, buildRows]);

  function updateRow(sovId: string, thisPeriodPct: number) {
    setRows((prev) =>
      prev.map((row) => {
        if (row.sovId !== sovId) return row;
        const clamped = Math.max(0, Math.min(thisPeriodPct, 100 - row.previousBilledPct));
        const thisPeriodAmt = (row.scheduledValue * clamped) / 100;
        const totalPct = row.previousBilledPct + clamped;
        const balance = row.scheduledValue - (row.scheduledValue * totalPct) / 100;
        const remaining = 100 - row.previousBilledPct;
        const warning = clamped > remaining * 0.5 && clamped > 0;
        return { ...row, thisPeriodPct: clamped, thisPeriodAmt, totalPct, balance, warning };
      })
    );
  }

  function clearAll() {
    setRows((prev) => prev.map((r) => ({ ...r, thisPeriodPct: 0, thisPeriodAmt: 0, totalPct: r.previousBilledPct, balance: r.scheduledValue * (1 - r.previousBilledPct / 100), warning: false })));
    setLienWaiverAccepted(false);
    setSignedByName("");
    setSignedAt(null);
  }

  function handleSign() {
    if (!signedByName.trim()) {
      alert("Please enter your name to sign.");
      return;
    }
    setSignedAt(new Date().toISOString());
  }

  const totals = rows.reduce(
    (acc, row) => ({
      scheduledValue: acc.scheduledValue + row.scheduledValue,
      thisPeriodAmt: acc.thisPeriodAmt + row.thisPeriodAmt,
      previousBilled: acc.previousBilled + (row.scheduledValue * row.previousBilledPct) / 100,
    }),
    { scheduledValue: 0, thisPeriodAmt: 0, previousBilled: 0 }
  );

  const retainageAmt = totals.thisPeriodAmt * ((selectedContract?.retainagePercent ?? 10) / 100);
  const netDue = totals.thisPeriodAmt - retainageAmt;

  async function handlePreview() {
    if (!selectedContractId) return;
    const params = new URLSearchParams({
      contractId: selectedContractId,
      month: periodMonth.toString(),
      year: periodYear.toString(),
    });
    const state = { rows, lienWaiverAccepted, signedByName, signedAt, netDue, retainageAmt, totals };
    sessionStorage.setItem("billingPreview", JSON.stringify(state));
    router.push(`/billing/preview?${params}`);
  }

  async function handleSubmit() {
    if (!selectedContractId) return alert("Select a contract.");
    if (!lienWaiverAccepted) return alert("Please accept the lien waiver.");
    if (!signedAt) return alert("Please sign the application before submitting.");
    if (totals.thisPeriodAmt === 0) return alert("No amounts entered for this period.");

    setSubmitting(true);
    try {
      const res = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractId: selectedContractId,
          periodMonth,
          periodYear,
          rows,
          lienWaiverAccepted,
          signedByName,
          signedAt,
          netDue,
        }),
      });

      if (res.ok) {
        const app = await res.json();
        router.push(`/billing/preview?applicationId=${app.id}`);
      } else {
        const err = await res.json();
        alert(err.error || "Submission failed.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const hasWarning = rows.some((r) => r.warning);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">New Billing Application</h1>
        <p className="text-gray-500 text-sm mt-1">Submit a pay application against your Schedule of Values</p>
      </div>

      {/* Selectors */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Project / Contract</label>
            <select
              value={selectedContractId}
              onChange={(e) => setSelectedContractId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a project...</option>
              {contracts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.project.name} — {formatCurrency(c.value)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Billing Period Month</label>
            <select
              value={periodMonth}
              onChange={(e) => setPeriodMonth(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {MONTHS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
            <select
              value={periodYear}
              onChange={(e) => setPeriodYear(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Overbilling Warning */}
      {hasWarning && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <svg className="w-5 h-5 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-sm text-amber-800">
            <strong>Overbilling Warning:</strong> One or more line items jump more than 50% of the remaining balance in this period. The GC may request revision.
          </p>
        </div>
      )}

      {/* SOV Table */}
      {selectedContract && rows.length > 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Schedule of Values</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {selectedContract.project.name} · Contract #{selectedContract.project.contractNumber}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3 text-left w-8">#</th>
                  <th className="px-4 py-3 text-left">Description</th>
                  <th className="px-4 py-3 text-right">Sched. Value</th>
                  <th className="px-4 py-3 text-right">Prev %</th>
                  <th className="px-4 py-3 text-right">Suggested %</th>
                  <th className="px-4 py-3 text-center w-32">This Period %</th>
                  <th className="px-4 py-3 text-right">This Period $</th>
                  <th className="px-4 py-3 text-right">Total %</th>
                  <th className="px-4 py-3 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((row, idx) => {
                  const remaining = 100 - row.previousBilledPct;
                  const suggested = Math.min(remaining * 0.3, remaining);
                  return (
                    <tr key={row.sovId} className={`hover:bg-gray-50 ${row.warning ? "bg-amber-50/50" : ""}`}>
                      <td className="px-4 py-3 text-gray-500 text-xs">{idx + 1}</td>
                      <td className="px-4 py-3 text-gray-800">
                        {row.description}
                        {row.isLocked && (
                          <span className="ml-2 text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">Locked</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700 font-mono">{formatCurrency(row.scheduledValue)}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{row.previousBilledPct.toFixed(1)}%</td>
                      <td className="px-4 py-3 text-right text-blue-600 font-medium">{suggested.toFixed(1)}%</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min={0}
                            max={100 - row.previousBilledPct}
                            step={0.1}
                            value={row.thisPeriodPct}
                            disabled={row.isLocked}
                            onChange={(e) => updateRow(row.sovId, parseFloat(e.target.value) || 0)}
                            className={`w-20 border rounded px-2 py-1 text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                              row.isLocked ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "border-gray-300"
                            } ${row.warning ? "border-amber-400" : ""}`}
                          />
                          <span className="text-gray-500 text-xs">%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-800 font-mono">
                        {formatCurrency(row.thisPeriodAmt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full"
                              style={{ width: `${Math.min(row.totalPct, 100)}%` }}
                            />
                          </div>
                          <span className="text-gray-700 text-xs">{row.totalPct.toFixed(1)}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600 font-mono">{formatCurrency(row.balance)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 font-semibold border-t-2 border-gray-200">
                  <td colSpan={2} className="px-4 py-3 text-gray-800">TOTALS</td>
                  <td className="px-4 py-3 text-right font-mono">{formatCurrency(totals.scheduledValue)}</td>
                  <td colSpan={3} />
                  <td className="px-4 py-3 text-right font-mono text-blue-700">{formatCurrency(totals.thisPeriodAmt)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : selectedContractId ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-500 text-sm">No SOV line items for this contract.</p>
        </div>
      ) : null}

      {/* Summary Cards */}
      {selectedContract && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Contract Value", value: formatCurrency(selectedContract.value), color: "gray" },
            { label: "Previously Billed", value: formatCurrency(totals.previousBilled), color: "gray" },
            { label: "This Period", value: formatCurrency(totals.thisPeriodAmt), color: "blue" },
            { label: "Retainage Held", value: formatCurrency(retainageAmt), color: "orange" },
          ].map((c) => (
            <div key={c.label} className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500">{c.label}</p>
              <p className={`text-xl font-bold mt-1 ${c.color === "blue" ? "text-blue-700" : c.color === "orange" ? "text-orange-600" : "text-gray-800"}`}>
                {c.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {selectedContract && (
        <div className="bg-blue-600 rounded-xl p-5 text-white">
          <p className="text-sm font-medium opacity-80">Net Amount Due This Period</p>
          <p className="text-3xl font-bold mt-1">{formatCurrency(netDue)}</p>
          <p className="text-xs opacity-70 mt-0.5">
            After {selectedContract.retainagePercent}% retainage ({formatCurrency(retainageAmt)})
          </p>
        </div>
      )}

      {/* Lien Waiver + Signature */}
      {selectedContract && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h3 className="font-semibold text-gray-800">Certification & Lien Waiver</h3>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={lienWaiverAccepted}
              onChange={(e) => setLienWaiverAccepted(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">
              I certify that the information provided in this pay application is accurate and complete. Upon payment, I waive all claims and liens for labor performed and materials furnished through this billing period.
            </span>
          </label>

          <div className="border-t border-gray-100 pt-4">
            <p className="text-sm font-medium text-gray-700 mb-2">Digital Signature</p>
            {signedAt ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-green-800">Signed by {signedByName}</p>
                  <p className="text-xs text-green-600">{new Date(signedAt).toLocaleString()}</p>
                </div>
              </div>
            ) : (
              <div className="flex gap-3">
                <input
                  type="text"
                  value={signedByName}
                  onChange={(e) => setSignedByName(e.target.value)}
                  placeholder="Type your full name to sign"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleSign}
                  className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors"
                >
                  Sign
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {selectedContract && (
        <div className="flex gap-3 justify-end">
          <button
            onClick={clearAll}
            className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Clear
          </button>
          <button
            onClick={handlePreview}
            className="px-5 py-2.5 border border-blue-600 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-50 transition-colors"
          >
            Preview Invoice
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-blue-400 transition-colors"
          >
            {submitting ? "Submitting..." : "Submit Bill to GC"}
          </button>
        </div>
      )}
    </div>
  );
}
