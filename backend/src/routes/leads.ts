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
    const assignedTo = req.query.assignedTo as string;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (assignedTo) where.assignedTo = assignedTo;

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { companyName: true, contactName: true } },
          assignee: { select: { name: true, email: true } },
        },
      }),
      prisma.lead.count({ where }),
    ]);

    res.json({ data: leads, meta: { total, page, limit, pages: Math.ceil(total / limit) } });
  } catch (err) {
    next(err);
  }
});

router.get('/funnel', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const funnel = await prisma.lead.groupBy({
      by: ['status'],
      _count: { status: true },
      _sum: { value: true },
    });
    res.json(funnel);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: req.params.id },
      include: {
        customer: true,
        assignee: { select: { id: true, name: true, email: true, role: true } },
      },
    });
    if (!lead) return next(new AppError(404, 'Lead not found'));
    res.json(lead);
  } catch (err) {
    next(err);
  }
});

router.post(
  '/',
  authorize('admin', 'sales'),
  [
    body('title').trim().isLength({ min: 3 }),
    body('customerId').notEmpty(),
    body('assignedTo').notEmpty(),
    body('value').isNumeric(),
    body('status').optional().isIn(['new', 'contacted', 'proposal', 'won', 'lost']),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return next(new AppError(400, errors.array()[0].msg));

    try {
      const lead = await prisma.lead.create({
        data: req.body,
        include: {
          customer: { select: { companyName: true } },
          assignee: { select: { name: true } },
        },
      });
      res.status(201).json(lead);
    } catch (err) {
      next(err);
    }
  }
);

router.put('/:id', authorize('admin', 'sales'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const lead = await prisma.lead.update({
      where: { id: req.params.id },
      data: req.body,
      include: {
        customer: { select: { companyName: true } },
        assignee: { select: { name: true } },
      },
    });
    res.json(lead);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', authorize('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.lead.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
