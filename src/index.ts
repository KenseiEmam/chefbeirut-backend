import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import userRoutes from './routes/user';
import planRoutes from './routes/plan';
import productRoutes from './routes/product';
import mealRoutes from './routes/meal';
import orderRoutes from './routes/order';
import transactionRoutes from './routes/transaction';
import storageRoutes from './routes/storage';
import emailRoutes from './routes/email'
import { authenticateApp } from "./auth"
import stripeWebhookRoutes from "./routes/stripeWebhook"
import stripeRoutes from "./routes/stripe"
import scheduleRoutes from "./routes/schedule"
import requestRoutes from "./routes/request"
import './cron'

dotenv.config();

const app = express();
app.use(cors());
// ⚠️ Stripe webhook MUST come before express.json()
app.use(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  stripeWebhookRoutes
)

app.use(express.json());
app.use(authenticateApp)
// ==================== API ROUTES ====================
app.use('/api/users', userRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/products', productRoutes);
app.use('/api/meals', mealRoutes);
app.use('/api/orders', orderRoutes);
app.use("/api/stripe", stripeRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/media', storageRoutes);
app.use("/api/email", emailRoutes)
app.use("/api/schedule", scheduleRoutes)
// ==================== SERVER ==================== 
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
