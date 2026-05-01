import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { message } = await req.json();

  if (!message?.trim()) return NextResponse.json({ error: "Message required" }, { status: 400 });

  const comment = await prisma.comment.create({
    data: { applicationId: id, userId: session.user.id, message },
    include: { user: { select: { name: true, email: true } } },
  });

  return NextResponse.json(comment);
}
