import { Router } from "express"
import Stripe from "stripe"

const router = Router()

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

router.post("/checkout", async (req, res) => {
  try {
    const { userId, planType, noMeals, noDays, price, specifyDays, noBreakfast, snack } = req.body

    if (!userId || !planType) {
      return res.status(400).json({ error: "Missing required fields" })
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      // ❌ no longer required, Stripe auto-detects
      // payment_method_types: ["card"],
      allow_promotion_codes:true,
      branding_settings:{
        display_name:"Chef Beirut",
        background_color: "#227948",
        logo: {
          type:"url",
          url:"https://staging.chefbeirut.ae/assets/logo-eCOYQ_Cp.png"
        }
      },
      line_items: [
        {
          price_data: {
            currency: "aed",
            product_data: {
              name: `Meal Plan (${planType})`,
              description: `Your customized meal plan designed to help you ${planType} your current weight. This plan comes with ${noMeals} a day ${snack?' and a snack':''} for ${noDays} a week.${noBreakfast?'':' (Comes with no breakfats.)'}`,
              images:['https://staging.chefbeirut.ae/assets/logo-eCOYQ_Cp.png'],
              
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
        status: "active",
        
        // ✅ stringify booleans
        noBreakfast: String(!!noBreakfast),
        snack: String(!!snack),

        // ✅ stringify array
        specifyDays: JSON.stringify(specifyDays ?? []),
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
router.get("/session", async (req, res) => {
  const { sessionId } = req.query

  if (!sessionId || typeof sessionId !== "string") {
    return res.status(400).json({ error: "Missing sessionId" })
  }

  const session = await stripe.checkout.sessions.retrieve(sessionId)

  if (session.payment_status !== "paid") {
    return res.status(400).json({ error: "Payment not completed" })
  }

  res.json({
    userId: session.metadata?.userId,
    planType: session.metadata?.planType,
    noMeals: session.metadata?.noMeals,
    noDays: session.metadata?.noDays,
  })
})

export default router
