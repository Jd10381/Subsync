import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import CashFlowChart from "@/components/CashFlowChart";

export const dynamic = "force-dynamic";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default async function CashFlowPage() {
  const session = await auth();
  if (!session?.user) return null;

  const isGC = session.user.role === "GC" || session.user.role === "ADMIN";

  const applications = await prisma.billingApplication.findMany({
    where: {
      status: { not: "DRAFT" },
      ...(isGC
        ? { contract: { project: { gcId: session.user.id } } }
        : { contract: { subcontractorId: session.user.id } }),
    },
    include: {
      lineItems: true,
      contract: { include: { project: true } },
    },
    orderBy: [{ periodYear: "asc" }, { periodMonth: "asc" }],
  });

  // Build monthly data
  const now = new Date();
  const months: Array<{ label: string; billed: number; received: number; forecast: number }> = [];
  for (let i = -5; i <= 2; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const m = d.getMonth() + 1;
    const y = d.getFullYear();
    const label = `${MONTHS[m - 1]} ${y}`;
    const monthApps = applications.filter(a => a.periodMonth === m && a.periodYear === y);
    const billed = monthApps.reduce((s, a) => s + a.lineItems.reduce((ss, li) => ss + li.thisPeriodAmt, 0), 0);
    const received = monthApps
      .filter(a => a.status === "APPROVED" || a.status === "PARTIAL_APPROVED")
      .reduce((s, a) => s + (a.netDue ?? 0), 0);
    const isFuture = i > 0;
    const forecast = isFuture ? billed * 0.9 : 0;
    months.push({ label, billed: isFuture ? 0 : billed, received, forecast });
  }

  // Outstanding balance
  const totalBilled = applications.reduce((s, a) => s + a.lineItems.reduce((ss, li) => ss + li.thisPeriodAmt, 0), 0);
  const totalReceived = applications
    .filter(a => a.status === "APPROVED" || a.status === "PARTIAL_APPROVED")
    .reduce((s, a) => s + (a.netDue ?? 0), 0);

  // Pending apps with expected dates
  const pendingApps = applications.filter(a => a.status === "SUBMITTED");

  // Avg days to payment
  const paidApps = applications.filter(a => (a.status === "APPROVED") && a.approvedAt && a.submittedAt);
  const avgDays = paidApps.length
    ? Math.round(paidApps.reduce((s, a) => {
        const diff = new Date(a.approvedAt!).getTime() - new Date(a.submittedAt!).getTime();
        return s + diff / (1000 * 60 * 60 * 24);
      }, 0) / paidApps.length)
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Cash Flow</h1>
        <p className="text-gray-500 text-sm mt-1">6-month historical + 2-month forecast</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Expected This Month</p>
          <p className="text-2xl font-bold text-blue-700">
            {formatCurrency(months[5]?.billed ?? 0)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Avg Days to Payment</p>
          <p className="text-2xl font-bold text-gray-900">{avgDays || "—"}</p>
          <p className="text-xs text-gray-400 mt-0.5">days from submission</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Outstanding Balance</p>
          <p className="text-2xl font-bold text-orange-600">{formatCurrency(totalBilled - totalReceived)}</p>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-800 mb-4">Monthly Billed vs Received vs Forecast</h2>
        <CashFlowChart data={months} />
      </div>

      {/* Payment Forecast Table */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Payment Forecast</h2>
          <p className="text-xs text-gray-500 mt-0.5">Submitted applications awaiting payment</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <th className="px-5 py-3 text-left">App #</th>
              <th className="px-5 py-3 text-left">Project</th>
              <th className="px-5 py-3 text-right">Amount</th>
              <th className="px-5 py-3 text-left">Submitted</th>
              <th className="px-5 py-3 text-left">Expected Payment</th>
              <th className="px-5 py-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {pendingApps.length === 0 ? (
              <tr><td colSpan={6} className="text-center text-gray-500 py-8">No pending applications.</td></tr>
            ) : pendingApps.map((app) => {
              const grossAmt = app.lineItems.reduce((s, li) => s + li.thisPeriodAmt, 0);
              const submitted = app.submittedAt ? new Date(app.submittedAt) : null;
              const expected = submitted ? new Date(submitted.getTime() + 30 * 24 * 60 * 60 * 1000) : null;
              const isOverdue = expected && expected < now;
              return (
                <tr key={app.id} className={`hover:bg-gray-50 ${isOverdue ? "bg-red-50/30" : ""}`}>
                  <td className="px-5 py-3 font-medium">#{app.appNumber}</td>
                  <td className="px-5 py-3 text-gray-700">{app.contract.project.name}</td>
                  <td className="px-5 py-3 text-right font-mono">{formatCurrency(grossAmt)}</td>
                  <td className="px-5 py-3 text-gray-600 text-xs">
                    {submitted ? submitted.toLocaleDateString() : "—"}
                  </td>
                  <td className="px-5 py-3 text-xs">
                    <span className={isOverdue ? "text-red-600 font-medium" : "text-gray-600"}>
                      {expected ? expected.toLocaleDateString() : "—"}
                      {isOverdue && " ⚠ OVERDUE"}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isOverdue ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}>
                      {isOverdue ? "Overdue" : "Pending"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
