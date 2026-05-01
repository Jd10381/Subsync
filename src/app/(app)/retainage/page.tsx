"use client";

import { useState, useEffect } from "react";
import { formatCurrency } from "@/lib/utils";

interface RetainageData {
  contractId: string;
  projectName: string;
  contractNumber: string | null;
  contractValue: number;
  retainagePercent: number;
  grossBilled: number;
  retainageHeld: number;
  pctComplete: number;
  eligibility: string;
}

export default function RetainagePage() {
  const [data, setData] = useState<RetainageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestForm, setRequestForm] = useState<{contractId: string; amount: string} | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/retainage")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); });
  }, []);

  async function submitRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!requestForm) return;
    setSubmitting(true);
    try {
      await fetch("/api/retainage/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractId: requestForm.contractId, amount: parseFloat(requestForm.amount) }),
      });
      alert("Retainage release request submitted to GC.");
      setRequestForm(null);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Retainage Tracker</h1>
        <p className="text-gray-500 text-sm mt-1">Monitor retainage held and request releases</p>
      </div>

      {/* Summary */}
      {!loading && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm text-gray-500">Total Retainage Held</p>
            <p className="text-2xl font-bold text-orange-600">
              {formatCurrency(data.reduce((s, d) => s + d.retainageHeld, 0))}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm text-gray-500">Total Gross Billed</p>
            <p className="text-2xl font-bold text-blue-700">
              {formatCurrency(data.reduce((s, d) => s + d.grossBilled, 0))}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm text-gray-500">Contracts Tracked</p>
            <p className="text-2xl font-bold text-gray-900">{data.length}</p>
          </div>
        </div>
      )}

      {/* Retainage Table */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin w-6 h-6 border-3 border-blue-500 border-t-transparent rounded-full" />
          </div>
        ) : data.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <p className="text-gray-500">No retainage data available.</p>
          </div>
        ) : data.map((row) => {
          const eligible = row.pctComplete >= 50;
          const fullyEligible = row.pctComplete >= 95;

          return (
            <div key={row.contractId} className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-gray-900">{row.projectName}</h3>
                  {row.contractNumber && (
                    <p className="text-xs text-gray-500 mt-0.5">Contract #{row.contractNumber}</p>
                  )}
                </div>
                <button
                  onClick={() => setRequestForm({ contractId: row.contractId, amount: (row.retainageHeld / 2).toFixed(2) })}
                  disabled={!eligible}
                  className={`text-sm px-4 py-2 rounded-lg font-medium transition-colors ${
                    eligible
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : "bg-gray-100 text-gray-400 cursor-not-allowed"
                  }`}
                >
                  Request Release
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <p className="text-xs text-gray-500">Contract Value</p>
                  <p className="font-semibold text-gray-800">{formatCurrency(row.contractValue)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Retainage Rate</p>
                  <p className="font-semibold text-gray-800">{row.retainagePercent}%</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Gross Billed</p>
                  <p className="font-semibold text-blue-700">{formatCurrency(row.grossBilled)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Retainage Held</p>
                  <p className="font-semibold text-orange-600">{formatCurrency(row.retainageHeld)}</p>
                </div>
              </div>

              {/* Progress */}
              <div className="space-y-1.5 mb-3">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Contract completion</span>
                  <span className="font-medium">{row.pctComplete.toFixed(1)}%</span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      row.pctComplete >= 95 ? "bg-green-500" :
                      row.pctComplete >= 50 ? "bg-blue-500" :
                      "bg-gray-400"
                    }`}
                    style={{ width: `${Math.min(row.pctComplete, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-400">
                  <span>0%</span>
                  <span className="text-amber-600">50% — partial release eligible</span>
                  <span className="text-green-600">95%+ — full release eligible</span>
                </div>
              </div>

              {/* Eligibility Message */}
              <div className={`text-sm p-3 rounded-lg ${
                fullyEligible ? "bg-green-50 text-green-800 border border-green-200" :
                eligible ? "bg-blue-50 text-blue-800 border border-blue-200" :
                "bg-gray-50 text-gray-600 border border-gray-200"
              }`}>
                {row.eligibility}
              </div>
            </div>
          );
        })}
      </div>

      {/* Request Modal */}
      {requestForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="font-bold text-gray-900 mb-4">Request Retainage Release</h3>
            <form onSubmit={submitRequest} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Release Amount ($)</label>
                <input
                  type="number"
                  min={1}
                  step={0.01}
                  value={requestForm.amount}
                  onChange={(e) => setRequestForm({ ...requestForm, amount: e.target.value })}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Requested Date</label>
                <input
                  type="date"
                  defaultValue={new Date().toISOString().split("T")[0]}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setRequestForm(null)}
                  className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-blue-400"
                >
                  {submitting ? "Submitting..." : "Submit to GC"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
