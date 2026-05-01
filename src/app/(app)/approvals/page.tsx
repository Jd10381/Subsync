"use client";

import { useState, useEffect } from "react";
import { formatCurrency } from "@/lib/utils";

interface Application {
  id: string;
  appNumber: number;
  periodMonth: number;
  periodYear: number;
  status: string;
  submittedAt: string | null;
  netDue: number | null;
  lienWaiverAccepted: boolean;
  signedByName: string | null;
  gcComment: string | null;
  contract: {
    id: string;
    retainagePercent: number;
    project: { name: string; contractNumber: string | null };
    subcontractor: { name: string | null; email: string; companyName: string | null };
  };
  lineItems: Array<{ thisPeriodAmt: number }>;
  comments: Array<{
    id: string;
    message: string;
    createdAt: string;
    user: { name: string | null; email: string };
  }>;
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const STATUS_COLORS: Record<string, string> = {
  SUBMITTED: "bg-blue-100 text-blue-800",
  APPROVED: "bg-green-100 text-green-800",
  PARTIAL_APPROVED: "bg-amber-100 text-amber-800",
  REJECTED: "bg-red-100 text-red-800",
  DRAFT: "bg-gray-100 text-gray-700",
};

export default function ApprovalsPage() {
  const [apps, setApps] = useState<Application[]>([]);
  const [selected, setSelected] = useState<Application | null>(null);
  const [comment, setComment] = useState("");
  const [gcComment, setGcComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("SUBMITTED");

  useEffect(() => { loadApps(); }, []);

  async function loadApps() {
    setLoading(true);
    const res = await fetch("/api/approvals");
    if (res.ok) setApps(await res.json());
    setLoading(false);
  }

  async function takeAction(appId: string, action: "APPROVED" | "PARTIAL_APPROVED" | "REJECTED") {
    const res = await fetch(`/api/approvals/${appId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: action, gcComment }),
    });
    if (res.ok) {
      await loadApps();
      setSelected(null);
      setGcComment("");
    }
  }

  async function postComment(appId: string) {
    if (!comment.trim()) return;
    await fetch(`/api/billing/${appId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: comment }),
    });
    setComment("");
    await loadApps();
    const fresh = apps.find(a => a.id === appId);
    if (fresh) setSelected(fresh);
  }

  const filtered = apps.filter(a => filter === "ALL" || a.status === filter);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Billing Approvals</h1>
        <p className="text-gray-500 text-sm mt-1">Review and approve subcontractor pay applications</p>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {["SUBMITTED", "APPROVED", "REJECTED", "ALL"].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === s ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase().replace("_", " ")}
            <span className="ml-1.5 text-xs opacity-75">
              ({s === "ALL" ? apps.length : apps.filter(a => a.status === s).length})
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin w-6 h-6 border-3 border-blue-500 border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-5 py-3 text-left">App #</th>
                <th className="px-5 py-3 text-left">Project</th>
                <th className="px-5 py-3 text-left">Subcontractor</th>
                <th className="px-5 py-3 text-left">Period</th>
                <th className="px-5 py-3 text-right">Amount</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3 text-left">Submitted</th>
                <th className="px-5 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center text-gray-500 py-8">No applications found.</td></tr>
              ) : filtered.map((app) => {
                const grossAmt = app.lineItems.reduce((s, li) => s + li.thisPeriodAmt, 0);
                return (
                  <tr key={app.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-800">#{app.appNumber}</td>
                    <td className="px-5 py-3 text-gray-700">{app.contract.project.name}</td>
                    <td className="px-5 py-3 text-gray-700">
                      {app.contract.subcontractor.companyName || app.contract.subcontractor.name}
                    </td>
                    <td className="px-5 py-3 text-gray-600">
                      {MONTHS[app.periodMonth - 1]} {app.periodYear}
                    </td>
                    <td className="px-5 py-3 text-right font-mono font-medium">{formatCurrency(grossAmt)}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[app.status] || "bg-gray-100 text-gray-600"}`}>
                        {app.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-500 text-xs">
                      {app.submittedAt ? new Date(app.submittedAt).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <button
                        onClick={() => { setSelected(app); setGcComment(app.gcComment || ""); }}
                        className="text-blue-600 hover:underline text-xs font-medium"
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Review Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <div>
                <h2 className="font-bold text-gray-900">App #{selected.appNumber} Review</h2>
                <p className="text-sm text-gray-500">{selected.contract.project.name} · {MONTHS[selected.periodMonth - 1]} {selected.periodYear}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">Subcontractor</p>
                  <p className="font-medium">{selected.contract.subcontractor.companyName || selected.contract.subcontractor.name}</p>
                  <p className="text-xs text-gray-400">{selected.contract.subcontractor.email}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">Net Amount Due</p>
                  <p className="text-xl font-bold text-blue-700">{formatCurrency(selected.netDue ?? 0)}</p>
                  <p className="text-xs text-gray-400">After {selected.contract.retainagePercent}% retainage</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${selected.lienWaiverAccepted ? "bg-green-400" : "bg-gray-300"}`} />
                  <span className="text-gray-600">Lien waiver accepted</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${selected.signedByName ? "bg-green-400" : "bg-gray-300"}`} />
                  <span className="text-gray-600">{selected.signedByName ? `Signed by ${selected.signedByName}` : "Not signed"}</span>
                </div>
              </div>

              {/* GC Comment */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">GC Comment / Notes</label>
                <textarea
                  value={gcComment}
                  onChange={(e) => setGcComment(e.target.value)}
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Optional comment to subcontractor..."
                />
              </div>

              {/* Action Buttons */}
              {selected.status === "SUBMITTED" && (
                <div className="flex gap-3">
                  <button
                    onClick={() => takeAction(selected.id, "APPROVED")}
                    className="flex-1 bg-green-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-green-700"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => takeAction(selected.id, "PARTIAL_APPROVED")}
                    className="flex-1 bg-amber-500 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-amber-600"
                  >
                    Partial Approve
                  </button>
                  <button
                    onClick={() => takeAction(selected.id, "REJECTED")}
                    className="flex-1 bg-red-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-red-700"
                  >
                    Reject
                  </button>
                </div>
              )}

              {selected.status !== "SUBMITTED" && (
                <div className={`p-3 rounded-lg text-sm font-medium text-center ${STATUS_COLORS[selected.status]}`}>
                  Application {selected.status.replace("_", " ")}
                  {selected.gcComment && <p className="font-normal mt-1">{selected.gcComment}</p>}
                </div>
              )}

              {/* Comment Thread */}
              <div className="border-t border-gray-100 pt-4">
                <p className="text-sm font-medium text-gray-700 mb-3">Comment Thread</p>
                <div className="space-y-3 max-h-40 overflow-y-auto mb-3">
                  {selected.comments.length === 0 ? (
                    <p className="text-xs text-gray-400">No comments yet.</p>
                  ) : selected.comments.map((c) => (
                    <div key={c.id} className="flex gap-2">
                      <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-xs text-blue-700 font-medium">{c.user.name?.charAt(0) || "U"}</span>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-700">{c.user.name || c.user.email}</p>
                        <p className="text-sm text-gray-600">{c.message}</p>
                        <p className="text-xs text-gray-400">{new Date(c.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Add a comment..."
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onKeyDown={(e) => e.key === "Enter" && postComment(selected.id)}
                  />
                  <button
                    onClick={() => postComment(selected.id)}
                    className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-blue-700"
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
