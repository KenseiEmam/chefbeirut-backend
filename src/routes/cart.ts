import express from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = express.Router();



// ==================== CART ====================

// Get cart items for a user
router.get("/cart/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    const cartItems = await prisma.cartItem.findMany({
      where: { userId },
      include: { product: true },
    });
    res.json(cartItems);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch cart", details: err });
  }
});

// Add item to cart
router.post("/cart", async (req, res) => {
  const { userId, productId, quantity } = req.body;
  try {
    const cartItem = await prisma.cartItem.create({
      data: { userId, productId, quantity },
      include: { product: true },
    });
    res.json(cartItem);
  } catch (err) {
    res.status(500).json({ error: "Failed to add to cart", details: err });
  }
});

// Update cart item quantity
router.put("/cart/:id", async (req, res) => {
  const { id } = req.params;
  const { quantity } = req.body;
  try {
    const cartItem = await prisma.cartItem.update({
      where: { id },
      data: { quantity },
      include: { product: true },
    });
    res.json(cartItem);
  } catch (err) {
    res.status(500).json({ error: "Failed to update cart item", details: err });
  }
});

// Remove item from cart
router.delete("/cart/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.cartItem.delete({ where: { id } });
    res.json({ message: "Cart item removed" });
  } catch (err) {
    res.status(500).json({ error: "Failed to remove cart item", details: err });
  }
});

export default router;
