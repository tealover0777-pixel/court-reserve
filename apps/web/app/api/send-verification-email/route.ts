import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      from_email,
      from_name,
      test_email,
      smtp_host,
      smtp_port,
      smtp_user,
      smtp_password,
      smtp_app_password,
      smtp_2fa,
      smtp_tls,
      delivery_method,
      smtp_service,
    } = body;

    if (!from_email || !test_email) {
      return NextResponse.json(
        { success: false, error: "from_email and test_email are required." },
        { status: 400 }
      );
    }

    // Use app password if 2FA is enabled
    const password = smtp_2fa && smtp_app_password ? smtp_app_password : smtp_password;

    let transporterConfig: nodemailer.TransportOptions;

    if (delivery_method === "SMTP" && smtp_host) {
      // Custom SMTP
      transporterConfig = {
        host: smtp_host,
        port: Number(smtp_port) || 587,
        secure: Number(smtp_port) === 465,
        auth: {
          user: smtp_user || from_email,
          pass: password,
        },
        tls: smtp_tls ? { rejectUnauthorized: false } : undefined,
      } as nodemailer.TransportOptions;
    } else {
      // Service-based (Gmail, Yahoo!, Outlook, etc.)
      const serviceMap: Record<string, { host: string; port: number }> = {
        Gmail: { host: "smtp.gmail.com", port: 587 },
        "Yahoo!": { host: "smtp.mail.yahoo.com", port: 587 },
        Outlook: { host: "smtp.office365.com", port: 587 },
        SendGrid: { host: "smtp.sendgrid.net", port: 587 },
        Mailgun: { host: "smtp.mailgun.org", port: 587 },
      };
      const svcConfig = serviceMap[smtp_service] ?? { host: "smtp.gmail.com", port: 587 };

      transporterConfig = {
        host: svcConfig.host,
        port: svcConfig.port,
        secure: false,
        auth: {
          user: smtp_user || from_email,
          pass: password,
        },
        tls: { rejectUnauthorized: false },
      } as nodemailer.TransportOptions;
    }

    const transporter = nodemailer.createTransport(transporterConfig);

    await transporter.sendMail({
      from: from_name ? `"${from_name}" <${from_email}>` : from_email,
      to: test_email,
      subject: "✅ Court Reserve – Email Verification Test",
      html: `
        <div style="font-family:Inter,sans-serif;background:#0a0a0a;padding:40px;border-radius:16px;max-width:480px;margin:0 auto;">
          <div style="background:#ccff00;width:48px;height:48px;border-radius:12px;display:flex;align-items:center;justify-content:center;margin-bottom:24px;">
            <span style="font-size:24px;">✅</span>
          </div>
          <h1 style="color:#fff;font-size:24px;font-weight:900;margin:0 0 8px;letter-spacing:-0.5px;">Email Verified</h1>
          <p style="color:#a8a29e;font-size:14px;margin:0 0 24px;line-height:1.6;">
            Your SMTP configuration for <strong style="color:#fff;">${from_email}</strong> is working correctly.
            This test was sent from the Court Reserve platform.
          </p>
          <p style="color:#57534e;font-size:11px;border-top:1px solid #1c1917;padding-top:16px;margin:0;">
            Court Reserve Platform · Email Verification Test
          </p>
        </div>
      `,
    });

    return NextResponse.json({ success: true, message: `Verification email sent to ${test_email}` });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[send-verification-email]", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
