import { Router, Request, Response } from 'express'
import prisma from '../lib/prisma'

const router = Router()

interface OrderItemInput {
  productId?: string
  mealId?: string
  quantity: number
}

interface OrderBody {
  userId: string
  deliveryAddress?: any
  paymentMethod?: string
  deliveryFee?: number
  deliveryEta?: string
  note?: string
  items: OrderItemInput[]
  cancelReason?: string
  cancelDate?:Date
}

// CREATE ORDER (creates order + items + optional transactions later)
router.post('/', async (req: Request<{}, {}, OrderBody>, res: Response) => {
  try {
    const { userId, deliveryAddress, paymentMethod, deliveryFee, note, items, deliveryEta } = req.body

    if (!userId || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'userId and items are required' })
    }

    // Calculate subtotal from current prices
    const itemRecords = await Promise.all(
      items.map(async (it) => {
        if (it.productId) {
          const p = await prisma.product.findUnique({ where: { id: it.productId } })
          if (!p) throw new Error(`Product ${it.productId} not found`)
          return {
            name: p.name,
            unitPrice: p.price,
            quantity: it.quantity,
            totalPrice: (p.price * it.quantity),
            productId: p.id,
          }
        } else if (it.mealId) {
          const m = await prisma.meal.findUnique({ where: { id: it.mealId } })
          if (!m) throw new Error(`Meal ${it.mealId} not found`)
          return {
            name: m.name,
            unitPrice: m.price || 0,
            quantity: it.quantity,
            totalPrice: ((m.price || 0) * it.quantity),
            mealId: m.id,
          }
        } else {
          throw new Error('Each item must have productId or mealId')
        }
      })
    )

    const subtotal = itemRecords.reduce((s, r) => s + r.totalPrice, 0)
    const delivery = deliveryFee ?? 0
    const total = subtotal + delivery

    const created = await prisma.order.create({
      data: {
        userId,
        deliveryAddress,
        paymentMethod,
        deliveryFee: delivery,
        deliveryEta,
        subtotal,
        total,
        note,
        items: {
          create: itemRecords.map((r) => ({
            productId: (r as any).productId,
            mealId: (r as any).mealId,
            name: r.name,
            unitPrice: r.unitPrice,
            quantity: r.quantity,
            totalPrice: r.totalPrice,
          })),
        },
      },
      include: { items: true },
    })

    res.status(201).json(created)
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create order' })
  }
})
// POST /orders-from-plans
router.post('/orders-from-plans', async (req: Request, res: Response) => {
  try {
    const { type, mealIds, dateAssigned} = req.body

    if (!type || !Array.isArray(mealIds) || mealIds.length === 0) {
      return res.status(400).json({ error: 'type and mealIds[] are required' })
    }
    
    // 1️⃣ Fetch all plans of this type with their users (for address)
    const plans = await prisma.plan.findMany({
      where: { type },
      include: { user: true }, // 👈 grab the user and their address
    })

    if (!plans.length) {
      return res.status(404).json({ error: 'No plans found for this type' })
    }

   // 2️⃣ Fetch all meals in the provided mealIds (unique set)
const meals = await prisma.meal.findMany({
  where: { id: { in: mealIds }, available: true },
})

// Map mealId → meal object for quick lookup
const mealMap = new Map(meals.map(m => [m.id, m]))

    const createdOrders: any[] = []

     // 3️⃣ Today's weekday as string
    const today = dateAssigned || new Date()
    const weekdays = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday"
    ]
    const todayName = weekdays[today.getDay()]
    // 3️⃣ Today's date range
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date()
    endOfDay.setHours(23, 59, 59, 999)

// 4️⃣ Loop through plans
for (const plan of plans) {
  if (!plan.userId || !plan.noMeals) continue


  // Skip if today is not in specifyDays
  if (plan.specifyDays && Array.isArray(plan.specifyDays)) {
    if (!plan.specifyDays.includes(todayName)) continue
  }

  // Skip if the user already has an order today
  const existingOrder = await prisma.order.findFirst({
    where: {
      userId: plan.userId,
      createdAt: { gte: startOfDay, lt: endOfDay },
    },
  })
  if (existingOrder) continue

  // 🔹 Preserve duplicates from the original request
  const selectedMealIds = mealIds.slice(0, plan.noMeals+1)
  
  const items = selectedMealIds
  .map((id) => {
    const meal = mealMap.get(id)
    if (!meal) return null
    return {
      meal: { connect: { id: meal.id } },
      name: meal.name || 'Meal',
      unitPrice: meal.price || 0,
      quantity: 1,
      totalPrice: meal.price || 0,
    }
  })
  .filter((item): item is NonNullable<typeof item> => item !== null) // ✅ tells TS

  if (!items.length) continue
  if (!plan.user?.address) continue

  const subtotal = items.reduce((sum, i) => sum + i.totalPrice, 0)

  const order = await prisma.order.create({
    data: {
      userId: plan.userId,
      subtotal,
      total: subtotal,
      status: "PREPARING",
      deliveryAddress: plan.user.address,
      deliveryEta:new Date(dateAssigned).toISOString() ,
      items: { create: items },
    },
    include: { items: true },
  })

  createdOrders.push(order)
}


    if (!createdOrders.length) {
      return res.status(404).json({ error: 'No orders created — either no plans matched or all already ordered today' })
    }

    res.status(201).json(createdOrders)
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create orders from plans' })
  }
})


