import { Router } from "express"
import prisma from "../lib/prisma"

const router = Router()

/**
 * CREATE / UPDATE a schedule day
 * day: "sun" | "mon" | ...
 * meals: string[] (mealIds, max 5)
 * snackId?: string
 */
router.post("/", async (req, res) => {
  try {
    const { day, meals, snackId } = req.body

    if (!day || !Array.isArray(meals) || meals.length > 5) {
      return res.status(400).json({ error: "Invalid payload" })
    }

    const schedule = await prisma.schedule.upsert({
      where: { day },
      update: {
        meals,
        snackId: snackId || null,
      },
      create: {
        day,
        meals,
        snackId: snackId || null,
      },
    })

    res.json(schedule)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Failed to save schedule" })
  }
})

/**
 * GET full weekly schedule
 */
router.get("/", async (_req, res) => {
  try {
    const schedule = await prisma.schedule.findMany({
      orderBy: { day: "asc" },
    })

    res.json(schedule)
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch schedule" })
  }
})

/**
 * DELETE schedule day
 */
router.delete("/:day", async (req, res) => {
  try {
    await prisma.schedule.delete({
      where: { day: req.params.day },
    })

    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: "Failed to delete schedule" })
  }
})

/**
 * POPULATE ORDERS FOR THE NEXT 7 DAYS
 */
router.post("/populate-week", async (_req, res) => {
  try {
    const start = new Date()
    start.setDate(start.getDate() + 1)
    start.setHours(0, 0, 0, 0)

    const schedules = await prisma.schedule.findMany()
    const scheduleMap = Object.fromEntries(
      schedules.map((s: any) => [s.day, s])
    )

    const plans = await prisma.plan.findMany({
      where: {
        status: "active",
        expiryDate: { gte: start },
      },
      include: { user: true },
    })
    
    let created = 0

    for (let i = 0; i < 7; i++) {
      const date = new Date(start)
      date.setDate(start.getDate() + i)

      const day = date.toLocaleDateString("en-US", { weekday: "long" })
      const schedule = scheduleMap[day]
      if (!schedule) continue
      
      for (const plan of plans) {
        if (!plan.userId) continue
        
        if (!plan.specifyDays?.includes(day)) continue
        
        if (plan.expiryDate && plan.expiryDate < date) continue
        if (!plan.user?.address) continue
        
        // prevent duplicates
        const exists = await prisma.order.findFirst({
          where: {
            userId: plan.userId,
            deliveryEta: date.toISOString(),
          },
        })
        if (exists) continue
        
        // 🔢 meal count (snack-aware)
        let realNumber = plan.noMeals || 0
        if (plan.snack) realNumber++

        // 🧠 macro logic snapshot
        let proteinGoal = 200
        let carbGoal = 200

        switch (plan.type) {
          case "custom":
            proteinGoal = plan.customProtein || 200
            carbGoal = plan.customCarb || 200
            break
          case "gain":
            proteinGoal = 250
            carbGoal = 250
            break
          case "loss":
            proteinGoal = 150
            carbGoal = 150
            break
        }

        const nutritionProfile = {
          planType: plan.type,
          proteinTarget: proteinGoal,
          carbTarget: carbGoal,
          mealsPerDay: realNumber,
          snack: plan.snack,
        }

        // 🍽 meals
        const mealIds = schedule.meals.slice(0, plan.noMeals || 0)

        const items = mealIds.map((mealId: string, index: number) => ({
          mealId,
          name: "Meal",
          unitPrice: 0,
          quantity: 1,
          totalPrice: 0,
          nutritionContext: {
            mealIndex: index,
            mealsPerDay: realNumber,
          },
        }))

        // 🍎 snack
        if (plan.snack && schedule.snackId) {
          items.push({
            mealId: schedule.snackId,
            name: "Snack",
            unitPrice: 0,
            quantity: 1,
            totalPrice: 0,
            nutritionContext: {
              mealIndex: items.length,
              mealsPerDay: realNumber,
            },
          })
        }

        if (!items.length) continue

        await prisma.order.create({
          data: {
            userId: plan.userId,
            planType: plan.type,
            nutritionProfile,
            status: "PREPARING",
            subtotal: 0,
            total: 0,
            deliveryAddress: plan.user.address,
            deliveryEta: date.toISOString(),
            items: { create: items },
          },
        })

        created++
      }
    }

    res.json({ success: true, created })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Failed to populate weekly orders" })
  }
})

export default router
