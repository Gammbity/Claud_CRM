import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { authenticate, authorize } from '../middleware/auth';
import { AppError } from '../middleware/error';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
    const search = req.query.search as string;
    const status = req.query.status as string;

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { companyName: { contains: search, mode: 'insensitive' } },
        { contactName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (status) where.status = status;

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { leads: true, orders: true } } },
      }),
      prisma.customer.count({ where }),
    ]);

    res.json({ data: customers, meta: { total, page, limit, pages: Math.ceil(total / limit) } });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: req.params.id },
      include: {
        leads: { orderBy: { createdAt: 'desc' }, take: 5 },
        orders: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });
    if (!customer) return next(new AppError(404, 'Customer not found'));
    res.json(customer);
  } catch (err) {
    next(err);
  }
});

router.post(
  '/',
  authorize('admin', 'sales'),
  [
    body('companyName').trim().isLength({ min: 2 }),
    body('contactName').trim().isLength({ min: 2 }),
    body('phone').trim().notEmpty(),
    body('email').isEmail().normalizeEmail(),
    body('status').optional().isIn(['active', 'inactive', 'prospect']),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return next(new AppError(400, errors.array()[0].msg));

    try {
      const customer = await prisma.customer.create({ data: req.body });
      res.status(201).json(customer);
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  '/:id',
  authorize('admin', 'sales'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const customer = await prisma.customer.update({ where: { id }, data: req.body });
      res.json(customer);
    } catch (err) {
      next(err);
    }
  }
);

router.delete('/:id', authorize('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.customer.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
