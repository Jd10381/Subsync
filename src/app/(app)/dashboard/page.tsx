import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatCurrency, daysSince, daysUntil } from "@/lib/utils";
import Link from "next/link";

export const dynamic = "force-dynamic";

async function getDashboardData(userId: string, role: string) {
  const isGC = role === "GC" || role === "ADMIN";

  const contracts = await prisma.contract.findMany({
    where: isGC ? { project: { gcId: userId } } : { subcontractorId: userId },
    include: {
      project: true,
      sovLineItems: true,
      applications: {
        include: { lineItems: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  const complianceDocs = await prisma.complianceDocument.findMany({
    where: { userId },
    orderBy: { expiryDate: "asc" },
  });

  const pendingApps = await prisma.billingApplication.findMany({
    where: isGC
      ? { status: "SUBMITTED", contract: { project: { gcId: userId } } }
      : { status: "SUBMITTED", contract: { subcontractorId: userId } },
    include: { contract: { include: { project: true } } },
  });

  return { contracts, complianceDocs, pendingApps };
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) return null;

  const { contracts, complianceDocs, pendingApps } = await getDashboardData(
    session.user.id,
    session.user.role
  );

  // Compute metrics
  let totalContractValue = 0;
  let totalBilled = 0;
  let totalRetainageHeld = 0;
  let totalPaid = 0;

  const projectMetrics = contracts.map((contract) => {
    const contractValue = contract.value;
    const retainage = contract.retainagePercent / 100;

    const approvedApps = contract.applications.filter(
      (a) => a.status === "APPROVED" || a.status === "PARTIAL_APPROVED"
    );

    const billedTotal = contract.applications
      .filter((a) => a.status !== "DRAFT")
      .reduce((sum, app) => sum + (app.netDue ?? 0) / (1 - retainage), 0);

    const grossBilled = contract.applications
      .filter((a) => a.status !== "DRAFT")
      .reduce((sum, app) => {
        const gross = app.lineItems.reduce((s, li) => s + li.thisPeriodAmt, 0);
        return sum + gross;
      }, 0);

    const retainageHeld = grossBilled * retainage;
    const netPaid = approvedApps.reduce((sum, app) => sum + (app.netDue ?? 0), 0);

    const lastApproved = approvedApps[0]?.approvedAt;

    totalContractValue += contractValue;
    totalBilled += grossBilled;
    totalRetainageHeld += retainageHeld;
    totalPaid += netPaid;

    const pctBilled = contractValue > 0 ? (grossBilled / contractValue) * 100 : 0;

    return {
      contract,
      project: contract.project,
      contractValue,
      grossBilled,
      retainageHeld,
      netPaid,
      pctBilled,
      lastApproved,
      retainagePercent: contract.retainagePercent,
    };
  });

  const expiringDocs = complianceDocs.filter(
    (d) => daysUntil(d.expiryDate) <= 30 && daysUntil(d.expiryDate) >= 0
  );
  const expiredDocs = complianceDocs.filter((d) => daysUntil(d.expiryDate) < 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">
          Welcome back,{" "}
          <span className="font-medium">{session.user.name}</span>
          {session.user.companyName && ` · ${session.user.companyName}`}
        </p>
      </div>

      {/* Compliance Alert */}
      {(expiringDocs.length > 0 || expiredDocs.length > 0) && (
        <div className={`rounded-xl p-4 border flex items-start gap-3 ${expiredDocs.length > 0 ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"}`}>
          <svg className={`w-5 h-5 mt-0.5 flex-shrink-0 ${expiredDocs.length > 0 ? "text-red-500" : "text-amber-500"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className={`font-semibold text-sm ${expiredDocs.length > 0 ? "text-red-800" : "text-amber-800"}`}>
              {expiredDocs.length > 0
                ? `${expiredDocs.length} compliance document(s) have EXPIRED`
                : `${expiringDocs.length} compliance document(s) expiring within 30 days`}
            </p>
            <Link href="/compliance" className="text-xs underline mt-0.5 text-gray-600 hover:text-gray-800">
              View compliance documents →
            </Link>
          </div>
        </div>
      )}

      {/* Summary Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Active Projects", value: contracts.length.toString(), icon: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10", color: "blue" },
          { label: "Contract Value", value: formatCurrency(totalContractValue), icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z", color: "green" },
          { label: "Billed to Date", value: formatCurrency(totalBilled), icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z", color: "blue" },
          { label: "Pending Approval", value: pendingApps.length.toString(), icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z", color: "amber" },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-gray-500 font-medium">{card.label}</p>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-${card.color}-100`}>
                <svg className={`w-4 h-4 text-${card.color}-600`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={card.icon} />
                </svg>
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Second row of cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500 font-medium mb-1">Retainage Held</p>
          <p className="text-2xl font-bold text-orange-600">{formatCurrency(totalRetainageHeld)}</p>
          <Link href="/retainage" className="text-xs text-blue-600 hover:underline mt-1 block">View retainage →</Link>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500 font-medium mb-1">Total Paid</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(totalPaid)}</p>
          <Link href="/history" className="text-xs text-blue-600 hover:underline mt-1 block">View history →</Link>
        </div>
      </div>

      {/* Project Overview */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">Project Overview</h2>
          <Link href="/projects" className="text-sm text-blue-600 hover:underline">View all →</Link>
        </div>
        <div className="divide-y divide-gray-50">
          {projectMetrics.length === 0 ? (
            <p className="text-gray-500 text-sm p-6 text-center">No projects assigned yet.</p>
          ) : (
            projectMetrics.map(({ contract, project, contractValue, grossBilled, retainageHeld, pctBilled, lastApproved, retainagePercent }) => {
              const days = lastApproved ? daysSince(lastApproved) : null;
              const chipColor =
                days === null ? "bg-gray-100 text-gray-600" :
                days <= 30 ? "bg-green-100 text-green-700" :
                days <= 60 ? "bg-amber-100 text-amber-700" :
                "bg-red-100 text-red-700";

              return (
                <div key={contract.id} className="px-6 py-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold text-gray-800">{project.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Contract #{project.contractNumber} · Retainage {retainagePercent}%
                      </p>
                    </div>
                    <div className="text-right flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${chipColor}`}>
                        {days === null ? "No payments" : `${days}d ago`}
                      </span>
                      <Link
                        href={`/billing?contractId=${contract.id}`}
                        className="text-xs bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Bill Now
                      </Link>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Billed: {formatCurrency(grossBilled)} of {formatCurrency(contractValue)}</span>
                      <span>{pctBilled.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all"
                        style={{ width: `${Math.min(pctBilled, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>Retainage held: {formatCurrency(retainageHeld)}</span>
                      <div className="h-2 bg-orange-100 rounded-full w-24 overflow-hidden inline-block align-middle mx-1">
                        <div
                          className="h-full bg-orange-400 rounded-full"
                          style={{ width: `${Math.min(pctBilled, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Pending Approvals */}
      {pendingApps.length > 0 && (
        <div className="bg-white rounded-xl border border-amber-200 bg-amber-50/30">
          <div className="px-6 py-4 border-b border-amber-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">Pending Approvals</h2>
            <Link href="/approvals" className="text-sm text-blue-600 hover:underline">View all →</Link>
          </div>
          <div className="divide-y divide-amber-50">
            {pendingApps.slice(0, 3).map((app) => (
              <div key={app.id} className="px-6 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    App #{app.appNumber} · {app.contract.project.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    Submitted {app.submittedAt ? new Date(app.submittedAt).toLocaleDateString() : "—"}
                  </p>
                </div>
                <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium">
                  Awaiting Review
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
