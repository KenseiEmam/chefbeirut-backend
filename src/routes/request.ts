// api/routes/plan.ts
import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import Stripe from "stripe"

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)


// ===== CREATE REQUEST =====
router.post("/", async (req, res) => {
  try {
    const {
      userId,
      planId,
      type, // PLAN_CHANGE | CANCELLATION
      reason,
      requestedData,
    } = req.body

    if (!userId || !planId || !type) {
      return res.status(400).json({ error: "Missing required fields" })
    }

    if (type === "CANCELLATION" && !reason) {
      return res.status(400).json({ error: "Cancellation reason is required" })
    }

    // Prevent multiple pending requests per plan
    const existing = await prisma.planRequest.findFirst({
      where: {
        planId,
        status: "PENDING",
      },
    })

    if (existing) {
      return res.status(400).json({
        error: "You already have a pending request for this plan",
      })
    }

    const request = await prisma.planRequest.create({
      data: {
        userId,
        planId,
        type,
        reason,
        requestedData,
      },
    })
    
    res.json(request)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Failed to create request" })
  }
})



// ===== FETCH ALL REQUESTS FOR ADMINS =====
router.get("/", async (req, res) => {
  try {
    const { userId, page = '1', pageSize = '10' } = req.query
    const where: any = {}
    const pageNum = parseInt(page as string, 10);
    const size = parseInt(pageSize as string, 10);
    if (userId) where.userId = String(userId)
   

    const requests = await prisma.planRequest.findMany({
      where,
      skip: (pageNum - 1) * size,
      take: size,
      include: {
        user: true,
        plan: true,
      },
      orderBy: { createdAt: "desc" },
    })
    const count = await prisma.planRequest.count({ where })
    res.json({requests, count})
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch requests" })
  }
})
// ===== FETCH SINGLE REQUEST =====
router.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const plan = await prisma.planRequest.findUnique({
      where: { id },
      include: { user: true, plan:true },
    });

    if (!plan) return res.status(404).json({ error: 'Plan Request not found' });

    res.json(plan);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch plan request' });
  }
});

// ===== ACCEPT REQUEST =====
router.post("/:id/accept", async (req, res) => {
  try {
    const { id } = req.params
    const { adminNotes } = req.body

    const request = await prisma.planRequest.findUnique({
      where: { id },
    })

    if (!request || request.status !== "PENDING") {
      return res.status(400).json({ error: "Invalid request" })
    }

    if (request.type === "PLAN_CHANGE") {
      await prisma.$transaction([
        prisma.plan.update({
          where: { id: request.planId },
          data: request.requestedData as any,
        }),
        prisma.planRequest.update({
          where: { id },
          data: { status: "ACCEPTED", adminNotes },
        }),
      ])
    } else {
      // Cancellation without refund
      await prisma.$transaction([
        prisma.plan.update({
          where: { id: request.planId },
          data: { status: "cancelled" },
        }),
        prisma.planRequest.update({
          where: { id },
          data: { status: "ACCEPTED", adminNotes },
        }),
      ])
    }

    res.json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Failed to accept request" })
  }
})
// ===== DENY REQUEST =====
router.post("/:id/deny", async (req, res) => {
  try {
    const { id } = req.params
    const { adminNotes } = req.body

    await prisma.planRequest.update({
      where: { id },
      data: {
        status: "DENIED",
        adminNotes,
      },
    })

    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: "Failed to deny request" })
  }
})


// ===== REFUND PLAN =====
router.post("/:id/refund", async (req, res) => {
  try {
    const { id } = req.params

    const request = await prisma.planRequest.findUnique({
      where: { id },
      include: { user: true },
    })

    if (!request || request.type !== "CANCELLATION") {
      return res.status(400).json({ error: "Invalid refund request" })
    }

    const transaction = await prisma.transaction.findFirst({
      where: {
        userId: request.userId,
        status: "paid",
      },
      orderBy: { createdAt: "desc" },
    })

    if (!transaction?.receipt) {
      return res.status(400).json({ error: "No transaction found" })
    }

          const receipt = transaction.receipt as {
        paymentIntentId?: string
      }

      if (!receipt?.paymentIntentId) {
        return res.status(400).json({ error: "Payment intent not found" })
      }

      await stripe.refunds.create({
        payment_intent: receipt.paymentIntentId,
      })


    await prisma.$transaction([
      prisma.plan.update({
        where: { id: request.planId },
        data: { status: "cancelled" },
      }),
      prisma.planRequest.update({
        where: { id },
        data: {
          status: "REFUNDED",
          refundedAt: new Date(),
        },
      
      }),
    ])

  await prisma.transaction.update({
  where: { id: transaction.id },
  data: {
    status: "refunded",
  }})
    res.json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Refund failed" })
  }
})


export default router;
