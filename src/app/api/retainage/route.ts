import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const contracts = await prisma.contract.findMany({
    where: { subcontractorId: session.user.id },
    include: {
      project: { select: { name: true, contractNumber: true } },
      applications: {
        where: { status: { in: ["APPROVED", "PARTIAL_APPROVED"] } },
        include: { lineItems: true },
      },
    },
  });

  const data = contracts.map((contract) => {
    const grossBilled = contract.applications.reduce(
      (s, a) => s + a.lineItems.reduce((ss, li) => ss + li.thisPeriodAmt, 0),
      0
    );
    const retainageHeld = grossBilled * (contract.retainagePercent / 100);
    const pctComplete = contract.value > 0 ? (grossBilled / contract.value) * 100 : 0;

    let eligibility: string;
    if (pctComplete >= 95) {
      eligibility = "✓ 95%+ complete — eligible for full retainage release upon substantial completion and final lien waiver.";
    } else if (pctComplete >= 50) {
      eligibility = `✓ ${pctComplete.toFixed(0)}% complete — eligible for partial retainage release (up to 50% of held amount). Request from GC.`;
    } else {
      eligibility = `Contract is ${pctComplete.toFixed(0)}% complete. Retainage release becomes available at 50% project completion.`;
    }

    return {
      contractId: contract.id,
      projectName: contract.project.name,
      contractNumber: contract.project.contractNumber,
      contractValue: contract.value,
      retainagePercent: contract.retainagePercent,
      grossBilled,
      retainageHeld,
      pctComplete,
      eligibility,
    };
  });

  return NextResponse.json(data);
}
