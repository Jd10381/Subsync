import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isGC = session.user.role === "GC" || session.user.role === "ADMIN";
  if (!isGC) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

  if (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== "re_placeholder_key") {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: "noreply@pipepay.app",
        to: email,
        subject: "You've been invited to PipePay",
        html: `
          <h2>You're invited to PipePay</h2>
          <p>${session.user.name || "Your GC"} has invited you to join PipePay, a billing management portal.</p>
          <p>Visit <a href="${process.env.NEXTAUTH_URL}/login">${process.env.NEXTAUTH_URL}/login</a> to get started.</p>
        `,
      });
    } catch (err) {
      console.error("Invite email error:", err);
    }
  } else {
    console.log(`[Invite] Would send invite to: ${email}`);
  }

  return NextResponse.json({ success: true });
}
