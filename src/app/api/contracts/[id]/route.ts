import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const contract = await prisma.contract.findUnique({
    where: { id },
    include: {
      project: {
        include: {
          gc: { select: { name: true, email: true, companyName: true } },
        },
      },
      subcontractor: {
        select: {
          name: true,
          email: true,
          companyName: true,
          licenseNumber: true,
          address: true,
          phone: true,
        },
      },
      sovLineItems: { orderBy: { order: "asc" } },
      applications: {
        where: { status: { not: "DRAFT" } },
        orderBy: { appNumber: "desc" },
      },
    },
  });

  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(contract);
}
