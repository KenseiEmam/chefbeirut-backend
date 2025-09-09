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
            unitPrice: m.price,
            quantity: it.quantity,
            totalPrice: (m.price * it.quantity),
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
