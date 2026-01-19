import express from 'express'
import { sendEmail } from '../services/mailer'

const router = express.Router()

router.post('/send', async (req, res) => {
  const { name, email, message } = req.body

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'All fields are required' })
  }

  try {
    await sendEmail({
      to: process.env.EMAIL_TO!,
      replyTo: email,
      subject: `New form submission from ${name}`,
      text: message,
      html: `
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Message:</strong><br/>${message}</p>
      `,
    })

    res.json({ success: true })
  } catch (err) {
    console.error('❌ Email send error:', err)
    res.status(500).json({ error: 'Failed to send email' })
  }
})

export default router
