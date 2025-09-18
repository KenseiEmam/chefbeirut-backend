import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';
import { equal } from 'assert';

const router = Router();

// Define request body types
interface RegisterBody {
  avatar?: string;
  email: string;
  gender?: string;
  password?: string;
  fullName: string;
  phone?: string;
  dob?: string;
  nationality?: string;
  dietProfile?: string[];
  roles?: string[];
  address?:string;
}

interface LoginBody {
  email: string;
  password: string;
}

// JWT secret (use env variable in production!)
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';

// ===== REGISTER =====
router.post('/register', async (req: Request<{}, {}, RegisterBody>, res: Response) => {
  const { avatar, email, gender, fullName, phone, dob, nationality, dietProfile, roles, password } = req.body;

  if (!email || !fullName || !password) {
    return res.status(400).json({ error: 'Email, fullName, and password are required' });
  }

  try {
    const existingUser = await prisma.user.findFirst({
      where: {
        email: {
          equals: email as string,
          mode: 'insensitive',
        },
      },
    });
    if (existingUser) {
      return res.status(409).json({ error: 'Email already in use' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user WITH hashed password
    const user = await prisma.user.create({
      data: {
        avatar,
        email,
        gender,
        fullName,
        phone,
        dob: dob ? new Date(dob) : undefined,
        nationality,
        dietProfile,
        roles,
        password: hashedPassword,
      },
    });

    const { password: _, ...userWithoutPassword } = user;
    res.status(201).json(userWithoutPassword);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to register user' });
  }
});

// ===== LOGIN =====
router.post('/login', async (req: Request<{}, {}, LoginBody>, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    // Use findFirst for case-insensitive email search
    const user = await prisma.user.findFirst({
      where: {
        email: {
          equals: email as string,
          mode: 'insensitive',
        },
      },
    });

    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!user.password) return res.status(403).json({ error: 'User has not set a password yet' });

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return res.status(401).json({ error: 'Invalid credentials' });

    // Sign JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Exclude password from response
    const { password: _, ...userWithoutPassword } = user;

    res.json({ user: userWithoutPassword, token });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to login' });
  }
});

// ===== UPDATE SINGLE USER =====
router.patch('/:id', async (req: Request, res: Response) => {
  const { id } = req.params; // id from the URL
  const body = req.body; // fields to update

  try {
    const user = await prisma.user.update({
      where: { id }, // Prisma expects an object
      data: body,
    });

    res.json(user); // return updated user
  } catch (err: any) {
    if (err.code === 'P2025') {
      // Prisma error code for "record not found"
      return res.status(404).json({ error: 'User not found' });
    }
    res.status(500).json({ error: err.message || 'Failed to update user' });
  }
});

// ===== FETCH SINGLE USER =====
router.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { password: _, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch user' });
  }
});

// ===== FETCH MULTIPLE USERS (with optional filters) =====
router.get('/', async (req: Request, res: Response) => {
  const { page = '1', pageSize = '10', roles, name } = req.query;
  const pageNum = parseInt(page as string, 10);
  const size = parseInt(pageSize as string, 10);

  try {
    const filters: any = {};
    if (roles) filters.roles = { hasSome: (roles as string).split(',') };
    if (name) filters.fullName = { contains: name as string, mode: 'insensitive' };

    const [users, count] = await Promise.all([
      prisma.user.findMany({
        where: filters,
        skip: (pageNum - 1) * size,
        take: size,
      }),
      prisma.user.count({ where: filters }),
    ]);

    const usersWithoutPasswords = users.map((u: { [x: string]: any; password: any; }) => {
      const { password, ...rest } = u;
      return rest;
    });

    res.json({ users: usersWithoutPasswords, count });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch users' });
  }
});

export default router;
