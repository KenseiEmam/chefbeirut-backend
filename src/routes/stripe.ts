import { Router } from "express"
import Stripe from "stripe"

const router = Router()

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

router.post("/checkout", async (req, res) => {
  try {
    const { userId, planType, noMeals, noDays, price } = req.body

    if (!userId || !planType) {
      return res.status(400).json({ error: "Missing required fields" })
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",

      // ❌ no longer required, Stripe auto-detects
      // payment_method_types: ["card"],

      line_items: [
        {
          price_data: {
            currency: "aed",
            product_data: {
              name: `Meal Plan (${planType})`,
            },
            unit_amount: price*100, // cents
          },
          quantity: 1,
        },
      ],

      metadata: {
        userId,
        planType,
        noMeals: String(noMeals ?? ""),
        noDays: String(noDays ?? ""),
      },

      success_url: `${process.env.FRONTEND_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/payment-cancel`,
    })

    // ✅ RETURN URL, NOT sessionId
    res.json({ url: session.url })
  } catch (err) {
    console.error("Stripe checkout error:", err)
    res.status(500).json({ error: "Failed to create checkout session" })
  }
})

export default router
