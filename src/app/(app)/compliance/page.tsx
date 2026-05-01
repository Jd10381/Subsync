import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { daysUntil, formatDate } from "@/lib/utils";
import ComplianceUpload from "@/components/ComplianceUpload";

export const dynamic = "force-dynamic";

const DOC_LABELS: Record<string, string> = {
  COI: "Certificate of Insurance",
  LICENSE: "License",
  BOND: "Bond",
  WORKERS_COMP: "Workers' Comp",
  OTHER: "Other",
};

export default async function CompliancePage() {
  const session = await auth();
  if (!session?.user) return null;

  const docs = await prisma.complianceDocument.findMany({
    where: { userId: session.user.id },
    orderBy: { expiryDate: "asc" },
  });

  const payrolls = await prisma.certifiedPayroll.findMany({
    where: { userId: session.user.id },
    include: { project: { select: { name: true } } },
    orderBy: { weekEnding: "desc" },
  });

  const expiring = docs.filter((d) => daysUntil(d.expiryDate) >= 0 && daysUntil(d.expiryDate) <= 30);
  const expired = docs.filter((d) => daysUntil(d.expiryDate) < 0);

  function getStatusBadge(days: number) {
    if (days < 0) return { label: "EXPIRED", class: "bg-red-100 text-red-700" };
    if (days <= 30) return { label: "EXPIRING SOON", class: "bg-amber-100 text-amber-700" };
    return { label: "ACTIVE", class: "bg-green-100 text-green-700" };
  }

  const PAYROLL_STATUS: Record<string, string> = {
    PENDING: "bg-yellow-100 text-yellow-700",
    SUBMITTED: "bg-blue-100 text-blue-700",
    APPROVED: "bg-green-100 text-green-700",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Compliance</h1>
        <p className="text-gray-500 text-sm mt-1">Insurance, licenses, and certified payroll management</p>
      </div>

      {/* Alert Banner */}
      {(expiring.length > 0 || expired.length > 0) && (
        <div className={`rounded-xl p-4 border flex items-start gap-3 ${expired.length > 0 ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"}`}>
          <svg className={`w-5 h-5 mt-0.5 ${expired.length > 0 ? "text-red-500" : "text-amber-500"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            {expired.length > 0 && (
              <p className="font-semibold text-red-800 text-sm">
                {expired.length} document(s) have EXPIRED — action required immediately
              </p>
            )}
            {expiring.length > 0 && (
              <p className="font-semibold text-amber-800 text-sm">
                {expiring.length} document(s) expiring within 30 days
              </p>
            )}
          </div>
        </div>
      )}

      {/* Insurance & Licenses */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">Insurance & Licenses</h2>
          <ComplianceUpload />
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <th className="px-5 py-3 text-left">Document Type</th>
              <th className="px-5 py-3 text-left">Carrier / Issuer</th>
              <th className="px-5 py-3 text-left">Policy #</th>
              <th className="px-5 py-3 text-left">Expiry Date</th>
              <th className="px-5 py-3 text-right">Days Left</th>
              <th className="px-5 py-3 text-left">Status</th>
              <th className="px-5 py-3 text-center">File</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {docs.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-500">No compliance documents on file.</td></tr>
            ) : docs.map((doc) => {
              const days = daysUntil(doc.expiryDate);
              const badge = getStatusBadge(days);
              return (
                <tr key={doc.id} className={`hover:bg-gray-50 ${days < 0 ? "bg-red-50/30" : days <= 30 ? "bg-amber-50/30" : ""}`}>
                  <td className="px-5 py-3 font-medium text-gray-800">{DOC_LABELS[doc.type] || doc.type}</td>
                  <td className="px-5 py-3 text-gray-600">{doc.carrier || "—"}</td>
                  <td className="px-5 py-3 text-gray-600 font-mono text-xs">{doc.policyNumber || "—"}</td>
                  <td className="px-5 py-3 text-gray-600">{formatDate(doc.expiryDate)}</td>
                  <td className={`px-5 py-3 text-right font-bold ${days < 0 ? "text-red-600" : days <= 30 ? "text-amber-600" : "text-green-600"}`}>
                    {days < 0 ? `${Math.abs(days)}d ago` : `${days}d`}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.class}`}>
                      {badge.label}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-center">
                    {doc.fileUrl ? (
                      <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer"
                        className="text-blue-600 hover:underline text-xs">
                        View
                      </a>
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Certified Payroll */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Certified Payroll</h2>
          <p className="text-xs text-gray-500 mt-0.5">Weekly payroll submissions per project</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <th className="px-5 py-3 text-left">Project</th>
              <th className="px-5 py-3 text-left">Week Ending</th>
              <th className="px-5 py-3 text-right">Employees</th>
              <th className="px-5 py-3 text-right">Total Wages</th>
              <th className="px-5 py-3 text-left">Status</th>
              <th className="px-5 py-3 text-center">File</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {payrolls.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8 text-gray-500">No payroll records submitted.</td></tr>
            ) : payrolls.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-5 py-3 text-gray-800">{p.project.name}</td>
                <td className="px-5 py-3 text-gray-600">{formatDate(p.weekEnding)}</td>
                <td className="px-5 py-3 text-right text-gray-700">{p.employeeCount}</td>
                <td className="px-5 py-3 text-right font-mono text-gray-800">
                  {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(p.totalWages)}
                </td>
                <td className="px-5 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PAYROLL_STATUS[p.status] || "bg-gray-100 text-gray-600"}`}>
                    {p.status}
                  </span>
                </td>
                <td className="px-5 py-3 text-center">
                  {p.fileUrl ? (
                    <a href={p.fileUrl} target="_blank" rel="noopener noreferrer"
                      className="text-blue-600 hover:underline text-xs">
                      View
                    </a>
                  ) : (
                    <span className="text-gray-400 text-xs">No file</span>
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
