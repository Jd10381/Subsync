import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isGC = session.user.role === "GC" || session.user.role === "ADMIN";

  const contracts = await prisma.contract.findMany({
    where: isGC
      ? { project: { gcId: session.user.id } }
      : { subcontractorId: session.user.id },
    include: {
      project: { select: { id: true, name: true, contractNumber: true } },
      sovLineItems: { orderBy: { order: "asc" } },
      applications: {
        where: { status: { not: "DRAFT" } },
        include: { lineItems: true },
        orderBy: { appNumber: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(contracts);
}
