export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

export function daysSince(date: Date | string): number {
  const now = new Date();
  const d = new Date(date);
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

export function daysUntil(date: Date | string): number {
  const now = new Date();
  const d = new Date(date);
  return Math.floor((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function monthName(month: number): string {
  return new Date(2000, month - 1, 1).toLocaleString("en-US", { month: "long" });
}

export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function getStatusColor(status: string): string {
  switch (status) {
    case "APPROVED": return "bg-green-100 text-green-800";
    case "SUBMITTED": return "bg-blue-100 text-blue-800";
    case "DRAFT": return "bg-gray-100 text-gray-700";
    case "REJECTED": return "bg-red-100 text-red-800";
    case "PARTIAL_APPROVED": return "bg-amber-100 text-amber-800";
    case "PENDING": return "bg-yellow-100 text-yellow-800";
    case "ACTIVE": return "bg-green-100 text-green-800";
    case "COMPLETED": return "bg-blue-100 text-blue-800";
    case "ON_HOLD": return "bg-amber-100 text-amber-800";
    case "CANCELLED": return "bg-red-100 text-red-800";
    case "EXPIRING_SOON": return "bg-amber-100 text-amber-800";
    case "EXPIRED": return "bg-red-100 text-red-800";
    default: return "bg-gray-100 text-gray-700";
  }
}
