"use client";

import { useState, useEffect } from "react";
import { formatCurrency, formatDate } from "@/lib/utils";

interface ChangeOrder {
  id: string;
  coNumber: number;
  description: string;
  amount: number;
  status: string;
  submittedAt: string;
  subSignedAt: string | null;
  gcSignedAt: string | null;
  gcComment: string | null;
  contract: {
    id: string;
    project: { name: string; contractNumber: string | null };
  };
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
};

export default function ChangeOrdersPage() {
  const [orders, setOrders] = useState<ChangeOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState<string | null>(null);

  useEffect(() => { loadOrders(); }, []);

  async function loadOrders() {
    setLoading(true);
    const res = await fetch("/api/change-orders");
    if (res.ok) setOrders(await res.json());
    setLoading(false);
  }

  async function signCO(id: string) {
    setSigning(id);
    const res = await fetch(`/api/change-orders/${id}/sign`, { method: "PATCH" });
    if (res.ok) await loadOrders();
    setSigning(null);
  }

  const approved = orders.filter(o => o.status === "APPROVED").reduce((s, o) => s + o.amount, 0);
  const pending = orders.filter(o => o.status === "PENDING").reduce((s, o) => s + o.amount, 0);
  const totalRevised = orders.filter(o => o.status === "APPROVED").reduce((s, o) => s + o.amount, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Change Orders</h1>
        <p className="text-gray-500 text-sm mt-1">Track and sign change orders for your contracts</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Approved CO Total</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(approved)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Pending CO Total</p>
          <p className="text-2xl font-bold text-amber-600">{formatCurrency(pending)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Net CO Impact</p>
          <p className={`text-2xl font-bold ${totalRevised >= 0 ? "text-blue-700" : "text-red-600"}`}>
            {totalRevised >= 0 ? "+" : ""}{formatCurrency(totalRevised)}
          </p>
        </div>
      </div>

      {/* CO Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Change Order Log</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <th className="px-5 py-3 text-left">CO #</th>
              <th className="px-5 py-3 text-left">Project</th>
              <th className="px-5 py-3 text-left">Description</th>
              <th className="px-5 py-3 text-right">Amount</th>
              <th className="px-5 py-3 text-left">Submitted</th>
              <th className="px-5 py-3 text-left">GC Status</th>
              <th className="px-5 py-3 text-left">Sub Signed</th>
              <th className="px-5 py-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={8} className="text-center py-8 text-gray-400">Loading...</td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-12 text-gray-500">No change orders found.</td></tr>
            ) : orders.map((co) => (
              <tr key={co.id} className="hover:bg-gray-50">
                <td className="px-5 py-3 font-medium text-gray-800">#{co.coNumber}</td>
                <td className="px-5 py-3 text-gray-700">{co.contract.project.name}</td>
                <td className="px-5 py-3 text-gray-600 max-w-xs truncate">{co.description}</td>
                <td className={`px-5 py-3 text-right font-mono font-medium ${co.amount >= 0 ? "text-green-700" : "text-red-600"}`}>
                  {co.amount >= 0 ? "+" : ""}{formatCurrency(co.amount)}
                </td>
                <td className="px-5 py-3 text-gray-500 text-xs">{formatDate(co.submittedAt)}</td>
                <td className="px-5 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[co.status] || "bg-gray-100 text-gray-600"}`}>
                    {co.status}
                  </span>
                </td>
                <td className="px-5 py-3 text-xs text-gray-500">
                  {co.subSignedAt
                    ? <span className="text-green-600">✓ {new Date(co.subSignedAt).toLocaleDateString()}</span>
                    : <span className="text-gray-400">Not signed</span>
                  }
                </td>
                <td className="px-5 py-3 text-center">
                  {!co.subSignedAt && co.status !== "REJECTED" ? (
                    <button
                      onClick={() => signCO(co.id)}
                      disabled={signing === co.id}
                      className="text-xs bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition-colors"
                    >
                      {signing === co.id ? "Signing..." : "Sign CO"}
                    </button>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
