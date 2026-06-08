import { PrismaClient, Role, CustomerStatus, LeadStatus, OrderStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminPassword = await bcrypt.hash('admin123', 10);
  const salesPassword = await bcrypt.hash('sales123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@crmcloud.uz' },
    update: {},
    create: {
      email: 'admin@crmcloud.uz',
      password: adminPassword,
      name: 'Admin User',
      role: Role.admin,
    },
  });

  const sales1 = await prisma.user.upsert({
    where: { email: 'sales1@crmcloud.uz' },
    update: {},
    create: {
      email: 'sales1@crmcloud.uz',
      password: salesPassword,
      name: 'Bobur Karimov',
      role: Role.sales,
    },
  });

  const customers = await Promise.all([
    prisma.customer.upsert({
      where: { email: 'fashion@silkway.uz' },
      update: {},
      create: {
        companyName: 'Silkway Fashion LLC',
        contactName: 'Dilnoza Yusupova',
        phone: '+998901234567',
        email: 'fashion@silkway.uz',
        address: 'Chorsu bozori, 1-blok',
        city: 'Toshkent',
        status: CustomerStatus.active,
      },
    }),
    prisma.customer.upsert({
      where: { email: 'textile@samarkand.uz' },
      update: {},
      create: {
        companyName: 'Samarkand Textile Export',
        contactName: 'Jamshid Toshmatov',
        phone: '+998712345678',
        email: 'textile@samarkand.uz',
        address: 'Registon ko\'chasi, 15',
        city: 'Samarkand',
        status: CustomerStatus.active,
      },
    }),
    prisma.customer.upsert({
      where: { email: 'cotton@fergana.uz' },
      update: {},
      create: {
        companyName: 'Fergana Cotton Co',
        contactName: 'Nodira Hasanova',
        phone: '+998736789012',
        email: 'cotton@fergana.uz',
        address: 'Mustaqillik prospekti, 22',
        city: 'Farg\'ona',
        status: CustomerStatus.prospect,
      },
    }),
  ]);

  const products = await Promise.all([
    prisma.product.upsert({
      where: { sku: 'COAT-WIN-001' },
      update: {},
      create: {
        name: 'Premium Winter Coat',
        sku: 'COAT-WIN-001',
        category: 'Outerwear',
        description: 'High-quality wool winter coat',
        price: 450000,
        stock: 120,
        unit: 'pcs',
      },
    }),
    prisma.product.upsert({
      where: { sku: 'SUIT-BUS-002' },
      update: {},
      create: {
        name: 'Business Suit Set',
        sku: 'SUIT-BUS-002',
        category: 'Formalwear',
        description: 'Men\'s formal business suit',
        price: 680000,
        stock: 85,
        unit: 'pcs',
      },
    }),
    prisma.product.upsert({
      where: { sku: 'DRESS-SUM-003' },
      update: {},
      create: {
        name: 'Summer Collection Dress',
        sku: 'DRESS-SUM-003',
        category: 'Casualwear',
        description: 'Light cotton summer dress',
        price: 220000,
        stock: 200,
        unit: 'pcs',
      },
    }),
    prisma.product.upsert({
      where: { sku: 'JACK-DEN-004' },
      update: {},
      create: {
        name: 'Denim Jacket',
        sku: 'JACK-DEN-004',
        category: 'Outerwear',
        description: 'Classic denim jacket',
        price: 310000,
        stock: 150,
        unit: 'pcs',
      },
    }),
  ]);

  await prisma.lead.createMany({
    skipDuplicates: true,
    data: [
      {
        title: 'Winter collection bulk order — 500 units',
        status: LeadStatus.proposal,
        value: 22500000,
        customerId: customers[0].id,
        assignedTo: sales1.id,
        notes: 'Client interested in exclusive partnership',
      },
      {
        title: 'Export deal — EU market',
        status: LeadStatus.contacted,
        value: 85000000,
        customerId: customers[1].id,
        assignedTo: admin.id,
        notes: 'Potential 3-year supply contract',
      },
      {
        title: 'Local retailer franchise',
        status: LeadStatus.new,
        value: 15000000,
        customerId: customers[2].id,
        assignedTo: sales1.id,
      },
    ],
  });

  const order = await prisma.order.upsert({
    where: { orderNumber: 'ORD-2024-0001' },
    update: {},
    create: {
      orderNumber: 'ORD-2024-0001',
      customerId: customers[0].id,
      assignedTo: sales1.id,
      status: OrderStatus.confirmed,
      totalAmount: 1350000,
      items: {
        create: [
          {
            productId: products[0].id,
            quantity: 2,
            unitPrice: 450000,
            total: 900000,
          },
          {
            productId: products[2].id,
            quantity: 2,
            unitPrice: 220000,
            total: 440000,
          },
        ],
      },
    },
  });

  console.log('Seed completed:', { admin: admin.email, customers: customers.length, products: products.length, order: order.orderNumber });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
