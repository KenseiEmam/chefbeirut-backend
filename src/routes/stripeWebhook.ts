import { Router } from "express"
import Stripe from "stripe"
import prisma from "../lib/prisma"

const router = Router()
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

router.post("/webhook", async (req, res) => {
  const sig = req.headers["stripe-signature"] as string

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      req.body, // ✅ RAW BUFFER
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    console.error("Webhook signature verification failed", err)
    return res.status(400).send("Webhook Error")
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session

    const userId = session.metadata?.userId
    if (!userId) return res.json({ received: true })

    const paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id

    if (!paymentIntentId) {
      return res.json({ received: true })
    }

    // 🔐 Idempotency WITHOUT schema change
    const existingTx = await prisma.transaction.findFirst({
      where: {
        receipt: {
          path: ["paymentIntentId"],
          equals: paymentIntentId,
        },
      },
    })

    if (existingTx) {
      return res.json({ received: true })
    }

    const amount = session.amount_total
      ? session.amount_total / 100
      : 0

    await prisma.plan.create({
      data: {
        userId,
        type: session.metadata?.planType,
        noMeals: Number(session.metadata?.noMeals),
        noDays: Number(session.metadata?.noDays),
        status: "active",
        estimatedPrice: amount,
        startDate: new Date(),
        expiryDate: new Date(
          Date.now() +
            Number(session.metadata?.noDays || 7) *
              24 *
              60 *
              60 *
              1000
        ),
      },
    })

    await prisma.transaction.create({
      data: {
        userId,
        amount,
        currency: session.currency?.toUpperCase() || "USD",
        method: "stripe",
        status: "paid",
        receipt: {
          checkoutSessionId: session.id,
          paymentIntentId,
        },
      },
    })
  }

  res.json({ received: true })
})

export default router