// POST /orders/from-plan/:planId
router.post('/orders/from-plan/:planId', async (req: Request, res: Response) => {
  try {
    const { planId } = req.params
    const { mealIds, dateAssigned } = req.body

    if (!mealIds || !Array.isArray(mealIds) || !mealIds.length) {
      return res.status(400).json({ error: 'mealIds must be a non-empty array' })
    }

    // 1️⃣ Fetch the plan with its user (for address)
    const plan = await prisma.plan.findUnique({
      where: { id: planId },
      include: { user: true }, // 👈 include user
    })

    if (!plan) {
      return res.status(404).json({ error: `Plan "${planId}" not found` })
    }

    if (!plan.userId) {
      return res.status(400).json({ error: `Plan "${planId}" is not linked to a user` })
    }

    // 2️⃣ Validate meal count matches the plan
    if (plan.noMeals !== mealIds.length - 1) {
      return res.status(400).json({
        error: `Plan requires ${plan.noMeals} meals, but ${mealIds.length} were provided`,
      })
    }

      const uniqueMealIds = [...new Set(mealIds)]

      const meals = await prisma.meal.findMany({
        where: { id: { in: uniqueMealIds }, available: true },
      })

      if (meals.length !== uniqueMealIds.length) {
        return res.status(400).json({
          error: `Some mealIds are invalid or unavailable`,
        })
      }
          const mealMap = new Map(meals.map(m => [m.id, m]))

      const items = mealIds.map(id => {
        const meal = mealMap.get(id)
        if (!meal) return null
        return {
          meal: { connect: { id: meal.id } },
          name: meal.name!,
          unitPrice: meal.price || 0,
          quantity: 1,
          totalPrice: meal.price || 0,
        }
      }).filter((item): item is NonNullable<typeof item> => item !== null) // ✅ tells TS



    const subtotal = items.reduce((sum, i) => sum + i.totalPrice, 0)
    if (!plan.user?.address) throw "User needs a delivery address"
    // 5️⃣ Create order
    const order = await prisma.order.create({
      data: {
        userId: plan.userId,
        subtotal,
        total: subtotal,
        status: "PREPARING",
        deliveryAddress: plan.user.address ,
        deliveryEta: new Date(dateAssigned).toISOString() || new Date().toISOString() , // 👈 attach user address
        items: { create: items },
      },
      include: { items: true },
    })

    res.status(201).json(order)
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create order from plan' })
  }
})


// GET ALL ORDERS (with optional filters)
router.get('/', async (req: Request, res: Response) => {
  try {
    
 
    const { userId, driverId, status, page = '1', pageSize = '10', name} = req.query
     const pageNum = parseInt(page as string, 10);
  const size = parseInt(pageSize as string, 10);
    const where: any = {}

    if (userId) where.userId = String(userId)
    if (driverId) where.driverId = String(driverId)
    if (name) where.user.fullName = { contains: name as string, mode: 'insensitive' };
    if (!status) {
      // no status filter → exclude CANCELLED
      where.status = { not: 'CANCELLED' }
    } else if (status === 'CANCELLED') {
      // explicitly fetch CANCELLED
      where.status = 'CANCELLED'
    } else {
      // filter by given status but exclude CANCELLED
      where.status = { equals: String(status), not: 'CANCELLED' }
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        items: { include: { product: true, meal: true } },
        user: true,
        driver: true,
        transactions: true,
      },
      skip: (pageNum - 1) * size,
      take: size,
      orderBy: { createdAt: 'desc' },
    })
const count = await prisma.order.count({ where })
    res.json({orders,count})
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch orders' })
  }
})


// GET SINGLE ORDER
router.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params
  try {
    const order = await prisma.order.findUnique({
      where: { id },
      include: { items: { include: { product: true, meal: true } }, user: true, driver: true, transactions: true },
    })
    if (!order) return res.status(404).json({ error: 'Order not found' })
    res.json(order)
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch order' })
  }
})

// UPDATE ORDER (general fields)
router.patch('/:id', async (req: Request, res: Response) => {
  const { id } = req.params
  try {
    const order = await prisma.order.update({
      where: { id },
      data: req.body,
      include: { items: true },
    })
    res.json(order)
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Order not found' })
    res.status(500).json({ error: err.message || 'Failed to update order' })
  }
})

// ASSIGN DRIVER
router.patch('/:id/assign-driver', async (req: Request, res: Response) => {
  const { id } = req.params
  const { driverId } = req.body
  try {
    const order = await prisma.order.update({
      where: { id },
      data: { driverId, status: 'EN_ROUTE' }, // set next status as appropriate
      include: { driver: true },
    })
    res.json(order)
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to assign driver' })
  }
})

// UPDATE ORDER STATUS (kitchen, driver, customer view)
router.patch('/:id/status', async (req: Request, res: Response) => {
  const { id } = req.params
  const { status } = req.body
  try {
    const order = await prisma.order.update({
      where: { id },
      data: { status },
    })
    res.json(order)
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update status' })
  }
})

// DELETE ORDER
router.delete('/:id', async (req: Request, res: Response) => {
  const { id } = req.params
  try {
    await prisma.order.delete({ where: { id } })
    res.json({ message: 'Order deleted' })
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Order not found' })
    res.status(500).json({ error: err.message || 'Failed to delete order' })
  }
})

export default router
