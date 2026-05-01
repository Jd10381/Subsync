import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const session = await auth();
  if (!session?.user) return null;

  const isGC = session.user.role === "GC" || session.user.role === "ADMIN";

  const contracts = await prisma.contract.findMany({
    where: isGC
      ? { project: { gcId: session.user.id } }
      : { subcontractorId: session.user.id },
    include: {
      project: { include: { gc: true } },
      subcontractor: true,
      sovLineItems: true,
      applications: {
        where: { status: { in: ["APPROVED", "PARTIAL_APPROVED"] } },
        include: { lineItems: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isGC ? "All Projects" : "My Projects"}
          </h1>
          <p className="text-gray-500 text-sm mt-1">{contracts.length} project(s) total</p>
        </div>
        {isGC && (
          <Link
            href="/admin"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            + New Project
          </Link>
        )}
      </div>

      <div className="grid gap-4">
        {contracts.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <p className="text-gray-500 text-sm">No projects assigned yet.</p>
          </div>
        ) : (
          contracts.map((contract) => {
            const grossBilled = contract.applications.reduce((sum, app) =>
              sum + app.lineItems.reduce((s, li) => s + li.thisPeriodAmt, 0), 0
            );
            const pctBilled = contract.value > 0 ? (grossBilled / contract.value) * 100 : 0;
            const retainageHeld = grossBilled * (contract.retainagePercent / 100);

            return (
              <div key={contract.id} className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="text-lg font-semibold text-gray-900">{contract.project.name}</h2>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        contract.project.status === "ACTIVE"
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-600"
                      }`}>
                        {contract.project.status}
                      </span>
                    </div>
                    {contract.project.address && (
                      <p className="text-sm text-gray-500">{contract.project.address}</p>
                    )}
                  </div>
                  {!isGC && (
                    <Link
                      href={`/billing?contractId=${contract.id}`}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                    >
                      Bill Now
                    </Link>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-gray-500">Contract Value</p>
                    <p className="font-semibold text-gray-800">{formatCurrency(contract.value)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Retainage</p>
                    <p className="font-semibold text-gray-800">{contract.retainagePercent}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Start Date</p>
                    <p className="font-semibold text-gray-800">
                      {contract.project.startDate ? formatDate(contract.project.startDate) : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">End Date</p>
                    <p className="font-semibold text-gray-800">
                      {contract.project.endDate ? formatDate(contract.project.endDate) : "—"}
                    </p>
                  </div>
                </div>

                {!isGC && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4 p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-xs text-gray-500">GC Contact</p>
                      <p className="text-sm font-medium text-gray-700">{contract.project.gcContact || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Superintendent</p>
                      <p className="text-sm font-medium text-gray-700">{contract.project.superintendent || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">GC Email</p>
                      <p className="text-sm font-medium text-gray-700">{contract.project.gcEmail || contract.project.gc.email}</p>
                    </div>
                  </div>
                )}

                {/* Progress */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Billed: {formatCurrency(grossBilled)}</span>
                    <span>{pctBilled.toFixed(1)}% complete</span>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${Math.min(pctBilled, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>Retainage held: {formatCurrency(retainageHeld)}</span>
                    <span>Balance: {formatCurrency(contract.value - grossBilled)}</span>
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                  <Link
                    href={`/history?contractId=${contract.id}`}
                    className="text-xs text-gray-600 hover:text-gray-800 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Pay History
                  </Link>
                  <Link
                    href={`/change-orders?contractId=${contract.id}`}
                    className="text-xs text-gray-600 hover:text-gray-800 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Change Orders
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
