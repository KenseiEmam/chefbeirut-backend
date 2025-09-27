import express from "express"
const nodemailer = require("nodemailer");

const router = express.Router()

router.post("/send", async (req, res) => {
  const { name, email, message } = req.body

  if (!name || !email || !message) {
    return res.status(400).json({ error: "All fields are required" })
  }

  try {
    // Elastic Email transporter
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    })

    const mailOptions = {
      from: process.env.EMAIL_USER, // must be a verified Elastic sender
      to: process.env.EMAIL_TO,
      replyTo: email, // user’s email from the form
      subject: `New form submission from ${name}`,
      text: message,
      html: `<p><strong>Name:</strong> ${name}</p>
             <p><strong>Email:</strong> ${email}</p>
             <p><strong>Message:</strong><br/>${message}</p>`,
    }

    await transporter.sendMail(mailOptions)

    res.json({ success: true, message: "Email sent successfully" })
  } catch (err) {
    console.error("❌ Email send error:", err)
    res.status(500).json({ error: "Failed to send email" })
  }
})

export default router
