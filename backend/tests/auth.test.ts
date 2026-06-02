import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import app from '../src/index';

const prisma = new PrismaClient();

const testEmail = `test-${Date.now()}@example.com`;
let authToken: string;

beforeAll(async () => {
  // Clean up test data
  await prisma.user.deleteMany({ where: { email: { contains: 'test-' } } });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: testEmail } });
  await prisma.$disconnect();
});

describe('POST /api/auth/register', () => {
  it('should register a new user', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: testEmail,
      password: 'password123',
      name: 'Test User',
      role: 'sales',
    });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe(testEmail);
    expect(res.body.token).toBeDefined();
    authToken = res.body.token;
  });

  it('should reject duplicate email', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: testEmail,
      password: 'password123',
      name: 'Test User 2',
    });
    expect(res.status).toBe(409);
  });

  it('should reject invalid email', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'not-an-email',
      password: 'password123',
      name: 'Test',
    });
    expect(res.status).toBe(400);
  });

  it('should reject short password', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'new@test.com',
      password: '123',
      name: 'Test',
    });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  it('should login with valid credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: testEmail,
      password: 'password123',
    });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.role).toBe('sales');
  });

  it('should reject wrong password', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: testEmail,
      password: 'wrongpassword',
    });
    expect(res.status).toBe(401);
  });

  it('should reject unknown email', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'nobody@nowhere.com',
      password: 'password123',
    });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/auth/me', () => {
  it('should return current user with valid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe(testEmail);
  });

  it('should reject request without token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('should reject invalid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid.token.here');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/health', () => {
  it('should return healthy status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.instance).toBeDefined();
    expect(res.body.uptime).toBeGreaterThan(0);
  });
});
