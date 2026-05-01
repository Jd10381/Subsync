import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isGC = session.user.role === "GC" || session.user.role === "ADMIN";
  if (!isGC) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const applications = await prisma.billingApplication.findMany({
    where: { contract: { project: { gcId: session.user.id } } },
    include: {
      contract: {
        include: {
          project: { select: { name: true, contractNumber: true } },
          subcontractor: { select: { name: true, email: true, companyName: true } },
        },
      },
      lineItems: { select: { thisPeriodAmt: true } },
      comments: {
        include: { user: { select: { name: true, email: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { submittedAt: "desc" },
  });

  return NextResponse.json(applications);
}
