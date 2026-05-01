import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { contractId, amount } = await req.json();

  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: { project: { include: { gc: true } } },
  });

  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Notify GC
  await prisma.notification.create({
    data: {
      userId: contract.project.gcId,
      title: "Retainage Release Request",
      body: `${session.user.name || "Subcontractor"} requested retainage release of $${amount.toFixed(2)} for ${contract.project.name}.`,
      link: "/approvals",
    },
  });

  return NextResponse.json({ success: true });
}
