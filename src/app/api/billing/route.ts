import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { contractId, periodMonth, periodYear, rows, lienWaiverAccepted, signedByName, signedAt, netDue } = body;

  if (!contractId || !rows?.length) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: { applications: { orderBy: { appNumber: "desc" }, take: 1 } },
  });

  if (!contract) return NextResponse.json({ error: "Contract not found" }, { status: 404 });

  if (contract.subcontractorId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const lastAppNumber = contract.applications[0]?.appNumber ?? 0;

  const application = await prisma.billingApplication.create({
    data: {
      contractId,
      periodMonth,
      periodYear,
      appNumber: lastAppNumber + 1,
      status: "SUBMITTED",
      submittedAt: new Date(),
      signedAt: signedAt ? new Date(signedAt) : null,
      signedByName,
      lienWaiverAccepted,
      lienWaiverType: lienWaiverAccepted ? "Conditional" : null,
      netDue,
      lineItems: {
        create: rows.map((row: { sovId: string; previousBilledPct: number; thisPeriodPct: number; thisPeriodAmt: number }) => ({
          sovLineItemId: row.sovId,
          previousBilledPct: row.previousBilledPct,
          thisPeriodPct: row.thisPeriodPct,
          thisPeriodAmt: row.thisPeriodAmt,
        })),
      },
    },
  });

  // Notify GC
  const gc = await prisma.user.findFirst({
    where: { gcProjects: { some: { contracts: { some: { id: contractId } } } } },
  });
  if (gc) {
    await prisma.notification.create({
      data: {
        userId: gc.id,
        title: "New Billing Application",
        body: `Pay Application #${lastAppNumber + 1} submitted for review.`,
        link: "/approvals",
      },
    });
  }

  return NextResponse.json(application);
}
