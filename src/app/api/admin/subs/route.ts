import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isGC = session.user.role === "GC" || session.user.role === "ADMIN";
  if (!isGC) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const subs = await prisma.user.findMany({
    where: {
      role: "SUBCONTRACTOR",
      contracts: { some: { project: { gcId: session.user.id } } },
    },
    include: {
      complianceDocuments: {
        select: { type: true, expiryDate: true, status: true },
        orderBy: { expiryDate: "asc" },
      },
    },
  });

  return NextResponse.json(subs);
}
