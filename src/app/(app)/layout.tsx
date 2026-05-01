import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="flex h-full">
      <Sidebar role={session.user.role} companyName={session.user.companyName} />
      <div className="flex-1 ml-64 flex flex-col min-h-screen">
        <Topbar userName={session.user.name} userEmail={session.user.email} />
        <main className="flex-1 p-6 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
