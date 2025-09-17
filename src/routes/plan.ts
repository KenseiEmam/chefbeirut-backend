// api/routes/plan.ts
import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';

const router = Router();

// Define request body types
interface PlanBody {
  userId?: string;
  status?: string;
  estimatedPrice?: number;
  type?: string;
  noMeals?: number;
  noDays?: number;
  specifyDays?: string[];
  startDate?: string;
  expiryDate?: string;
}

// ===== CREATE PLAN =====
router.post('/', async (req: Request<{}, {}, PlanBody>, res: Response) => {
  try {
    const {
      userId,
      status,
      estimatedPrice,
      type,
      noMeals,
      noDays,
      specifyDays,
      startDate,
      expiryDate,
    } = req.body;

    const plan = await prisma.plan.create({
      data: {
        userId,
        status,
        estimatedPrice,
        type,
        noMeals,
        noDays,
        specifyDays,
        startDate: startDate ? new Date(startDate) : undefined,
        expiryDate: expiryDate ? new Date(expiryDate) : undefined,
      },
    });

    res.status(201).json(plan);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create plan' });
  }
});

// ===== FETCH ALL PLANS =====
router.get('/', async (req: Request, res: Response) => {
  try {
    const { userId, driverId, status } = req.query
    const where: any = {}

    if (userId) where.userId = String(userId)
    if (driverId) where.driverId = String(driverId)

    if (!status) {
      // no status filter → exclude cancelled
      where.status = { not: 'cancelled' }
    } else if (status === 'cancelled') {
      // explicitly fetch cancelled
      where.status = 'cancelled'
    } else {
      // filter by given status but exclude cancelled
      where.status = { equals: String(status), not: 'cancelled' }
    }
    const plans = await prisma.plan.findMany({
      where,
      include: { user: true },
    });
    res.json(plans);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch plans' });
  }
});

// ===== FETCH SINGLE PLAN =====
router.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const plan = await prisma.plan.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!plan) return res.status(404).json({ error: 'Plan not found' });

    res.json(plan);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch plan' });
  }
});

// ===== UPDATE PLAN =====
router.patch('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const body: PlanBody = req.body;

  try {
    const plan = await prisma.plan.update({
      where: { id },
      data: {
        ...body,
        startDate: body.startDate ? new Date(body.startDate) : undefined,
        expiryDate: body.expiryDate ? new Date(body.expiryDate) : undefined,
      },
    });

    res.json(plan);
  } catch (err: any) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Plan not found' });
    }
    res.status(500).json({ error: err.message || 'Failed to update plan' });
  }
});

// ===== DELETE PLAN =====
router.delete('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    await prisma.plan.delete({ where: { id } });
    res.json({ message: 'Plan deleted successfully' });
  } catch (err: any) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Plan not found' });
    }
    res.status(500).json({ error: err.message || 'Failed to delete plan' });
  }
});

export default router;
