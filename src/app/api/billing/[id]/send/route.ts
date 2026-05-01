import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const app = await prisma.billingApplication.findUnique({
    where: { id },
    include: {
      contract: {
        include: {
          project: { include: { gc: true } },
          subcontractor: true,
        },
      },
    },
  });

  if (!app) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Log email notification (email sending requires RESEND_API_KEY)
  const gcEmail = app.contract.project.gc.email;
  console.log(`[Email] Sending invoice to GC: ${gcEmail} for App #${app.appNumber}`);

  if (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== "re_placeholder_key") {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: "billing@pipepay.app",
        to: gcEmail,
        subject: `Pay Application #${app.appNumber} — ${app.contract.project.name}`,
        html: `
          <h2>New Billing Application Submitted</h2>
          <p><strong>Project:</strong> ${app.contract.project.name}</p>
          <p><strong>App #:</strong> ${app.appNumber}</p>
          <p><strong>Subcontractor:</strong> ${app.contract.subcontractor.companyName || app.contract.subcontractor.name}</p>
          <p><strong>Net Amount Due:</strong> $${app.netDue?.toFixed(2)}</p>
          <p>Please log in to PipePay to review and approve.</p>
        `,
      });
    } catch (err) {
      console.error("Email send error:", err);
    }
  }

  return NextResponse.json({ success: true });
}
