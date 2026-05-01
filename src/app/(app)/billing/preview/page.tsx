"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { formatCurrency, monthName } from "@/lib/utils";

interface PreviewData {
  rows: Array<{
    sovId: string;
    description: string;
    scheduledValue: number;
    previousBilledPct: number;
    thisPeriodPct: number;
    thisPeriodAmt: number;
    totalPct: number;
    balance: number;
  }>;
  lienWaiverAccepted: boolean;
  signedByName: string;
  signedAt: string | null;
  netDue: number;
  retainageAmt: number;
  totals: { scheduledValue: number; thisPeriodAmt: number; previousBilled: number };
  contract?: {
    id: string;
    value: number;
    retainagePercent: number;
    project: {
      name: string;
      contractNumber: string | null;
      address: string | null;
      gcContact: string | null;
      gcEmail: string | null;
      gc: { name: string | null; email: string; companyName: string | null };
    };
    subcontractor: {
      name: string | null;
      email: string;
      companyName: string | null;
      licenseNumber: string | null;
      address: string | null;
      phone: string | null;
    };
    applications: Array<{ appNumber: number; status: string }>;
  };
  applicationId?: string;
  appNumber?: number;
  periodMonth?: number;
  periodYear?: number;
  status?: string;
}

export default function BillingPreviewPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const invoiceRef = useRef<HTMLDivElement>(null);

  const contractId = searchParams.get("contractId");
  const month = searchParams.get("month");
  const year = searchParams.get("year");
  const applicationId = searchParams.get("applicationId");

  const [data, setData] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    async function load() {
      if (applicationId) {
        const res = await fetch(`/api/billing/${applicationId}`);
        if (res.ok) {
          const appData = await res.json();
          setData(appData);
        }
      } else {
        const stored = sessionStorage.getItem("billingPreview");
        if (stored) {
          const preview = JSON.parse(stored);
          if (contractId) {
            const res = await fetch(`/api/contracts/${contractId}`);
            if (res.ok) {
              const contract = await res.json();
              setData({ ...preview, contract, periodMonth: Number(month), periodYear: Number(year) });
            }
          }
        }
      }
      setLoading(false);
    }
    load();
  }, [applicationId, contractId, month, year]);

  async function downloadPDF() {
    const html2pdf = (await import("html2pdf.js")).default;
    const element = invoiceRef.current;
    if (!element) return;

    const opt = {
      margin: [10, 10, 10, 10] as [number, number, number, number],
      filename: `pipepay-invoice-app${data?.appNumber || ""}.pdf`,
      image: { type: "jpeg" as const, quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "mm", format: "letter", orientation: "portrait" as const },
    };

    html2pdf().set(opt).from(element).save();
  }

  async function submitToGC() {
    if (!applicationId) {
      alert("Please submit the billing application first.");
      router.push("/billing");
      return;
    }
    setSending(true);
    try {
      await fetch(`/api/billing/${applicationId}/send`, { method: "POST" });
      alert("Invoice sent to GC successfully.");
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">No preview data found.</p>
        <button onClick={() => router.back()} className="mt-4 text-blue-600 hover:underline text-sm">
          ← Go back
        </button>
      </div>
    );
  }

  const contract = data.contract;
  const appNumber = data.appNumber ?? 1;
  const pMonth = data.periodMonth ?? Number(month);
  const pYear = data.periodYear ?? Number(year);

  return (
    <div className="space-y-4">
      {/* Action Bar */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoice Preview</h1>
          <p className="text-gray-500 text-sm mt-1">Application #{appNumber} · {monthName(pMonth)} {pYear}</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => router.back()}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50"
          >
            ← Back
          </button>
          <button
            onClick={downloadPDF}
            className="px-4 py-2 border border-blue-600 text-blue-600 rounded-lg text-sm hover:bg-blue-50 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download PDF
          </button>
          <button
            onClick={submitToGC}
            disabled={sending}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:bg-blue-400"
          >
            {sending ? "Sending..." : "Submit & Send to GC"}
          </button>
        </div>
      </div>

      {/* Invoice */}
      <div ref={invoiceRef} className="bg-white rounded-xl border border-gray-200 p-10 max-w-4xl mx-auto shadow-sm print:shadow-none print:border-none">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 pb-6 border-b-2 border-blue-600">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
              </div>
              <span className="text-2xl font-bold text-gray-900">PipePay</span>
            </div>
            <p className="text-gray-500 text-xs">Plumbing Subcontractor Billing Portal</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-blue-600">PAY APPLICATION</p>
            <p className="text-gray-600 text-sm font-medium">No. {String(appNumber).padStart(3, "0")}</p>
          </div>
        </div>

        {/* Meta Info */}
        <div className="grid grid-cols-3 gap-4 mb-6 text-sm">
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wide">Project</p>
            <p className="font-semibold text-gray-800">{contract?.project.name || "—"}</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wide">Billing Period</p>
            <p className="font-semibold text-gray-800">{monthName(pMonth)} {pYear}</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wide">Contract #</p>
            <p className="font-semibold text-gray-800">{contract?.project.contractNumber || "—"}</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wide">Date</p>
            <p className="font-semibold text-gray-800">{new Date().toLocaleDateString()}</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wide">Status</p>
            <p className="font-semibold text-gray-800">{data.status || "DRAFT"}</p>
          </div>
        </div>

        {/* Two-column party info */}
        <div className="grid grid-cols-2 gap-6 mb-6 p-4 bg-gray-50 rounded-lg">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Subcontractor</p>
            <p className="font-bold text-gray-800">{contract?.subcontractor.companyName || contract?.subcontractor.name || "—"}</p>
            <p className="text-sm text-gray-600">{contract?.subcontractor.address || "—"}</p>
            <p className="text-sm text-gray-600">{contract?.subcontractor.email}</p>
            {contract?.subcontractor.phone && <p className="text-sm text-gray-600">{contract.subcontractor.phone}</p>}
            {contract?.subcontractor.licenseNumber && (
              <p className="text-xs text-gray-400 mt-1">Lic #{contract.subcontractor.licenseNumber}</p>
            )}
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">General Contractor</p>
            <p className="font-bold text-gray-800">{contract?.project.gc.companyName || contract?.project.gc.name || "—"}</p>
            <p className="text-sm text-gray-600">{contract?.project.gcContact || contract?.project.gc.name || "—"}</p>
            <p className="text-sm text-gray-600">{contract?.project.gcEmail || contract?.project.gc.email}</p>
            <p className="text-sm text-gray-600">{contract?.project.address || "—"}</p>
          </div>
        </div>

        {/* SOV Table */}
        <table className="w-full text-xs mb-6">
          <thead>
            <tr className="bg-blue-600 text-white">
              <th className="px-3 py-2 text-left w-8">#</th>
              <th className="px-3 py-2 text-left">Description of Work</th>
              <th className="px-3 py-2 text-right">Scheduled Value</th>
              <th className="px-3 py-2 text-right">Prev %</th>
              <th className="px-3 py-2 text-right">This Period %</th>
              <th className="px-3 py-2 text-right">This Period $</th>
              <th className="px-3 py-2 text-right">Total %</th>
              <th className="px-3 py-2 text-right">Balance</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, idx) => (
              <tr key={row.sovId} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                <td className="px-3 py-2 text-gray-500">{idx + 1}</td>
                <td className="px-3 py-2 text-gray-800">{row.description}</td>
                <td className="px-3 py-2 text-right text-gray-700 font-mono">{formatCurrency(row.scheduledValue)}</td>
                <td className="px-3 py-2 text-right text-gray-600">{row.previousBilledPct.toFixed(1)}%</td>
                <td className="px-3 py-2 text-right text-gray-700">{row.thisPeriodPct.toFixed(1)}%</td>
                <td className="px-3 py-2 text-right font-medium text-gray-800 font-mono">{formatCurrency(row.thisPeriodAmt)}</td>
                <td className="px-3 py-2 text-right text-gray-700">{row.totalPct.toFixed(1)}%</td>
                <td className="px-3 py-2 text-right text-gray-600 font-mono">{formatCurrency(row.balance)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
              <td colSpan={2} className="px-3 py-2 text-gray-800">TOTALS</td>
              <td className="px-3 py-2 text-right font-mono">{formatCurrency(data.totals.scheduledValue)}</td>
              <td colSpan={2} />
              <td className="px-3 py-2 text-right font-mono text-blue-700">{formatCurrency(data.totals.thisPeriodAmt)}</td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>

        {/* Totals Block */}
        <div className="flex justify-end mb-6">
          <div className="w-72 space-y-1 text-sm">
            <div className="flex justify-between py-1">
              <span className="text-gray-600">Gross Amount This Period</span>
              <span className="font-medium">{formatCurrency(data.totals.thisPeriodAmt)}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-gray-600">Less Retainage ({contract?.retainagePercent ?? 10}%)</span>
              <span className="font-medium text-orange-600">-{formatCurrency(data.retainageAmt)}</span>
            </div>
            <div className="flex justify-between py-2 px-3 bg-blue-600 text-white rounded-lg mt-2">
              <span className="font-bold">Net Amount Due</span>
              <span className="font-bold">{formatCurrency(data.netDue)}</span>
            </div>
          </div>
        </div>

        {/* Certification */}
        <div className="border border-gray-200 rounded-lg p-4 mb-6 text-xs text-gray-600 leading-relaxed">
          <p className="font-semibold text-gray-800 mb-2">CERTIFICATION</p>
          <p>
            The undersigned Contractor certifies that to the best of the Contractor&apos;s knowledge, information and belief the Work covered by this Application for Payment has been completed in accordance with the Contract Documents, that all amounts have been paid by the Contractor for Work for which previous Certificates for Payment were issued and payments received from the Owner, and that current payment shown herein is now due.
          </p>
        </div>

        {/* Signature Lines */}
        <div className="grid grid-cols-2 gap-8 text-sm">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">Subcontractor</p>
            {data.signedAt ? (
              <div>
                <p className="font-medium text-gray-800 border-b border-gray-400 pb-1">{data.signedByName}</p>
                <p className="text-xs text-gray-500 mt-1">Digitally signed · {new Date(data.signedAt).toLocaleString()}</p>
              </div>
            ) : (
              <div>
                <div className="border-b border-gray-400 h-8" />
                <p className="text-xs text-gray-400 mt-1">Signature / Date</p>
              </div>
            )}
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">General Contractor Approval</p>
            <div className="border-b border-gray-400 h-8" />
            <p className="text-xs text-gray-400 mt-1">Signature / Date</p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-gray-200 flex justify-between text-xs text-gray-400">
          <span>
            {contract?.subcontractor.licenseNumber
              ? `License #${contract.subcontractor.licenseNumber}`
              : "PipePay Billing Portal"}
          </span>
          <span>Payment terms: Net 30 days from GC approval</span>
        </div>
      </div>
    </div>
  );
}
