"use client";

import { useState, useEffect } from "react";
import { formatCurrency } from "@/lib/utils";

interface Project {
  id: string;
  name: string;
  contractNumber: string | null;
  status: string;
  address: string | null;
  startDate: string | null;
  endDate: string | null;
  contracts: Array<{ value: number; subcontractor: { name: string | null; email: string; companyName: string | null } }>;
}

interface Sub {
  id: string;
  name: string | null;
  email: string;
  companyName: string | null;
  licenseNumber: string | null;
  complianceDocuments: Array<{ type: string; expiryDate: string; status: string }>;
}

type Tab = "projects" | "sov" | "subs";

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("projects");
  const [projects, setProjects] = useState<Project[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [loading, setLoading] = useState(true);

  // New project form
  const [projectForm, setProjectForm] = useState({
    name: "", contractNumber: "", address: "", superintendent: "",
    gcContact: "", gcEmail: "", startDate: "", endDate: "",
  });
  const [saving, setSaving] = useState(false);

  // Invite sub form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/projects").then(r => r.json()),
      fetch("/api/admin/subs").then(r => r.json()),
    ]).then(([p, s]) => {
      setProjects(p);
      setSubs(s);
      setLoading(false);
    });
  }, []);

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(projectForm),
      });
      if (res.ok) {
        const p = await res.json();
        setProjects(prev => [p, ...prev]);
        setProjectForm({ name: "", contractNumber: "", address: "", superintendent: "", gcContact: "", gcEmail: "", startDate: "", endDate: "" });
      }
    } finally {
      setSaving(false);
    }
  }

  async function inviteSub(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      const res = await fetch("/api/admin/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail }),
      });
      if (res.ok) {
        alert(`Invitation sent to ${inviteEmail}`);
        setInviteEmail("");
      } else {
        alert("Failed to send invitation.");
      }
    } finally {
      setInviting(false);
    }
  }

  const COMPLIANCE_STATUS_COLORS: Record<string, string> = {
    ACTIVE: "bg-green-100 text-green-700",
    EXPIRING_SOON: "bg-amber-100 text-amber-700",
    EXPIRED: "bg-red-100 text-red-700",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
        <p className="text-gray-500 text-sm mt-1">Manage projects, SOV, and subcontractors</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {([["projects", "Projects"], ["sov", "SOV Editor"], ["subs", "Subcontractors"]] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === key ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-800"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Projects Tab */}
      {tab === "projects" && (
        <div className="space-y-4">
          {/* Create form */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-800 mb-4">Create New Project</h2>
            <form onSubmit={createProject} className="grid grid-cols-2 gap-4">
              {[
                { key: "name", label: "Project Name", required: true },
                { key: "contractNumber", label: "Contract Number" },
                { key: "address", label: "Project Address" },
                { key: "superintendent", label: "Superintendent" },
                { key: "gcContact", label: "GC Contact Name" },
                { key: "gcEmail", label: "GC Contact Email" },
              ].map(({ key, label, required }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                  <input
                    type={key === "gcEmail" ? "email" : "text"}
                    value={projectForm[key as keyof typeof projectForm]}
                    onChange={(e) => setProjectForm(prev => ({ ...prev, [key]: e.target.value }))}
                    required={required}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input type="date" value={projectForm.startDate}
                  onChange={(e) => setProjectForm(prev => ({ ...prev, startDate: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input type="date" value={projectForm.endDate}
                  onChange={(e) => setProjectForm(prev => ({ ...prev, endDate: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="col-span-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-blue-400"
                >
                  {saving ? "Creating..." : "Create Project"}
                </button>
              </div>
            </form>
          </div>

          {/* Project list */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-5 py-3 text-left">Project</th>
                  <th className="px-5 py-3 text-left">Contract #</th>
                  <th className="px-5 py-3 text-left">Status</th>
                  <th className="px-5 py-3 text-left">Subcontractors</th>
                  <th className="px-5 py-3 text-right">Total Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={5} className="text-center py-8 text-gray-400">Loading...</td></tr>
                ) : projects.map((p) => {
                  const totalValue = p.contracts.reduce((s, c) => s + c.value, 0);
                  return (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3">
                        <p className="font-medium text-gray-800">{p.name}</p>
                        {p.address && <p className="text-xs text-gray-400">{p.address}</p>}
                      </td>
                      <td className="px-5 py-3 text-gray-600">{p.contractNumber || "—"}</td>
                      <td className="px-5 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          p.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                        }`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-600 text-xs">
                        {p.contracts.map(c => c.subcontractor.companyName || c.subcontractor.name).join(", ") || "—"}
                      </td>
                      <td className="px-5 py-3 text-right font-mono font-medium">{formatCurrency(totalValue)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SOV Editor Tab */}
      {tab === "sov" && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-800 mb-2">SOV Editor</h2>
          <p className="text-sm text-gray-500 mb-4">Select a contract to add or edit SOV line items.</p>
          <div className="space-y-3">
            {projects.map((p) =>
              p.contracts.map((c, ci) => (
                <a
                  key={ci}
                  href={`/admin/sov?contractId=${p.id}`}
                  className="block p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors"
                >
                  <p className="font-medium text-gray-800">{p.name}</p>
                  <p className="text-xs text-gray-500">
                    {c.subcontractor.companyName || c.subcontractor.name} · {formatCurrency(c.value)}
                  </p>
                </a>
              ))
            )}
          </div>
        </div>
      )}

      {/* Subcontractors Tab */}
      {tab === "subs" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-800 mb-4">Invite Subcontractor</h2>
            <form onSubmit={inviteSub} className="flex gap-3">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="sub@company.com"
                required
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                disabled={inviting}
                className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-blue-400"
              >
                {inviting ? "Sending..." : "Invite"}
              </button>
            </form>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-5 py-3 text-left">Company</th>
                  <th className="px-5 py-3 text-left">Email</th>
                  <th className="px-5 py-3 text-left">License #</th>
                  <th className="px-5 py-3 text-left">COI Status</th>
                  <th className="px-5 py-3 text-left">License Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={5} className="text-center py-8 text-gray-400">Loading...</td></tr>
                ) : subs.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-8 text-gray-500">No subcontractors yet.</td></tr>
                ) : subs.map((sub) => {
                  const coi = sub.complianceDocuments.find(d => d.type === "COI");
                  const lic = sub.complianceDocuments.find(d => d.type === "LICENSE");
                  return (
                    <tr key={sub.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-gray-800">
                        {sub.companyName || sub.name || "—"}
                      </td>
                      <td className="px-5 py-3 text-gray-600">{sub.email}</td>
                      <td className="px-5 py-3 text-gray-600 font-mono text-xs">{sub.licenseNumber || "—"}</td>
                      <td className="px-5 py-3">
                        {coi ? (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${COMPLIANCE_STATUS_COLORS[coi.status] || "bg-gray-100 text-gray-600"}`}>
                            {coi.status.replace("_", " ")} · Exp {new Date(coi.expiryDate).toLocaleDateString()}
                          </span>
                        ) : <span className="text-xs text-gray-400">No COI</span>}
                      </td>
                      <td className="px-5 py-3">
                        {lic ? (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${COMPLIANCE_STATUS_COLORS[lic.status] || "bg-gray-100 text-gray-600"}`}>
                            {lic.status.replace("_", " ")} · Exp {new Date(lic.expiryDate).toLocaleDateString()}
                          </span>
                        ) : <span className="text-xs text-gray-400">No record</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
