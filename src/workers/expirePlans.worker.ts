import prisma from '../lib/prisma'
import { sendEmail } from '../services/mailer'

export async function expirePlansJob() {
  const now = new Date()

  // 1. Expire plans (idempotent)
  const result = await prisma.plan.updateMany({
    where: {
      status: 'active',
      expiryDate: {
        lt: now,
      },
    },
    data: {
      status: 'expired',
    },
  })

  if (result.count === 0) return

  // 2. Fetch newly expired plans for emails
  const expiredPlans = await prisma.plan.findMany({
    where: {
      status: 'expired',
      expiryDate: {
        lt: now,
      },
    },
    include: {
      user: true,
    },
  })

  // 3. Notify users
  for (const plan of expiredPlans) {
    if(!plan.user)
        continue
    await sendEmail({
      to: plan.user.email,
      subject: 'Your Chef Beirut plan has expired',
      html: `
        <p>Hi ${plan.user.fullName},</p>
        <p>Your <strong>${plan.type}</strong> plan has expired.</p>
        <p>If you'd like to renew or upgrade, please contact us.</p>
        <p>— Chef Beirut</p>
      `,
    })
  }

  console.log(`✅ Expired ${result.count} plans`)
}
