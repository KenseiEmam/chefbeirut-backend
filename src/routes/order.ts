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
  note?: string
  items: OrderItemInput[]
}

// CREATE ORDER (creates order + items + optional transactions later)
router.post('/', async (req: Request<{}, {}, OrderBody>, res: Response) => {
  try {
    const { userId, deliveryAddress, paymentMethod, deliveryFee, note, items } = req.body

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
    const { type, mealCategory } = req.body

    if (!type || !mealCategory) {
      return res.status(400).json({ error: 'type and mealCategory are required' })
    }

    // 1️⃣ Fetch all plans of this type
    const plans = await prisma.plan.findMany({
      where: { type },
    })

    if (!plans.length) {
      return res.status(404).json({ error: 'No plans found for this type' })
    }

    // 2️⃣ Fetch all meals that match type & category, ordered by creation date
    const meals = await prisma.meal.findMany({
      where: { type, category: mealCategory, available: true },
      orderBy: { createdAt: 'asc' },
    })

    if (!meals.length) {
      return res.status(404).json({ error: `No meals found for category "${mealCategory}" and type "${type}"` })
    }

    // 3️⃣ Map type -> first meal (to pick quickly per plan)
    const mealMap = new Map<string, typeof meals[0]>()
    for (const meal of meals) {
      if (!mealMap.has(meal.type!)) {
        mealMap.set(meal.type!, meal)
      }
    }

    const createdOrders: any[] = []

    // 4️⃣ Loop through plans and create one order per plan
    for (const plan of plans) {
      if (!plan.userId) continue

      const meal = mealMap.get(plan.type!)
      if (!meal) continue

      const item = {
        mealId: meal.id,
        name: meal.name!,
        unitPrice: meal.price || 0,
        quantity: 1,
        totalPrice: meal.price || 0,
      }

      const order = await prisma.order.create({
        data: {
          userId: plan.userId,
          subtotal: item.totalPrice,
          total: item.totalPrice,
          status:"PREPARING",
          items: { create: [item] },
        },
        include: { items: true },
      })

      createdOrders.push(order)
    }

    if (!createdOrders.length) {
      return res.status(404).json({ error: 'No orders could be created — no matching meals found for any plan' })
    }

    res.status(201).json(createdOrders)
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create orders from plans' })
  }
})

// GET ALL ORDERS (with optional filters)
router.get('/', async (req: Request, res: Response) => {
  try {
    const { userId, status } = req.query
    const where: any = {}
    if (userId) where.userId = String(userId)
    if (status) where.status = String(status)

    const orders = await prisma.order.findMany({
      where,
      include: { items: { include: { product: true, meal: true } }, user: true, driver: true, transactions: true },
      orderBy: { createdAt: 'desc' },
    })
    res.json(orders)
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
