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
    const status = req.query.status as string;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { companyName: true, contactName: true } },
          assignee: { select: { name: true } },
          items: { include: { product: { select: { name: true, sku: true } } } },
        },
      }),
      prisma.order.count({ where }),
    ]);

    res.json({ data: orders, meta: { total, page, limit, pages: Math.ceil(total / limit) } });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        customer: true,
        assignee: { select: { id: true, name: true, email: true } },
        items: { include: { product: true } },
      },
    });
    if (!order) return next(new AppError(404, 'Order not found'));
    res.json(order);
  } catch (err) {
    next(err);
  }
});

router.post(
  '/',
  authorize('admin', 'sales'),
  [
    body('customerId').notEmpty(),
    body('assignedTo').notEmpty(),
    body('items').isArray({ min: 1 }),
    body('items.*.productId').notEmpty(),
    body('items.*.quantity').isInt({ min: 1 }),
    body('items.*.unitPrice').isNumeric(),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return next(new AppError(400, errors.array()[0].msg));

    try {
      const { customerId, assignedTo, items, notes } = req.body;

      const totalAmount = items.reduce(
        (sum: number, item: { quantity: number; unitPrice: number }) =>
          sum + item.quantity * item.unitPrice,
        0
      );

      const orderNumber = `ORD-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

      const order = await prisma.order.create({
        data: {
          orderNumber,
          customerId,
          assignedTo,
          totalAmount,
          notes,
          items: {
            create: items.map((item: { productId: string; quantity: number; unitPrice: number }) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              total: item.quantity * item.unitPrice,
            })),
          },
        },
        include: {
          customer: { select: { companyName: true } },
          items: { include: { product: { select: { name: true, sku: true } } } },
        },
      });

      res.status(201).json(order);
    } catch (err) {
      next(err);
    }
  }
);

router.put('/:id/status', authorize('admin', 'sales'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) return next(new AppError(400, 'Invalid status'));

    const order = await prisma.order.update({ where: { id: req.params.id }, data: { status } });
    res.json(order);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', authorize('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.order.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
