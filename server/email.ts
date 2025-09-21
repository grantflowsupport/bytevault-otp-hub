import nodemailer from 'nodemailer';

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

interface NotificationData {
  to: string;
  subject: string;
  html: string;
  text: string;
}

// Email configuration from environment variables
const getEmailConfig = (): EmailConfig => {
  return {
    host: process.env.SMTP_HOST || 'localhost',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASSWORD || '',
    },
  };
};

// Create transporter with configuration
let transporter: nodemailer.Transporter | null = null;

const getTransporter = () => {
  if (!transporter) {
    const config = getEmailConfig();
    
    if (!config.auth.user || !config.auth.pass) {
      console.warn('Email configuration missing - notifications will be logged only');
      return null;
    }
    
    transporter = nodemailer.createTransport(config);
  }
  return transporter;
};

// Email templates
const emailTemplates = {
  accessExpiring: (userName: string, productName: string, expiresAt: string): EmailTemplate => ({
    subject: `Access Expiring Soon - ${productName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Access Expiring Soon</h2>
        <p>Hello,</p>
        <p>Your access to <strong>${productName}</strong> will expire on <strong>${new Date(expiresAt).toLocaleDateString()}</strong>.</p>
        <p>To continue using this service, please contact your administrator to extend your access.</p>
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
        <p style="color: #666; font-size: 12px;">
          This is an automated notification from ByteVault OTP Hub.
        </p>
      </div>
    `,
    text: `
Access Expiring Soon

Hello,

Your access to ${productName} will expire on ${new Date(expiresAt).toLocaleDateString()}.

To continue using this service, please contact your administrator to extend your access.

This is an automated notification from ByteVault OTP Hub.
    `,
  }),

  accessExpired: (userName: string, productName: string): EmailTemplate => ({
    subject: `Access Expired - ${productName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #d32f2f;">Access Expired</h2>
        <p>Hello,</p>
        <p>Your access to <strong>${productName}</strong> has expired.</p>
        <p>If you need continued access, please contact your administrator.</p>
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
        <p style="color: #666; font-size: 12px;">
          This is an automated notification from ByteVault OTP Hub.
        </p>
      </div>
    `,
    text: `
Access Expired

Hello,

Your access to ${productName} has expired.

If you need continued access, please contact your administrator.

This is an automated notification from ByteVault OTP Hub.
    `,
  }),

  adminAlert: (alertType: string, message: string, details?: string): EmailTemplate => ({
    subject: `Admin Alert - ${alertType}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #ff9800;">Admin Alert</h2>
        <p><strong>Alert Type:</strong> ${alertType}</p>
        <p><strong>Message:</strong> ${message}</p>
        ${details ? `<p><strong>Details:</strong></p><pre style="background: #f5f5f5; padding: 10px; border-radius: 4px;">${details}</pre>` : ''}
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
        <p style="color: #666; font-size: 12px;">
          Timestamp: ${new Date().toISOString()}<br>
          This is an automated alert from ByteVault OTP Hub.
        </p>
      </div>
    `,
    text: `
Admin Alert

Alert Type: ${alertType}
Message: ${message}
${details ? `Details:\n${details}` : ''}

Timestamp: ${new Date().toISOString()}
This is an automated alert from ByteVault OTP Hub.
    `,
  }),

  systemNotification: (title: string, message: string): EmailTemplate => ({
    subject: `System Notification - ${title}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2196f3;">System Notification</h2>
        <h3>${title}</h3>
        <p>${message}</p>
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
        <p style="color: #666; font-size: 12px;">
          Timestamp: ${new Date().toISOString()}<br>
          This is an automated notification from ByteVault OTP Hub.
        </p>
      </div>
    `,
    text: `
System Notification

${title}

${message}

Timestamp: ${new Date().toISOString()}
This is an automated notification from ByteVault OTP Hub.
    `,
  }),
};

// Send email function
export const sendEmail = async (notification: NotificationData): Promise<boolean> => {
  try {
    const transporter = getTransporter();
    
    if (!transporter) {
      // Log notification instead of sending when no SMTP config
      console.log('EMAIL NOTIFICATION (SMTP not configured):', {
        to: notification.to,
        subject: notification.subject,
        text: notification.text,
      });
      return true;
    }

    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: notification.to,
      subject: notification.subject,
      html: notification.html,
      text: notification.text,
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', { to: notification.to, messageId: result.messageId });
    return true;
  } catch (error) {
    console.error('Failed to send email:', error);
    return false;
  }
};

// Convenience functions for different notification types
export const sendAccessExpiringNotification = async (
  userEmail: string, 
  userName: string, 
  productName: string, 
  expiresAt: string
): Promise<boolean> => {
  const template = emailTemplates.accessExpiring(userName, productName, expiresAt);
  return sendEmail({
    to: userEmail,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });
};

export const sendAccessExpiredNotification = async (
  userEmail: string, 
  userName: string, 
  productName: string
): Promise<boolean> => {
  const template = emailTemplates.accessExpired(userName, productName);
  return sendEmail({
    to: userEmail,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });
};

export const sendAdminAlert = async (
  adminEmail: string, 
  alertType: string, 
  message: string, 
  details?: string
): Promise<boolean> => {
  const template = emailTemplates.adminAlert(alertType, message, details);
  return sendEmail({
    to: adminEmail,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });
};

export const sendSystemNotification = async (
  email: string, 
  title: string, 
  message: string
): Promise<boolean> => {
  const template = emailTemplates.systemNotification(title, message);
  return sendEmail({
    to: email,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });
};

// Test email configuration
export const testEmailConfig = async (): Promise<{ success: boolean; error?: string }> => {
  try {
    const transporter = getTransporter();
    
    if (!transporter) {
      return { success: false, error: 'SMTP configuration missing' };
    }

    await transporter.verify();
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};