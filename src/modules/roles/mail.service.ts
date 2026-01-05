import { Injectable } from "@nestjs/common";
import * as nodemailer from "nodemailer";

@Injectable()
export class MailService {
  private transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: Number(process.env.SMTP_PORT) || 465,
      secure: true, // true for SSL port 465, false for TLS 587
      auth: {
        user: process.env.SMTP_USER || "attendancemanagement2025@gmail.com",
        pass: process.env.SMTP_PASS || "kigu gpta alwr jbbf",
      },
    });
  }

  // ✉️ Send to Admin when a new role application is submitted
  async sendApprovalRequestToAdmin(data: {
    name: string;
    email: string;
    role: string;
  }) {
    await this.transporter.sendMail({
      from: `"EventSH" <${process.env.SMTP_USER}>`,
      to: "admin@eventsh.com", // admin email
      subject: `Approval Request for New ${data.role}`,
      html: `
        <h1>Approval Needed</h1>
        <p>User <strong>${data.name}</strong> (${data.email}) has applied for the role of <strong>${data.role}</strong>.</p>
        <p>Please log in to the admin dashboard to approve or reject this request.</p>
      `,
    });
  }

  // ✉️ Send to applicant confirming their request is pending
  async sendConfirmationToUser(data: {
    name: string;
    email: string;
    role: string;
  }) {
    await this.transporter.sendMail({
      from: `"EventSH" <${process.env.SMTP_USER}>`,
      to: data.email,
      subject: `Your ${data.role} Registration is Pending`,
      html: `
        <h1>Hello ${data.name},</h1>
        <p>Thank you for applying to become a ${data.role} on our platform.</p>
        <p>Your request has been sent to the admin team for approval. You will receive an email once it's approved.</p>
        <p>Regards,<br/>EventSH Team</p>
      `,
    });
  }

  async sendEnquiryConfirmationToUser(data: {
    firstName: string;
    emailId: string;
    enquiryFor: string;
    organizationName: string;
  }) {
    const enquiryLabelMap: Record<string, string> = {
      events: "Events Management",
      eshop: "E‑Shop Platform",
      both: "Events & E‑Shop",
    };

    const enquiryLabel = enquiryLabelMap[data.enquiryFor] ?? "EventSH Services";

    await this.transporter.sendMail({
      from: `"EventSH" <${process.env.SMTP_USER}>`,
      to: data.emailId,
      subject: `We’ve received your enquiry for ${enquiryLabel}`,
      html: `
      <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111827; line-height: 1.6;">
        <h1 style="font-size: 20px; margin-bottom: 12px;">Hi ${data.firstName},</h1>
        <p style="margin: 0 0 8px;">
          Thank you for reaching out to <strong>EventSH</strong> from <strong>${data.organizationName}</strong>.
        </p>
        <p style="margin: 0 0 8px;">
          Your enquiry for <strong>${enquiryLabel}</strong> has been received successfully.
        </p>
        <p style="margin: 0 0 8px;">
          Our team will review your requirements and get back to you as soon as possible with the next steps.
        </p>
        <p style="margin: 0 0 8px;">
          If you need to share any additional details, you can simply reply to this email.
        </p>
        <p style="margin-top: 16px;">
          Regards,<br/>
          <strong>EventSH Team</strong>
        </p>
      </div>
    `,
    });
  }

  // ✉️ Send status update email (Approved or Rejected)
  async sendStatusUpdate(data: {
    name: string;
    email: string;
    role: string;
    status: "Approved" | "Rejected";
  }) {
    let subject = "";
    let body = "";

    if (data.status === "Approved") {
      subject = `Your ${data.role} Registration is Approved`;
      body = `
        <h1>Congratulations ${data.name}!</h1>
        <p>We are pleased to inform you that your application for the role of <strong>${data.role}</strong> has been 
        <span style="color: green; font-weight: bold;">Approved</span>.</p>
        <p>You can now log in and access your ${data.role} dashboard to start managing your activities.</p>
        <p>Regards,<br/>EventSH Team</p>
      `;
    } else if (data.status === "Rejected") {
      subject = `Your ${data.role} Registration is Rejected`;
      body = `
        <h1>Hello ${data.name},</h1>
        <p>We regret to inform you that your application for the role of <strong>${data.role}</strong> has been 
        <span style="color: red; font-weight: bold;">Rejected</span>.</p>
        <p>If you believe this is a mistake or would like to appeal, please contact our support team.</p>
        <p>Regards,<br/>EventSH Team</p>
      `;
    }

    await this.transporter.sendMail({
      from: `"EventSH" <${process.env.SMTP_USER}>`,
      to: data.email,
      subject,
      html: body,
    });
  }

  // ✉️ Send email when a new admin is created
  async sendNewAdminCredentials(data: {
    name: string;
    email: string;
    password: string;
    createdBy: string;
  }) {
    const subject = "Welcome to EventSH - Your Admin Account";

    const body = `
    <h1>Welcome, ${data.name}!</h1>
    <p>You have been added as an <strong>Admin</strong> on the <strong>EventSH</strong> platform by <strong>${data.createdBy}</strong>.</p>
    <h2>Your Login Credentials:</h2>
    <ul>
      <li><strong>Email:</strong> ${data.email}</li>
      <li><strong>Temporary Password:</strong> ${data.password}</li>
    </ul>
    <p><strong>Note:</strong> Please log in immediately and change your password from your profile settings.</p>
    <p>Access the Admin Dashboard here: <a href="http://your-admin-dashboard-url.com">Login Now</a></p>
    <br/>
    <p>Best regards,<br/>EventSH Team</p>
  `;

    await this.transporter.sendMail({
      from: `"EventSH" <${process.env.SMTP_USER}>`,
      to: data.email,
      subject,
      html: body,
    });
  }

  async sendOtpEmail(businessEmail: string, otp: string) {
    await this.transporter.sendMail({
      from: `"EventSH" <${process.env.SMTP_USER}>`,
      to: businessEmail,
      subject: "Your OTP Code for Business Email Verification",
      html: `
      <h1>Your OTP Code</h1>
      <p>Use the following OTP to verify your business email address:</p>
      <h2 style="letter-spacing: 4px;">${otp}</h2>
      <p>This code will expire in 10 minutes.</p>
      <br/>
      <p>Regards,<br/>EventSH Team</p>
    `,
    });
  }

  async sendOTPEmail(data: {
    name: string;
    email: string;
    otp: string;
    businessName: string;
  }) {
    console.log("Vansh Shar,a ");
    await this.transporter.sendMail({
      from: `"EventSH Security" <${process.env.SMTP_USER}>`,
      to: data.email,
      subject: `Your EventSH Login Verification Code - ${data.otp}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>EventSH - Login Verification</title>
          <style>
            .container { max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
            .header { background: linear-gradient(135deg, #1e293b 0%, #374151 100%); color: white; padding: 40px 20px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: white; padding: 40px 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
            .otp-box { background: #f8fafc; border: 2px solid #e5e7eb; border-radius: 12px; padding: 30px; text-align: center; margin: 30px 0; }
            .otp-code { font-size: 36px; font-weight: bold; color: #1e293b; letter-spacing: 8px; margin: 20px 0; font-family: 'Courier New', monospace; }
            .warning-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 25px 0; border-radius: 8px; }
            .footer { text-align: center; padding: 30px; color: #6b7280; font-size: 14px; background: #f9fafb; border-radius: 0 0 10px 10px; }
            .security-info { background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 20px; margin: 25px 0; }
            .btn { display: inline-block; padding: 15px 30px; background: #1e293b; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 10px 0; }
            .logo { width: 60px; height: 60px; background: white; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px; font-size: 24px; font-weight: bold; color: #1e293b; }
            .business-info { background: #f1f5f9; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: left; }
            .expiry-info { color: #dc2626; font-weight: bold; margin: 15px 0; }
            .steps { text-align: left; margin: 25px 0; }
            .step { margin: 10px 0; padding: 10px; background: #f8fafc; border-radius: 6px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">ES</div>
              <h1 style="margin: 0; font-size: 28px;">EventSH</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9;">Secure Login Verification</p>
            </div>
            
            <div class="content">
              <h2 style="color: #1e293b; margin-bottom: 20px;">Hello ${data.name},</h2>
              
              <div class="business-info">
                <strong>🏪 Business:</strong> ${data.businessName}<br>
                <strong>📧 Account:</strong> ${data.email}<br>
                <strong>🕒 Requested:</strong> ${new Date().toLocaleString()}
              </div>
              
              <p style="font-size: 16px; line-height: 1.6; color: #374151;">
                We received a request to access your EventSH Shopkeeper Dashboard. Please use the verification code below to complete your login:
              </p>
              
              <div class="otp-box">
                <p style="margin: 0; font-size: 14px; color: #6b7280; text-transform: uppercase; letter-spacing: 2px;">Your Verification Code</p>
                <div class="otp-code">${data.otp}</div>
                <div class="expiry-info">⏰ Expires in 10 minutes</div>
              </div>
              
              <div class="steps">
                <h3 style="color: #1e293b; margin-bottom: 15px;">How to use this code:</h3>
                <div class="step">
                  <strong>Step 1:</strong> Return to the EventSH login page
                </div>
                <div class="step">
                  <strong>Step 2:</strong> Enter the 6-digit code above
                </div>
                <div class="step">
                  <strong>Step 3:</strong> Click "Verify & Login" to access your dashboard
                </div>
              </div>
              
              <div class="security-info">
                <h4 style="margin-top: 0; color: #065f46;">🔒 Security Information</h4>
                <ul style="margin: 10px 0; padding-left: 20px; color: #374151;">
                  <li>This code is valid for <strong>10 minutes only</strong></li>
                  <li>Maximum <strong>3 attempts</strong> allowed</li>
                  <li>Never share this code with anyone</li>
                  <li>EventSH will never ask for your OTP via phone or chat</li>
                </ul>
              </div>
              
              <div class="warning-box">
                <h4 style="margin-top: 0; color: #92400e;">⚠️ Didn't request this?</h4>
                <p style="margin-bottom: 0; color: #92400e;">
                  If you didn't request this login code, someone may be trying to access your account. Please change your password immediately and contact our support team.
                </p>
              </div>
              
              <p style="font-size: 16px; line-height: 1.6; color: #374151; margin-top: 30px;">
                If you're having trouble logging in, you can request a new verification code or contact our support team for assistance.
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="https://eventsh.com/support" class="btn">Contact Support</a>
              </div>
            </div>
            
            <div class="footer">
              <p style="margin: 0 0 10px 0;"><strong>EventSH - Where Events Meet E-commerce</strong></p>
              <p style="margin: 0 0 15px 0;">This is an automated security email. Please do not reply to this message.</p>
              <p style="margin: 0; font-size: 12px; opacity: 0.8;">
                © ${new Date().getFullYear()} EventSH. All rights reserved.<br>
                If you have questions, contact us at <a href="mailto:support@eventsh.com" style="color: #4f46e5;">support@eventsh.com</a>
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
    });
  }

  async sendMail(options: { to: string; subject: string; html: string }) {
    try {
      await this.transporter.sendMail({
        from: `"EventSH" <${process.env.SMTP_USER}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
      });
    } catch (err) {
      console.error("Failed to send email:", err);
      throw err;
    }
  }

  async sendEmail(options: {
    to: string;
    subject: string;
    html: string;
    attachments?: {
      filename: string;
      content: string | Buffer;
      encoding?: string;
      cid?: string;
    }[];
  }) {
    try {
      console.log("Sending mail to:", options.to);
      await this.transporter.sendMail({
        from: `"EventSH" <${process.env.SMTP_USER}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        attachments: options.attachments || [],
      });
    } catch (err) {
      console.error("Failed to send email:", err);
      throw err;
    }
  }

  /**
   * Send status update email for orders
   */
  // Add the text property to your sendMail options in the sendOrderStatusEmail function
  async sendOrderStatusEmail(
    name: string,
    email: string,
    orderId: string,
    accepted: boolean,
    status: string,
    amount: number,
    shopkeeperName: string
  ) {
    const statusColor = accepted ? "#22c55e" : "#ef4444";
    const subject = accepted
      ? `Order ${orderId} Confirmed`
      : `Order ${orderId} Update`;

    // Plain text version for better deliverability
    const text = `
    Hello ${name},

    Your order status has been updated.

    Order Information:
    - Order ID: ${orderId}
    - Status: ${status}
    - Amount: ₹${amount}
    - Merchant: ${shopkeeperName}

    ${
      accepted
        ? `Great news! Your payment has been confirmed by the merchant. Your order is now being processed.`
        : `Order Rejected: Your payment was not accepted by the merchant.`
    }
    
    Thank you for your order!

    Regards,
    EventSH Team
    `;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Order ${accepted ? "Confirmed" : "Rejected"}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; background-color: #f4f4f4;">
        <div style="max-width: 600px; margin: auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: ${statusColor}; margin: 0;">Order ${accepted ? "Confirmed" : "Rejected"}</h1>
            <p style="color: #666; margin: 10px 0;">Your order status has been updated.</p>
          </div>
          <h2 style="color: #333;">Hello ${name},</h2>
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid ${statusColor}; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #333;">📋 Order Information</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px 0; font-weight: bold;">Order ID:</td><td style="padding: 8px 0;">${orderId}</td></tr>
              <tr><td style="padding: 8px 0; font-weight: bold;">Status:</td><td style="padding: 8px 0; color: ${statusColor}; font-weight: bold;">${status}</td></tr>
              <tr><td style="padding: 8px 0; font-weight: bold;">Amount:</td><td style="padding: 8px 0;">₹${amount}</td></tr>
              <tr><td style="padding: 8px 0; font-weight: bold;">Merchant:</td><td style="padding: 8px 0;">${shopkeeperName}</td></tr>
            </table>
          </div>
          <div style="margin: 30px 0;">
            ${
              accepted
                ? `<p style="color: #22c55e; font-size: 16px;"><strong>Great news!</strong> Your payment has been confirmed by the merchant. Your order is now being processed.</p>
                   <p>We'll keep you updated on the progress. Thank you for your order!</p>`
                : `<p style="color: #ef4444; font-size: 16px;"><strong>Order Rejected</strong> Your payment was not accepted by the merchant.</p>
                   <p>Please contact the merchant for more details or try placing a new order.</p>`
            }
          </div>
          <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h4 style="margin-top: 0; color: #1976d2;">Need Help?</h4>
            <p style="margin: 0;">Contact the merchant directly for any questions about your order.</p>
            <p style="margin: 5px 0 0 0;"><strong>Merchant:</strong> ${shopkeeperName}</p>
          </div>
          <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd;">
            <p style="color: #666; font-size: 14px;">Thank you for using our platform!</p>
            <p style="color: #888; font-size: 12px;">This is an automated message, please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>`;

    await this.sendMail({
      to: email,
      subject,
      html,
    });
  }
}
