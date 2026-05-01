import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { type, carrier, policyNumber, expiryDate, fileUrl } = await req.json();

  if (!expiryDate) return NextResponse.json({ error: "Expiry date required" }, { status: 400 });

  const expiry = new Date(expiryDate);
  const daysLeft = Math.floor((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const status = daysLeft < 0 ? "EXPIRED" : daysLeft <= 30 ? "EXPIRING_SOON" : "ACTIVE";

  const doc = await prisma.complianceDocument.create({
    data: {
      userId: session.user.id,
      type,
      carrier,
      policyNumber,
      expiryDate: expiry,
      fileUrl: fileUrl || null,
      status,
    },
  });

  return NextResponse.json(doc);
}
