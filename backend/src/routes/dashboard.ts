import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);

// Main dashboard stats — BTEC C.P5: business KPI aggregation
router.get('/stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalCustomers,
      totalLeads,
      totalOrders,
      wonLeads,
      revenueThisMonth,
      totalRevenue,
      leadsByStatus,
      topCustomers,
      recentOrders,
      monthlyRevenue,
    ] = await Promise.all([
      prisma.customer.count(),
      prisma.lead.count(),
      prisma.order.count(),
      prisma.lead.count({ where: { status: 'won' } }),
      prisma.order.aggregate({
        _sum: { totalAmount: true },
        where: { createdAt: { gte: startOfMonth }, status: { not: 'cancelled' } },
      }),
      prisma.order.aggregate({
        _sum: { totalAmount: true },
        where: { status: { not: 'cancelled' } },
      }),
      prisma.lead.groupBy({ by: ['status'], _count: { status: true }, _sum: { value: true } }),
      prisma.customer.findMany({
        take: 5,
        orderBy: { orders: { _count: 'desc' } },
        include: {
          _count: { select: { orders: true } },
          orders: {
            where: { status: { not: 'cancelled' } },
            select: { totalAmount: true },
          },
        },
      }),
      prisma.order.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { customer: { select: { companyName: true } } },
      }),
      // Last 6 months revenue — using Prisma queryRaw with correct column casing
      prisma.$queryRaw<{ month: string; revenue: number }[]>`
        SELECT
          TO_CHAR(DATE_TRUNC('month', "createdAt"), 'YYYY-MM') as month,
          COALESCE(SUM("totalAmount"), 0)::float as revenue
        FROM orders
        WHERE status != 'cancelled'
          AND "createdAt" >= NOW() - INTERVAL '6 months'
        GROUP BY DATE_TRUNC('month', "createdAt")
        ORDER BY month ASC
      `,
    ]);

    const conversionRate = totalLeads > 0 ? ((wonLeads / totalLeads) * 100).toFixed(1) : '0';

    res.json({
      summary: {
        totalCustomers,
        totalLeads,
        totalOrders,
        wonLeads,
        conversionRate: parseFloat(conversionRate),
        revenueThisMonth: Number(revenueThisMonth._sum.totalAmount || 0),
        totalRevenue: Number(totalRevenue._sum.totalAmount || 0),
      },
      leadsByStatus,
      topCustomers: topCustomers.map((c) => ({
        id: c.id,
        companyName: c.companyName,
        orderCount: c._count.orders,
        totalRevenue: c.orders.reduce((sum, o) => sum + Number(o.totalAmount), 0),
      })),
      recentOrders,
      monthlyRevenue,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
