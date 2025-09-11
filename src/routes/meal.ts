import { Router, Request, Response } from 'express'
import prisma from '../lib/prisma'

const router = Router()

interface MealBody {
  name?: string
  description?: string
  price: number
  available?: boolean
  stock?: number
  ingredients?: any // Json
  macros?: any // Json
  photo?: string
  category?: string
}

// CREATE MEAL
router.post('/', async (req: Request<{}, {}, MealBody>, res: Response) => {
  try {
    const meal = await prisma.meal.create({ data: req.body })
    res.status(201).json(meal)
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create meal' })
  }
})

// GET ALL MEALS (with optional filters: available, category, search)
router.get('/', async (req: Request, res: Response) => {
  try {
    const { available, category, q } = req.query
    const where: any = {}

    if (available !== undefined) where.available = available === 'true'
    if (category) where.category = String(category)
    if (q) where.name = { contains: String(q), mode: 'insensitive' }

    const meals = await prisma.meal.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })
    res.json(meals)
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch meals' })
  }
})

// GET SINGLE MEAL
router.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params
  try {
    const meal = await prisma.meal.findUnique({ where: { id } })
    if (!meal) return res.status(404).json({ error: 'Meal not found' })
    res.json(meal)
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch meal' })
  }
})

// UPDATE MEAL
router.patch('/:id', async (req: Request, res: Response) => {
  const { id } = req.params
  try {
    const meal = await prisma.meal.update({
      where: { id },
      data: req.body,
    })
    res.json(meal)
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Meal not found' })
    res.status(500).json({ error: err.message || 'Failed to update meal' })
  }
})

// DELETE MEAL
router.delete('/:id', async (req: Request, res: Response) => {
  const { id } = req.params
  try {
    await prisma.meal.delete({ where: { id } })
    res.json({ message: 'Meal deleted' })
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Meal not found' })
    res.status(500).json({ error: err.message || 'Failed to delete meal' })
  }
})

export default router
