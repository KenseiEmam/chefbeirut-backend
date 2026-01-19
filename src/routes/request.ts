// api/routes/plan.ts
import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import Stripe from "stripe"
import { sendEmail } from '../services/mailer'
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
      include:{
        user:true
      }
    })
    if(request.user)
    await sendEmail({
          to: request.user.email,
          subject: 'We have recieved your request!',
          html: `
            <p>Hi ${request.user.fullName},</p>
            <p>Your <strong>${request.type}</strong> request for Plan of Id: <strong>${request.planId}</strong> has been recieved.</p>
            <p>Our staff will review it shortly and be in contact whenever possible!</p>
            <p>— Chef Beirut</p>
          `,
      })

    await sendEmail({
          to: 'admin@chefbeirut.ae',
          subject: `New ${request.type} Request`,
          html: `
            <p>Hi Chef,</p>
            <p>A <strong>${request.type}</strong> request for Plan of Id: <strong>${request.planId}</strong> has been issued.</p>
            <p>Request Reason: ${request.reason} </p>
            <br>
            <a href="${process.env.BASE_URL}/dashboard/requests/${request.id}}">Click here to view the request!</a>
            <p>— Chef Beirut</p>
          `,
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
    const { userId, status, page = '1', pageSize = '10' } = req.query
    const where: any = {}
    const pageNum = parseInt(page as string, 10);
    const size = parseInt(pageSize as string, 10);
    if (userId) where.userId = String(userId)
    if (status) where.status = String(status)
   

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
      include:{user:true}
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
        
      prisma.order.updateMany({
        where: {userId: request.userId, status:"PREPARING" },
        data:{
          status:"CANCELLED",
          cancelReason: "Plan cancelled and refunded!",
          cancelDate:new Date
        }
      }),
      ])
       if(request.user)
    await sendEmail({
          to: request.user.email,
          subject: 'Your Changes were accepted!',
          html: `
            <p>Hi ${request.user.fullName},</p>
            <p>We have applied your requested changes for Plan of Id: <strong>${request.planId}</strong>.</p>
            <p>Check your dashboard to review these new changes!</p>
            <p>Happy to have served you at Chef Beirut!</p>
            <p>— Chef Beirut</p>
          `,
      })
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
      if(request.user)
    await sendEmail({
          to: request.user.email,
          subject: 'Your Plan was Cancelled!',
          html: `
            <p>Hi ${request.user.fullName},</p>
            <p>Your Plan of Id: <strong>${request.planId}</strong> was cancelled.</p>
            <p>After great consideration from our staff and reviewing the conversation, we unfortunately can not refund you at the time being.</p>
            <p>Hope we can serve you better in the future!</p>
            <p>— Chef Beirut</p>
          `,
      })
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

    const request = await prisma.planRequest.update({
      where: { id },
      data: {
        status: "DENIED",
        adminNotes,
      },
      include:{user:true,plan:true}
    })
     if(request.user)
    await sendEmail({
          to: request.user.email,
          subject: 'Your request has been denied!',
          html: `
            <p>Hi ${request.user.fullName},</p>
            <p>Your <strong>${request.planId}</strong> for Plan of Id: <strong>${request.planId}</strong> was denied.</p>
            <p>After great consideration from our staff and reviewing the conversation, we unfortunately can not accept the request at the time being.</p>
            <p>Hope we can serve you better in the future!</p>
            <p>— Chef Beirut</p>
          `,
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
    const { adminNotes } = req.body
    const request = await prisma.planRequest.findUnique({
      where: { id },
      include: { user: true, plan:true },
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
          adminNotes,
          status: "REFUNDED",
          refundedAt: new Date(),
        },
      
      }),
      prisma.order.updateMany({
        where: {userId: request.userId, status:"PREPARING" },
        data:{
          status:"CANCELLED",
          cancelReason: "Plan cancelled and refunded!",
          cancelDate:new Date
        }
      }),
    ])

  await prisma.transaction.update({
  where: { id: transaction.id },
  data: {
    status: "refunded",
    refunded:true
  }})

  
  if(request.user)
    await sendEmail({
          to: request.user.email,
          subject: 'You are being refunded!',
          html: `
            <p>Hi ${request.user.fullName},</p>
            <p>Your  Plan of Id: <strong>${request.planId}</strong> has been cancelled and a refund is on its it's way.</p>
            <p>After great consideration from our staff and reviewing the conversation, we have decided to refund you from our end! Please await stripe processing to complete this refund.</p>
            <p>Hope we can serve you better in the future!</p>
            <p>— Chef Beirut</p>
          `,
      })
    res.json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Refund failed" })
  }

})


export default router;
