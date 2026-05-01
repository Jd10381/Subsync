import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const co = await prisma.changeOrder.findUnique({ where: { id } });
  if (!co) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (co.subcontractorId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updated = await prisma.changeOrder.update({
    where: { id },
    data: { subSignedAt: new Date() },
  });

  return NextResponse.json(updated);
}
