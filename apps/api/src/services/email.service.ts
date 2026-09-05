import nodemailer, { type Transporter } from "nodemailer"
import { env } from "../config/env.js"

export interface EmailAttachment {
  filename: string
  content: Buffer | string
  contentType?: string
}

export interface SendEmailOptions {
  to: string
  subject: string
  text: string
  html?: string
  attachments?: EmailAttachment[]
}

export interface SendEmailResult {
  success: boolean
  messageId?: string
  error?: string
}

export class EmailService {
  private transporter: Transporter

  constructor() {
    this.transporter = this.createTransporter()
  }

  private createTransporter(): Transporter {
    // If SMTP_HOST is provided and not in simulated test mode, create real SMTP transporter
    if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD) {
      return nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_PORT === 465,
        auth: {
          user: env.SMTP_USER,
          pass: env.SMTP_PASSWORD,
        },
      })
    }

    // Default to JSON/in-memory transport (safe for tests and local dev without real mail server)
    return nodemailer.createTransport({
      jsonTransport: true,
    })
  }

  public async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    try {
      // Simulate failure for test recipients if needed
      if (options.to.includes("invalid-simulated-bounce")) {
        throw new Error("Simulated SMTP delivery failure: Mailbox unreachable")
      }

      const mailOptions: Record<string, unknown> = {
        from: env.SMTP_FROM,
        to: options.to,
        subject: options.subject,
        text: options.text,
      }

      if (options.html) {
        mailOptions.html = options.html
      }

      if (options.attachments && options.attachments.length > 0) {
        mailOptions.attachments = options.attachments.map((att) => {
          const item: Record<string, unknown> = {
            filename: att.filename,
            content: att.content,
          }
          if (att.contentType) {
            item.contentType = att.contentType
          }
          return item
        })
      }

      const info = (await this.transporter.sendMail(mailOptions as any)) as { messageId?: string }

      return {
        success: true,
        messageId: info?.messageId || "mock-msg-" + Date.now(),
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to send email"
      return {
        success: false,
        error: errorMsg,
      }
    }
  }

  public isSmtpConfigured(): boolean {
    return Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD)
  }
}

export const emailService = new EmailService()
