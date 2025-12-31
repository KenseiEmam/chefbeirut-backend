import { Router } from "express"
import Stripe from "stripe"
import prisma from "../lib/prisma"

const router = Router()
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

function getRemainingWeekdays(fromDate: Date = new Date()) {
  const weekdays = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const todayIndex = fromDate.getDay();
  return weekdays.slice(todayIndex + 1).concat(weekdays.slice(0, todayIndex + 1));
}

async function populateRemainingWeekOrders(plan: any) {
  if (!plan.userId) return;
  const today = new Date();
  const remainingDays = getRemainingWeekdays(today);

  const schedule = await prisma.schedule.findMany(); // 7 rows

  for (const dayName of remainingDays) {
    if (plan.specifyDays && !plan.specifyDays.includes(dayName)) continue;
    if (plan.expiryDate && plan.expiryDate < today) continue;

    // Check if order already exists for that user on this date
    const dateStart = new Date(today);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(today);
    dateEnd.setHours(23, 59, 59, 999);

    const existingOrder = await prisma.order.findFirst({
      where: {
        userId: plan.userId,
        deliveryEta: { gte: dateStart.toISOString(), lte: dateEnd.toISOString() },
      },
    });
    if (existingOrder) continue;

    const daySchedule = schedule.find((s: any) => s.day === dayName);
    if (!daySchedule) continue;

    // Determine real number of meals (including snack)
    let realNumber = plan.noMeals || 0;
    if (plan.snack) realNumber++;

    // Determine protein/carb goals
    let proteinGoal = 200;
    let carbGoal = 200;
    switch (plan.type) {
      case "custom":
        proteinGoal = plan.customProtein || 200;
        carbGoal = plan.customCarb || 200;
        break;
      case "gain":
        proteinGoal = 250;
        carbGoal = 250;
        break;
      case "loss":
        proteinGoal = 150;
        carbGoal = 150;
        break;
    }

    const nutritionProfile = {
      planType: plan.type,
      proteinTarget: proteinGoal,
      carbTarget: carbGoal,
      mealsPerDay: realNumber,
      snack: plan.snack,
    };

    // Collect meal items
    const meals = daySchedule.meals.slice(0, plan.noMeals || 0);
    if (plan.snack && daySchedule.snackId) meals.push(daySchedule.snackId);

    if (!meals.length) continue;

    const items = meals.map((mealId: string, index: number) => ({
      meal: { connect: { id: mealId } },
      name: "", // optional: fetch meal name if needed
      unitPrice: 0,
      quantity: 1,
      totalPrice: 0,
      nutritionContext: {
        mealIndex: index,
        mealsPerDay: realNumber,
      },
    }));

    await prisma.order.create({
      data: {
        userId: plan.userId,
        planType: plan.type,
        nutritionProfile,
        status: 'PREPARING',
        subtotal: 0,
        total: 0,
        deliveryAddress: plan.user.address,
        deliveryEta: new Date().toISOString(),
        items: { create: items },
      },
    });
  }
}


router.post("/", async (req, res) => {
  const sig = req.headers["stripe-signature"] as string

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
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
    const plan = await prisma.plan.create({
      data: {
        userId,
        type: session.metadata?.planType ?? "",
        noMeals: Number(session.metadata?.noMeals ?? 0),
        noDays: Number(session.metadata?.noDays ?? 0),
        status: "active",
        estimatedPrice: amount,
        startDate: new Date(),
        expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        specifyDays,
        noBreakfast: session.metadata?.noBreakfast === "true",
        snack: session.metadata?.snack === "true",
      },
    })

    // Populate remaining week orders
    await populateRemainingWeekOrders(plan)

    // Create Transaction
    await prisma.transaction.create({
      data: {
        userId,
        amount,
        currency: session.currency?.toUpperCase() || "AED",
        method: "stripe",
        status: "paid",
        receipt: {
          paymentIntentId: session.payment_intent as string,
          checkoutSessionId: session.id,
        },
      },
    })
  }

  res.json({ received: true })
})

export default router
