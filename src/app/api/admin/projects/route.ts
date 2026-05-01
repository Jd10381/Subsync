import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isGC = session.user.role === "GC" || session.user.role === "ADMIN";
  if (!isGC) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const projects = await prisma.project.findMany({
    where: { gcId: session.user.id },
    include: {
      contracts: {
        include: {
          subcontractor: { select: { name: true, email: true, companyName: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(projects);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isGC = session.user.role === "GC" || session.user.role === "ADMIN";
  if (!isGC) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, contractNumber, address, superintendent, gcContact, gcEmail, startDate, endDate } = await req.json();

  if (!name) return NextResponse.json({ error: "Project name required" }, { status: 400 });

  const project = await prisma.project.create({
    data: {
      name,
      contractNumber,
      address,
      superintendent,
      gcContact,
      gcEmail,
      gcId: session.user.id,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
    },
    include: { contracts: { include: { subcontractor: { select: { name: true, email: true, companyName: true } } } } },
  });

  return NextResponse.json(project);
}
