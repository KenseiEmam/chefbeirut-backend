import { Router } from "express"
import Stripe from "stripe"
import prisma from "../lib/prisma"

const router = Router()
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

router.post("/", async (req, res) => {
  const sig = req.headers["stripe-signature"] as string

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      req.body, // raw buffer
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

    const amount = session.amount_total ? session.amount_total / 100 : 0

    const specifyDays = session.metadata?.specifyDays
      ? JSON.parse(session.metadata.specifyDays)
      : []

    // Create Plan
    await prisma.plan.create({
      data: {
        userId,
        type: session.metadata?.planType ?? "",
        noMeals: Number(session.metadata?.noMeals ?? 0),
        noDays: Number(session.metadata?.noDays ?? 0),
        status: "active",
        estimatedPrice: amount,
        startDate: new Date(),
        expiryDate: new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000
        ),
        specifyDays,
        noBreakfast: session.metadata?.noBreakfast === "true",
        snack: session.metadata?.snack === "true",
      },
    })

    // Create Transaction with checkoutSessionId in receipt
    await prisma.transaction.create({
      data: {
        userId,
        amount,
        currency: session.currency?.toUpperCase() || "AED",
        method: "stripe",
        status: "paid",
        receipt: {
          paymentIntentId: session.payment_intent as string,
          checkoutSessionId: session.id, // ✅ store checkout session ID here
        },
      },
    })
  }

  res.json({ received: true })
})

export default router
