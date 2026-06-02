import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import app from '../src/index';

const prisma = new PrismaClient();

let adminToken: string;
let salesToken: string;
let createdCustomerId: string;

const adminEmail = `admin-cust-${Date.now()}@test.com`;
const salesEmail = `sales-cust-${Date.now()}@test.com`;

beforeAll(async () => {
  // Create admin user
  const adminRes = await request(app).post('/api/auth/register').send({
    email: adminEmail,
    password: 'password123',
    name: 'Admin Tester',
    role: 'admin',
  });
  adminToken = adminRes.body.token;

  // Create sales user
  const salesRes = await request(app).post('/api/auth/register').send({
    email: salesEmail,
    password: 'password123',
    name: 'Sales Tester',
    role: 'sales',
  });
  salesToken = salesRes.body.token;
});

afterAll(async () => {
  if (createdCustomerId) {
    await prisma.customer.deleteMany({ where: { id: createdCustomerId } }).catch(() => {});
  }
  await prisma.user.deleteMany({ where: { email: { in: [adminEmail, salesEmail] } } });
  await prisma.$disconnect();
});

describe('GET /api/customers', () => {
  it('should return paginated customers list', async () => {
    const res = await request(app)
      .get('/api/customers')
      .set('Authorization', `Bearer ${salesToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.meta).toHaveProperty('total');
    expect(res.body.meta).toHaveProperty('page');
  });

  it('should require authentication', async () => {
    const res = await request(app).get('/api/customers');
    expect(res.status).toBe(401);
  });

  it('should support search query', async () => {
    const res = await request(app)
      .get('/api/customers?search=silkway')
      .set('Authorization', `Bearer ${salesToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
  });
});

describe('POST /api/customers', () => {
  it('should create a new customer', async () => {
    const res = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({
        companyName: 'Test Fashion Co',
        contactName: 'Test Contact',
        phone: '+998901111111',
        email: `customer-${Date.now()}@test.com`,
        status: 'prospect',
      });

    expect(res.status).toBe(201);
    expect(res.body.companyName).toBe('Test Fashion Co');
    createdCustomerId = res.body.id;
  });

  it('should reject missing required fields', async () => {
    const res = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ companyName: 'Only Name' });

    expect(res.status).toBe(400);
  });

  it('should reject viewer role from creating', async () => {
    const viewerRes = await request(app).post('/api/auth/register').send({
      email: `viewer-${Date.now()}@test.com`,
      password: 'password123',
      name: 'Viewer',
      role: 'viewer',
    });
    const viewerToken = viewerRes.body.token;

    const res = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({
        companyName: 'Should Fail',
        contactName: 'Test',
        phone: '+998900000000',
        email: 'viewertest@test.com',
      });

    expect(res.status).toBe(403);
  });
});

describe('GET /api/customers/:id', () => {
  it('should return single customer with leads and orders', async () => {
    if (!createdCustomerId) return;

    const res = await request(app)
      .get(`/api/customers/${createdCustomerId}`)
      .set('Authorization', `Bearer ${salesToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(createdCustomerId);
    expect(res.body.leads).toBeInstanceOf(Array);
    expect(res.body.orders).toBeInstanceOf(Array);
  });

  it('should return 404 for non-existent customer', async () => {
    const res = await request(app)
      .get('/api/customers/nonexistent-id-12345')
      .set('Authorization', `Bearer ${salesToken}`);

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/customers/:id', () => {
  it('should allow admin to delete customer', async () => {
    if (!createdCustomerId) return;

    const res = await request(app)
      .delete(`/api/customers/${createdCustomerId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(204);
    createdCustomerId = '';
  });

  it('should reject sales role from deleting', async () => {
    const createRes = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({
        companyName: 'Delete Test Co',
        contactName: 'Delete Contact',
        phone: '+998902222222',
        email: `delete-${Date.now()}@test.com`,
      });

    const id = createRes.body.id;
    const res = await request(app)
      .delete(`/api/customers/${id}`)
      .set('Authorization', `Bearer ${salesToken}`);

    expect(res.status).toBe(403);
    await prisma.customer.delete({ where: { id } }).catch(() => {});
  });
});
