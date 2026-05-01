import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const app = await prisma.billingApplication.findUnique({
    where: { id },
    include: {
      contract: {
        include: {
          project: {
            include: {
              gc: { select: { name: true, email: true, companyName: true } },
            },
          },
          subcontractor: {
            select: {
              name: true, email: true, companyName: true,
              licenseNumber: true, address: true, phone: true,
            },
          },
        },
      },
      lineItems: {
        include: { sovLineItem: true },
      },
      comments: {
        include: { user: { select: { name: true, email: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!app) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Build preview-compatible response
  const rows = app.lineItems.map((li) => ({
    sovId: li.sovLineItemId,
    description: li.sovLineItem.description,
    scheduledValue: li.sovLineItem.scheduledValue,
    previousBilledPct: li.previousBilledPct,
    thisPeriodPct: li.thisPeriodPct,
    thisPeriodAmt: li.thisPeriodAmt,
    totalPct: li.previousBilledPct + li.thisPeriodPct,
    balance: li.sovLineItem.scheduledValue * (1 - (li.previousBilledPct + li.thisPeriodPct) / 100),
  }));

  const totals = {
    scheduledValue: rows.reduce((s, r) => s + r.scheduledValue, 0),
    thisPeriodAmt: rows.reduce((s, r) => s + r.thisPeriodAmt, 0),
    previousBilled: rows.reduce((s, r) => s + (r.scheduledValue * r.previousBilledPct) / 100, 0),
  };

  const retainageAmt = totals.thisPeriodAmt * (app.contract.retainagePercent / 100);

  return NextResponse.json({
    applicationId: app.id,
    appNumber: app.appNumber,
    periodMonth: app.periodMonth,
    periodYear: app.periodYear,
    status: app.status,
    signedByName: app.signedByName,
    signedAt: app.signedAt,
    lienWaiverAccepted: app.lienWaiverAccepted,
    netDue: app.netDue,
    rows,
    totals,
    retainageAmt,
    contract: app.contract,
    comments: app.comments,
  });
}
