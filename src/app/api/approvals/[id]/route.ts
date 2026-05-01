import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isGC = session.user.role === "GC" || session.user.role === "ADMIN";
  if (!isGC) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { status, gcComment } = await req.json();

  const validStatuses = ["APPROVED", "PARTIAL_APPROVED", "REJECTED"];
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const app = await prisma.billingApplication.findUnique({
    where: { id },
    include: { contract: { include: { subcontractor: true, project: true } } },
  });

  if (!app) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.billingApplication.update({
    where: { id },
    data: {
      status,
      gcComment,
      approvedAt: status === "APPROVED" || status === "PARTIAL_APPROVED" ? new Date() : undefined,
      rejectedAt: status === "REJECTED" ? new Date() : undefined,
    },
  });

  // Notify subcontractor
  const statusLabel = status === "APPROVED" ? "approved" : status === "PARTIAL_APPROVED" ? "partially approved" : "rejected";
  await prisma.notification.create({
    data: {
      userId: app.contract.subcontractorId,
      title: `Pay Application ${statusLabel.charAt(0).toUpperCase() + statusLabel.slice(1)}`,
      body: `App #${app.appNumber} for ${app.contract.project.name} has been ${statusLabel}.${gcComment ? ` Note: ${gcComment}` : ""}`,
      link: `/history`,
    },
  });

  // Email notification
  if (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== "re_placeholder_key") {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: "billing@pipepay.app",
        to: app.contract.subcontractor.email,
        subject: `Pay Application #${app.appNumber} ${statusLabel} — ${app.contract.project.name}`,
        html: `<p>Your pay application #${app.appNumber} has been ${statusLabel}.</p>${gcComment ? `<p>GC Comment: ${gcComment}</p>` : ""}`,
      });
    } catch {}
  }

  return NextResponse.json(updated);
}
