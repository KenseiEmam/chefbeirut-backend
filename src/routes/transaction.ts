import { Router, Request, Response } from 'express'
import prisma from '../lib/prisma'

const router = Router()

interface TransactionBody {
  userId?: string
  orderId?: string
  amount: number
  currency?: string
  method?: string
  status?: string
  receipt?: any
}

// CREATE TRANSACTION (link to order)
router.post('/', async (req: Request<{}, {}, TransactionBody>, res: Response) => {
  try {
    const tx = await prisma.transaction.create({
      data: req.body,
    })

    // Optionally update order.paymentStatus when transaction succeeded
    if (req.body.orderId && req.body.status === 'succeeded') {
      await prisma.order.update({ where: { id: req.body.orderId }, data: { paymentStatus: 'PAID' } })
    }

    res.status(201).json(tx)
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create transaction' })
  }
})

// GET ALL TRANSACTIONS (filter by user or order)
router.get('/', async (req: Request, res: Response) => {
  try {
    const { userId, orderId } = req.query
    const where: any = {}
    if (userId) where.userId = String(userId)
    if (orderId) where.orderId = String(orderId)

    const txs = await prisma.transaction.findMany({ where, orderBy: { createdAt: 'desc' } })
    res.json(txs)
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch transactions' })
  }
})

// GET SINGLE TRANSACTION
router.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params
  try {
    const tx = await prisma.transaction.findUnique({ where: { id }, include: { user: true, order: true } })
    if (!tx) return res.status(404).json({ error: 'Transaction not found' })
    res.json(tx)
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch transaction' })
  }
})

// UPDATE TRANSACTION (e.g., mark refunded)
router.patch('/:id', async (req: Request, res: Response) => {
  const { id } = req.params
  try {
    const tx = await prisma.transaction.update({ where: { id }, data: req.body })
    res.json(tx)
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Transaction not found' })
    res.status(500).json({ error: err.message || 'Failed to update transaction' })
  }
})

// DELETE TRANSACTION
router.delete('/:id', async (req: Request, res: Response) => {
  const { id } = req.params
  try {
    await prisma.transaction.delete({ where: { id } })
    res.json({ message: 'Transaction deleted' })
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Transaction not found' })
    res.status(500).json({ error: err.message || 'Failed to delete transaction' })
  }
})

export default router
