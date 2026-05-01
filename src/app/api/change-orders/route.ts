import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isGC = session.user.role === "GC" || session.user.role === "ADMIN";

  const orders = await prisma.changeOrder.findMany({
    where: isGC
      ? { contract: { project: { gcId: session.user.id } } }
      : { subcontractorId: session.user.id },
    include: {
      contract: {
        include: { project: { select: { name: true, contractNumber: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(orders);
}
