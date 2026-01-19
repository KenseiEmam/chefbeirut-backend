const nodemailer = require("nodemailer");
const sgTransport = require('nodemailer-sendgrid')

const transporter = nodemailer.createTransport(
  sgTransport({
    apiKey: process.env.SENDGRID_API_KEY,
  })
)

export async function sendEmail({
  to,
  subject,
  text,
  html,
  replyTo,
}: {
  to: string
  subject: string
  text?: string
  html?: string
  replyTo?: string
}) {
  return transporter.sendMail({
    from: {
      email: 'admin@chefbeirut.ae',
      name: 'Chef Beirut',
    },
    to,
    subject,
    text,
    html,
    replyTo,
  })
}
