import express from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = express.Router();

// ==================== PRODUCTS ====================

// Get all products
router.get("/", async (req, res) => {
  try {
    const { page = '1', pageSize = '10' } = req.query;
    const pageNum = parseInt(page as string, 10);
  const size = parseInt(pageSize as string, 10);
    const products = await prisma.product.findMany({
      skip: (pageNum - 1) * size,
      take: size,
      include: {
        reviews: true, // include related reviews
      },
    });
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch products", details: err });
  }
});

// Get single product by ID
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const product = await prisma.product.findUnique({
      where: { id },
      include: { reviews: true },
    });
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch product", details: err });
  }
});

// Create a new product
router.post("/", async (req, res) => {
  const { name, description, details, price, discount, stock, deliveryTime, photo } = req.body;
  try {
    const product = await prisma.product.create({
      data: { name, description, details, price, discount, stock, deliveryTime, photo },
    });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: "Failed to create product", details: err });
  }
});

// Update a product by ID
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  try {
    const product = await prisma.product.update({
      where: { id },
      data: updates,
    });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: "Failed to update product", details: err });
  }
});

// Delete a product by ID
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.product.delete({ where: { id } });
    res.json({ message: "Product deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete product", details: err });
  }
});

export default router;
