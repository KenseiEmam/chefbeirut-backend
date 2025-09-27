import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import userRoutes from './routes/user';
import planRoutes from './routes/plan';
import cartRoutes from './routes/cart';
import cartItemRoutes from './routes/cartItem';
import productRoutes from './routes/product';
import mealRoutes from './routes/meal';
import orderRoutes from './routes/order';
import transactionRoutes from './routes/transaction';
import storageRoutes from './routes/storage';
import emailRoutes from './routes/email'
import { authenticateApp } from "./auth"
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(authenticateApp)
// ==================== API ROUTES ====================
app.use('/api/users', userRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/carts', cartRoutes);
app.use('/api/cart-items', cartItemRoutes);
app.use('/api/products', productRoutes);
app.use('/api/meals', mealRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/media', storageRoutes);
app.use("/api/email", emailRoutes)
// ==================== SERVER ==================== 
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
