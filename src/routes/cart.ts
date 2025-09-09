import { Router, Request, Response } from 'express'
import prisma from '../lib/prisma'

const router = Router()

interface CartBody {
  userId?: string
  estimatedPrice?: number
}

/**
 * GET /api/cart
 * Optional query: ?userId=...
 * Returns all carts (or carts filtered by userId)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { userId } = req.query
    const where: any = {}
    if (userId) where.userId = String(userId)

    const carts = await prisma.cart.findMany({
      where,
      include: {
        items: { include: { product: true, plan: true } },
        user: true,
      },
      orderBy: { updatedAt: 'desc' },
    })
    res.json(carts)
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch carts', details: err?.message || err })
  }
})

/**
 * GET /api/cart/:id
 * Returns a single cart by id (includes items)
 */
router.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params
  try {
    const cart = await prisma.cart.findUnique({
      where: { id },
      include: { items: { include: { product: true, plan: true } }, user: true },
    })
    if (!cart) return res.status(404).json({ error: 'Cart not found' })
    res.json(cart)
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch cart', details: err?.message || err })
  }
})

/**
 * POST /api/cart
 * Body: { userId, estimatedPrice? }
 * Creates a new cart (frontend should call this explicitly)
 */
router.post('/', async (req: Request<{}, {}, CartBody>, res: Response) => {
  const { userId, estimatedPrice } = req.body
  if (!userId) return res.status(400).json({ error: 'userId is required' })

  try {
    const cart = await prisma.cart.create({
      data: { userId, estimatedPrice },
      include: { items: { include: { product: true, plan: true } }, user: true },
    })
    res.status(201).json(cart)
  } catch (err: any) {
    // handle unique constraint - cart.userId is unique
    if (err?.code === 'P2002') {
      return res.status(400).json({ error: 'Cart already exists for this user' })
    }
    res.status(500).json({ error: 'Failed to create cart', details: err?.message || err })
  }
})

/**
 * PATCH /api/cart/:id
 * Body can include: { estimatedPrice, userId } (you can also restrict fields)
 */
router.patch('/:id', async (req: Request, res: Response) => {
  const { id } = req.params
  const data = req.body as CartBody
  try {
    const cart = await prisma.cart.update({
      where: { id },
      data,
      include: { items: { include: { product: true, plan: true } }, user: true },
    })
    res.json(cart)
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Cart not found' })
    if (err?.code === 'P2002') return res.status(400).json({ error: 'Unique constraint error', details: err.message })
    res.status(500).json({ error: 'Failed to update cart', details: err?.message || err })
  }
})

/**
 * DELETE /api/cart/:id
 * Delete whole cart and cascade deletes of CartItems handled by DB if set up.
 */
router.delete('/:id', async (req: Request, res: Response) => {
  const { id } = req.params
  try {
    await prisma.cart.delete({ where: { id } })
    res.json({ message: 'Cart deleted successfully' })
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Cart not found' })
    res.status(500).json({ error: 'Failed to delete cart', details: err?.message || err })
  }
})

export default router
