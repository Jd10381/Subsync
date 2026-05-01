import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://pipepay:pipepay123@localhost:5432/pipepay";
const adapter = new PrismaPg({ connectionString: DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding PipePay database...");

  // Clean up
  await prisma.billingLineItem.deleteMany();
  await prisma.billingApplication.deleteMany();
  await prisma.changeOrder.deleteMany();
  await prisma.complianceDocument.deleteMany();
  await prisma.certifiedPayroll.deleteMany();
  await prisma.sovLineItem.deleteMany();
  await prisma.contract.deleteMany();
  await prisma.project.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();

  // Users
  const gcPassword = await bcrypt.hash("admin123", 10);
  const subPassword = await bcrypt.hash("sub123", 10);

  const gc = await prisma.user.create({
    data: {
      email: "admin@apexconstruction.com",
      name: "James Apex",
      password: gcPassword,
      role: "GC",
      companyName: "Apex Construction Group",
      phone: "(555) 100-2000",
      address: "1200 Builder Way, Phoenix, AZ 85001",
    },
  });

  const sub = await prisma.user.create({
    data: {
      email: "mike@metroplumbing.com",
      name: "Mike Metro",
      password: subPassword,
      role: "SUBCONTRACTOR",
      companyName: "Metro Plumbing Co.",
      licenseNumber: "AZ-PLB-20245",
      phone: "(555) 200-3000",
      address: "420 Pipe Lane, Scottsdale, AZ 85251",
    },
  });

  console.log("Created users:", gc.email, sub.email);

  // Projects
  const project1 = await prisma.project.create({
    data: {
      name: "Riverside Medical Center",
      gcId: gc.id,
      contractNumber: "RMC-2025-001",
      address: "1500 Riverside Dr, Phoenix, AZ 85007",
      superintendent: "Bob Johnson",
      gcContact: "James Apex",
      gcEmail: gc.email,
      startDate: new Date("2025-01-15"),
      endDate: new Date("2026-06-30"),
      status: "ACTIVE",
    },
  });

  const project2 = await prisma.project.create({
    data: {
      name: "Sunbelt Office Complex",
      gcId: gc.id,
      contractNumber: "SOC-2025-002",
      address: "890 Corporate Blvd, Tempe, AZ 85281",
      superintendent: "Linda Torres",
      gcContact: "James Apex",
      gcEmail: gc.email,
      startDate: new Date("2025-03-01"),
      endDate: new Date("2025-12-31"),
      status: "ACTIVE",
    },
  });

  const project3 = await prisma.project.create({
    data: {
      name: "Desert View Apartments",
      gcId: gc.id,
      contractNumber: "DVA-2024-003",
      address: "220 Desert View Blvd, Mesa, AZ 85201",
      superintendent: "Carlos Reyes",
      gcContact: "James Apex",
      gcEmail: gc.email,
      startDate: new Date("2024-09-01"),
      endDate: new Date("2025-09-30"),
      status: "ACTIVE",
    },
  });

  console.log("Created 3 projects");

  // Contracts
  const contract1 = await prisma.contract.create({
    data: {
      projectId: project1.id,
      subcontractorId: sub.id,
      value: 485000,
      retainagePercent: 10,
      description: "Full plumbing scope – medical center new construction",
    },
  });

  const contract2 = await prisma.contract.create({
    data: {
      projectId: project2.id,
      subcontractorId: sub.id,
      value: 220000,
      retainagePercent: 5,
      description: "Plumbing rough-in and fixture installation",
    },
  });

  const contract3 = await prisma.contract.create({
    data: {
      projectId: project3.id,
      subcontractorId: sub.id,
      value: 310000,
      retainagePercent: 10,
      description: "Residential plumbing for 48-unit apartment complex",
    },
  });

  // SOV Line Items – Contract 1
  const sov1Items = [
    { description: "Mobilization & Site Setup", scheduledValue: 15000, order: 1 },
    { description: "Underground Rough-In – Drainage", scheduledValue: 55000, order: 2 },
    { description: "Underground Rough-In – Domestic Water", scheduledValue: 42000, order: 3 },
    { description: "Above-Ground Rough-In – Waste/Vent", scheduledValue: 68000, order: 4 },
    { description: "Above-Ground Rough-In – Hot/Cold Supply", scheduledValue: 52000, order: 5 },
    { description: "Medical Gas Rough-In", scheduledValue: 38000, order: 6 },
    { description: "Fixture Rough-In & Blocking", scheduledValue: 35000, order: 7 },
    { description: "Insulation – Domestic Water", scheduledValue: 18000, order: 8 },
    { description: "Fixture Trim & Connections", scheduledValue: 65000, order: 9 },
    { description: "Testing, Commissioning & Balancing", scheduledValue: 22000, order: 10 },
    { description: "As-Builts & Project Closeout", scheduledValue: 12000, order: 11 },
    { description: "Medical Gas Certification", scheduledValue: 8000, order: 12 },
    { description: "Final Punch List & Warranty", scheduledValue: 55000, order: 13 },
  ];

  const sov1 = await prisma.sovLineItem.createMany({
    data: sov1Items.map((item) => ({ ...item, contractId: contract1.id })),
  });

  const sov1Records = await prisma.sovLineItem.findMany({
    where: { contractId: contract1.id },
    orderBy: { order: "asc" },
  });

  // SOV Line Items – Contract 2
  const sov2Items = [
    { description: "Mobilization", scheduledValue: 5000, order: 1 },
    { description: "Underground Plumbing", scheduledValue: 40000, order: 2 },
    { description: "Above-Ground Rough-In", scheduledValue: 65000, order: 3 },
    { description: "Plumbing Fixtures", scheduledValue: 55000, order: 4 },
    { description: "Restroom Packages", scheduledValue: 35000, order: 5 },
    { description: "Closeout", scheduledValue: 20000, order: 6 },
  ];

  await prisma.sovLineItem.createMany({
    data: sov2Items.map((item) => ({ ...item, contractId: contract2.id })),
  });

  const sov2Records = await prisma.sovLineItem.findMany({
    where: { contractId: contract2.id },
    orderBy: { order: "asc" },
  });

  // SOV Line Items – Contract 3
  const sov3Items = [
    { description: "Underground Sanitary & Storm", scheduledValue: 55000, order: 1 },
    { description: "Underground Domestic Water", scheduledValue: 38000, order: 2 },
    { description: "Unit Rough-In – Buildings A & B", scheduledValue: 72000, order: 3 },
    { description: "Unit Rough-In – Buildings C & D", scheduledValue: 68000, order: 4 },
    { description: "Fixture Trim – All Units", scheduledValue: 52000, order: 5 },
    { description: "Common Area Plumbing", scheduledValue: 15000, order: 6 },
    { description: "Final Testing & Punch List", scheduledValue: 10000, order: 7 },
  ];

  await prisma.sovLineItem.createMany({
    data: sov3Items.map((item) => ({ ...item, contractId: contract3.id })),
  });

  const sov3Records = await prisma.sovLineItem.findMany({
    where: { contractId: contract3.id },
    orderBy: { order: "asc" },
  });

  console.log("Created SOV line items");

  // Billing Applications – Contract 1 (3 historical apps)
  const app1 = await prisma.billingApplication.create({
    data: {
      contractId: contract1.id,
      periodMonth: 1,
      periodYear: 2025,
      appNumber: 1,
      status: "APPROVED",
      submittedAt: new Date("2025-02-01"),
      approvedAt: new Date("2025-02-10"),
      signedAt: new Date("2025-02-01"),
      signedByName: "Mike Metro",
      lienWaiverAccepted: true,
      lienWaiverType: "Conditional",
      netDue: 45900,
      lineItems: {
        create: [
          { sovLineItemId: sov1Records[0].id, previousBilledPct: 0, thisPeriodPct: 100, thisPeriodAmt: 15000 },
          { sovLineItemId: sov1Records[1].id, previousBilledPct: 0, thisPeriodPct: 60, thisPeriodAmt: 33000 },
          { sovLineItemId: sov1Records[2].id, previousBilledPct: 0, thisPeriodPct: 30, thisPeriodAmt: 12600 },
        ],
      },
    },
  });

  const app2 = await prisma.billingApplication.create({
    data: {
      contractId: contract1.id,
      periodMonth: 2,
      periodYear: 2025,
      appNumber: 2,
      status: "APPROVED",
      submittedAt: new Date("2025-03-03"),
      approvedAt: new Date("2025-03-14"),
      signedAt: new Date("2025-03-03"),
      signedByName: "Mike Metro",
      lienWaiverAccepted: true,
      lienWaiverType: "Conditional",
      netDue: 67500,
      lineItems: {
        create: [
          { sovLineItemId: sov1Records[1].id, previousBilledPct: 60, thisPeriodPct: 40, thisPeriodAmt: 22000 },
          { sovLineItemId: sov1Records[2].id, previousBilledPct: 30, thisPeriodPct: 70, thisPeriodAmt: 29400 },
          { sovLineItemId: sov1Records[3].id, previousBilledPct: 0, thisPeriodPct: 50, thisPeriodAmt: 34000 },
        ],
      },
    },
  });

  const app3 = await prisma.billingApplication.create({
    data: {
      contractId: contract1.id,
      periodMonth: 3,
      periodYear: 2025,
      appNumber: 3,
      status: "SUBMITTED",
      submittedAt: new Date("2025-04-02"),
      signedAt: new Date("2025-04-02"),
      signedByName: "Mike Metro",
      lienWaiverAccepted: true,
      lienWaiverType: "Conditional",
      netDue: 58500,
      lineItems: {
        create: [
          { sovLineItemId: sov1Records[3].id, previousBilledPct: 50, thisPeriodPct: 50, thisPeriodAmt: 34000 },
          { sovLineItemId: sov1Records[4].id, previousBilledPct: 0, thisPeriodPct: 50, thisPeriodAmt: 26000 },
          { sovLineItemId: sov1Records[5].id, previousBilledPct: 0, thisPeriodPct: 20, thisPeriodAmt: 7600 },
        ],
      },
    },
  });

  // App for contract 2 – approved
  const app4 = await prisma.billingApplication.create({
    data: {
      contractId: contract2.id,
      periodMonth: 3,
      periodYear: 2025,
      appNumber: 1,
      status: "APPROVED",
      submittedAt: new Date("2025-04-01"),
      approvedAt: new Date("2025-04-08"),
      signedAt: new Date("2025-04-01"),
      signedByName: "Mike Metro",
      lienWaiverAccepted: true,
      lienWaiverType: "Conditional",
      netDue: 101250,
      lineItems: {
        create: [
          { sovLineItemId: sov2Records[0].id, previousBilledPct: 0, thisPeriodPct: 100, thisPeriodAmt: 5000 },
          { sovLineItemId: sov2Records[1].id, previousBilledPct: 0, thisPeriodPct: 100, thisPeriodAmt: 40000 },
          { sovLineItemId: sov2Records[2].id, previousBilledPct: 0, thisPeriodPct: 80, thisPeriodAmt: 52000 },
        ],
      },
    },
  });

  // App for contract 3 – rejected
  const app5 = await prisma.billingApplication.create({
    data: {
      contractId: contract3.id,
      periodMonth: 2,
      periodYear: 2025,
      appNumber: 1,
      status: "REJECTED",
      submittedAt: new Date("2025-03-05"),
      rejectedAt: new Date("2025-03-10"),
      signedAt: new Date("2025-03-05"),
      signedByName: "Mike Metro",
      lienWaiverAccepted: true,
      gcComment: "Quantities do not match site inspection. Please revise.",
      netDue: 45000,
      lineItems: {
        create: [
          { sovLineItemId: sov3Records[0].id, previousBilledPct: 0, thisPeriodPct: 80, thisPeriodAmt: 44000 },
          { sovLineItemId: sov3Records[1].id, previousBilledPct: 0, thisPeriodPct: 10, thisPeriodAmt: 3800 },
        ],
      },
    },
  });

  console.log("Created 5 billing applications");

  // Comments on app3
  await prisma.comment.create({
    data: {
      applicationId: app3.id,
      userId: sub.id,
      message: "Please note the medical gas work will be complete by end of April.",
    },
  });

  // Change Orders
  await prisma.changeOrder.create({
    data: {
      contractId: contract1.id,
      subcontractorId: sub.id,
      coNumber: 1,
      description: "Added 2 additional emergency eyewash stations per owner request",
      amount: 4800,
      status: "APPROVED",
      submittedAt: new Date("2025-02-20"),
      subSignedAt: new Date("2025-02-21"),
      gcSignedAt: new Date("2025-02-25"),
    },
  });

  await prisma.changeOrder.create({
    data: {
      contractId: contract1.id,
      subcontractorId: sub.id,
      coNumber: 2,
      description: "Reroute domestic water main due to structural conflict",
      amount: 12500,
      status: "PENDING",
      submittedAt: new Date("2025-03-15"),
    },
  });

  await prisma.changeOrder.create({
    data: {
      contractId: contract2.id,
      subcontractorId: sub.id,
      coNumber: 1,
      description: "Upgraded toilet fixtures to low-flow per new spec",
      amount: 6200,
      status: "APPROVED",
      submittedAt: new Date("2025-03-20"),
      subSignedAt: new Date("2025-03-21"),
      gcSignedAt: new Date("2025-03-28"),
    },
  });

  await prisma.changeOrder.create({
    data: {
      contractId: contract3.id,
      subcontractorId: sub.id,
      coNumber: 1,
      description: "Additional backflow preventers for irrigation system",
      amount: 3400,
      status: "PENDING",
      submittedAt: new Date("2025-04-01"),
    },
  });

  console.log("Created change orders");

  // Compliance Documents
  const now = new Date();
  await prisma.complianceDocument.create({
    data: {
      userId: sub.id,
      type: "COI",
      carrier: "Nationwide Insurance",
      policyNumber: "NW-2025-8842310",
      expiryDate: new Date(now.getFullYear(), now.getMonth() + 8, 1),
      status: "ACTIVE",
      fileUrl: null,
    },
  });

  await prisma.complianceDocument.create({
    data: {
      userId: sub.id,
      type: "LICENSE",
      carrier: "Arizona ROC",
      policyNumber: "AZ-PLB-20245",
      expiryDate: new Date(now.getFullYear(), now.getMonth() + 2, 15),
      status: "EXPIRING_SOON",
      fileUrl: null,
    },
  });

  await prisma.complianceDocument.create({
    data: {
      userId: sub.id,
      type: "WORKERS_COMP",
      carrier: "State Compensation Fund",
      policyNumber: "SCF-WC-44821",
      expiryDate: new Date(now.getFullYear() + 1, 2, 31),
      status: "ACTIVE",
      fileUrl: null,
    },
  });

  await prisma.complianceDocument.create({
    data: {
      userId: sub.id,
      type: "BOND",
      carrier: "Surety Bonding Co.",
      policyNumber: "SBC-BOND-22901",
      expiryDate: new Date(now.getFullYear() - 1, 6, 1),
      status: "EXPIRED",
      fileUrl: null,
    },
  });

  console.log("Created compliance documents");

  // Certified Payrolls
  await prisma.certifiedPayroll.create({
    data: {
      projectId: project1.id,
      userId: sub.id,
      weekEnding: new Date("2025-04-18"),
      employeeCount: 6,
      totalWages: 18420,
      status: "SUBMITTED",
    },
  });

  await prisma.certifiedPayroll.create({
    data: {
      projectId: project1.id,
      userId: sub.id,
      weekEnding: new Date("2025-04-25"),
      employeeCount: 6,
      totalWages: 19050,
      status: "PENDING",
    },
  });

  await prisma.certifiedPayroll.create({
    data: {
      projectId: project2.id,
      userId: sub.id,
      weekEnding: new Date("2025-04-18"),
      employeeCount: 4,
      totalWages: 12800,
      status: "APPROVED",
    },
  });

  // Notifications
  await prisma.notification.create({
    data: {
      userId: sub.id,
      title: "App #1 Approved",
      body: "Pay Application #1 for Riverside Medical Center has been approved.",
      read: true,
      link: "/history",
    },
  });

  await prisma.notification.create({
    data: {
      userId: sub.id,
      title: "App #2 Approved",
      body: "Pay Application #2 for Riverside Medical Center has been approved.",
      read: true,
      link: "/history",
    },
  });

  await prisma.notification.create({
    data: {
      userId: sub.id,
      title: "App #1 Rejected",
      body: "Pay Application #1 for Desert View Apartments was rejected. Please review GC comment and resubmit.",
      read: false,
      link: "/history",
    },
  });

  await prisma.notification.create({
    data: {
      userId: sub.id,
      title: "License Expiring Soon",
      body: "Your AZ contractor license expires in less than 30 days. Please renew.",
      read: false,
      link: "/compliance",
    },
  });

  await prisma.notification.create({
    data: {
      userId: gc.id,
      title: "New Billing Application",
      body: "Pay Application #3 submitted for Riverside Medical Center.",
      read: false,
      link: "/approvals",
    },
  });

  console.log("Seed completed successfully! ✓");
  console.log("\nLogin credentials:");
  console.log("  GC:  admin@apexconstruction.com / admin123");
  console.log("  Sub: mike@metroplumbing.com / sub123");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
