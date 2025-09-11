import { Router, Request, Response } from 'express'
import prisma from "../lib/prisma"
import { Prisma } from '@prisma/client'

const router = Router()


interface CartItemBody {
  cartId: string
  productId?: string
  plan?: any 
  quantity?: number
}


/**
 * GET /api/cart-items
 * Optional query: ?cartId=... or ?userId=...
 * Returns items optionally filtered by cart or by user (via cart.userId).
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { cartId, userId } = req.query
    if (cartId) {
      const items = await prisma.cartItem.findMany({
        where: { cartId: String(cartId) },
        include: { product: true},
      })
      return res.json(items)
    }
    if (userId) {
      // fetch cart by user then items
      const cart = await prisma.cart.findUnique({ where: { userId: String(userId) } })
      if (!cart) return res.json([])
      const items = await prisma.cartItem.findMany({
        where: { cartId: cart.id },
        include: { product: true},
      })
      return res.json(items)
    }

    // default: return all items (admin)
    const items = await prisma.cartItem.findMany({ include: { product: true} })
    res.json(items)
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch cart items', details: err?.message || err })
  }
})

/**
 * GET /api/cart-items/:id
 * Returns a single cart item by id (including product/plan)
 */
router.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params
  try {
    const item = await prisma.cartItem.findUnique({
      where: { id },
      include: { product: true},
    })
    if (!item) return res.status(404).json({ error: 'Cart item not found' })
    res.json(item)
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch cart item', details: err?.message || err })
  }
})

router.post('/', async (req: Request<{}, {}, CartItemBody>, res: Response) => {
  const { cartId, productId, plan, quantity = 1 } = req.body

  if (!cartId) return res.status(400).json({ error: 'cartId is required' })
  if (!productId && !plan) return res.status(400).json({ error: 'productId or plan is required' })
  if (productId && plan) return res.status(400).json({ error: 'Provide either productId or plan, not both' })
  if (quantity <= 0) return res.status(400).json({ error: 'quantity must be >= 1' })

  try {
    const cart = await prisma.cart.findUnique({ where: { id: cartId } })
    if (!cart) return res.status(404).json({ error: 'Cart not found' })

    const created = await prisma.cartItem.create({
      data: {
        cartId,
        productId: productId ?? undefined,
        plan: plan ?? undefined,
        quantity,
      },
      include: { product: true }, // only relations can be included
    })

    res.status(201).json(created)
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create cart item', details: err?.message || err })
  }
})

/**
 * PATCH /api/cart-items/:id
 */
router.patch('/:id', async (req: Request, res: Response) => {
  const { id } = req.params
  const { quantity, productId, plan } = req.body as Partial<CartItemBody>

  try {
    if (productId && plan) return res.status(400).json({ error: 'Provide either productId or plan, not both' })
    if (plan && typeof plan !== 'object') return res.status(400).json({ error: 'plan must be a valid object' })
    if (typeof quantity === 'number' && quantity <= 0) {
      await prisma.cartItem.delete({ where: { id } })
      return res.json({ message: 'Cart item removed' })
    }

    const data: any = {}
    if (typeof quantity === 'number') data.quantity = quantity
    if (productId !== undefined) { data.productId = productId; data.plan = null }
    if (plan !== undefined) { data.plan = plan as Prisma.InputJsonValue; data.productId = null }

    const updated = await prisma.cartItem.update({
      where: { id },
      data,
      include: { product: true },
    })

    res.json(updated)
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Cart item not found' })
    res.status(500).json({ error: 'Failed to update cart item', details: err?.message || err })
  }
})


/**
 * DELETE /api/cart-items/:id
 */
router.delete('/:id', async (req: Request, res: Response) => {
  const { id } = req.params
  try {
    await prisma.cartItem.delete({ where: { id } })
    res.json({ message: 'Cart item deleted' })
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Cart item not found' })
    res.status(500).json({ error: 'Failed to delete cart item', details: err?.message || err })
  }
})

export default router
