import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";
import Link from "next/link";

export const dynamic = "force-dynamic";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const STATUS_COLORS: Record<string, string> = {
  SUBMITTED: "bg-blue-100 text-blue-800",
  APPROVED: "bg-green-100 text-green-800",
  PARTIAL_APPROVED: "bg-amber-100 text-amber-800",
  REJECTED: "bg-red-100 text-red-800",
  DRAFT: "bg-gray-100 text-gray-700",
};

export default async function HistoryPage() {
  const session = await auth();
  if (!session?.user) return null;

  const isGC = session.user.role === "GC" || session.user.role === "ADMIN";

  const applications = await prisma.billingApplication.findMany({
    where: isGC
      ? { contract: { project: { gcId: session.user.id } } }
      : { contract: { subcontractorId: session.user.id } },
    include: {
      contract: {
        include: {
          project: true,
          subcontractor: { select: { name: true, companyName: true } },
        },
      },
      lineItems: true,
    },
    orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }, { appNumber: "desc" }],
  });

  const totalBilled = applications
    .filter((a) => a.status !== "DRAFT")
    .reduce((sum, a) => sum + a.lineItems.reduce((s, li) => s + li.thisPeriodAmt, 0), 0);

  const totalPaid = applications
    .filter((a) => a.status === "APPROVED" || a.status === "PARTIAL_APPROVED")
    .reduce((sum, a) => sum + (a.netDue ?? 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pay History</h1>
        <p className="text-gray-500 text-sm mt-1">All submitted pay applications</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Total Applications</p>
          <p className="text-2xl font-bold text-gray-900">{applications.filter(a => a.status !== "DRAFT").length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Total Billed</p>
          <p className="text-2xl font-bold text-blue-700">{formatCurrency(totalBilled)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Total Paid (Net)</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(totalPaid)}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <th className="px-5 py-3 text-left">App #</th>
              <th className="px-5 py-3 text-left">Project</th>
              {isGC && <th className="px-5 py-3 text-left">Subcontractor</th>}
              <th className="px-5 py-3 text-left">Period</th>
              <th className="px-5 py-3 text-right">Gross Billed</th>
              <th className="px-5 py-3 text-right">Retainage</th>
              <th className="px-5 py-3 text-right">Net Paid</th>
              <th className="px-5 py-3 text-left">Lien Waiver</th>
              <th className="px-5 py-3 text-left">Status</th>
              <th className="px-5 py-3 text-center">View</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {applications.length === 0 ? (
              <tr>
                <td colSpan={isGC ? 10 : 9} className="text-center text-gray-500 py-12">
                  No billing history yet.
                </td>
              </tr>
            ) : applications.map((app) => {
              const grossAmt = app.lineItems.reduce((s, li) => s + li.thisPeriodAmt, 0);
              const retainage = grossAmt * (app.contract.retainagePercent / 100);
              return (
                <tr key={app.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-800">#{app.appNumber}</td>
                  <td className="px-5 py-3 text-gray-700">{app.contract.project.name}</td>
                  {isGC && (
                    <td className="px-5 py-3 text-gray-600 text-xs">
                      {app.contract.subcontractor.companyName || app.contract.subcontractor.name}
                    </td>
                  )}
                  <td className="px-5 py-3 text-gray-600">
                    {MONTHS[app.periodMonth - 1]} {app.periodYear}
                  </td>
                  <td className="px-5 py-3 text-right font-mono">{formatCurrency(grossAmt)}</td>
                  <td className="px-5 py-3 text-right font-mono text-orange-600">{formatCurrency(retainage)}</td>
                  <td className="px-5 py-3 text-right font-mono font-medium">
                    {app.status === "APPROVED" || app.status === "PARTIAL_APPROVED"
                      ? formatCurrency(app.netDue ?? 0)
                      : "—"}
                  </td>
                  <td className="px-5 py-3">
                    {app.lienWaiverAccepted ? (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                        {app.lienWaiverType || "Conditional"}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[app.status] || "bg-gray-100 text-gray-600"}`}>
                      {app.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-center">
                    <Link
                      href={`/billing/preview?applicationId=${app.id}`}
                      className="text-blue-600 hover:underline text-xs font-medium"
                    >
                      View
                    </Link>
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
