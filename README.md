# CRM Cloud — Wholesale Fashion Management System
### BTEC Unit 6: Network in the Cloud

> A fully containerised, load-balanced CRM deployed on AWS EC2 with VPC networking, Application Load Balancer, Auto Scaling, and CI/CD automation.

---

## Architecture Diagram

```
                         INTERNET
                             │
                    ┌────────▼────────┐
                    │  Route 53 / DNS  │
                    └────────┬────────┘
                             │
              ┌──────────────▼──────────────┐
              │   Application Load Balancer  │  ← Public Subnet (AZ-1, AZ-2)
              │  (HTTPS :443 / HTTP :80)     │    Health check: /api/health
              └──────┬───────────────┬───────┘
                     │               │
         ┌───────────▼───┐   ┌───────▼───────────┐
         │  EC2 Instance  │   │   EC2 Instance     │  ← Private Subnet (AZ-1)
         │  (Docker stack)│   │   (Docker stack)   │    Private Subnet (AZ-2)
         │  Nginx:80      │   │   Nginx:80         │
         │  Backend:3001  │   │   Backend:3001      │
         │  Frontend:80   │   │   Frontend:80       │
         └───────┬───────┘   └────────┬────────────┘
                 │                    │
         ┌───────▼────────────────────▼───────┐
         │         RDS PostgreSQL              │  ← Private Subnet (Multi-AZ)
         │    (crmdb — private endpoint only)  │
         └─────────────────────────────────────┘

                    Private Subnet → NAT Gateway → Internet
                    (for Docker image pulls, OS updates)

 Network Flow:
 User → DNS → ALB (public subnet) → EC2 Nginx → Backend API → RDS
                ↓ health check every 30s on /api/health
```

---

## BTEC Criteria Mapping

| Criteria | Component | Evidence |
|----------|-----------|----------|
| **A.P2** | Docker internal networking | Containers communicate via service names (`backend`, `postgres`) — equivalent to private subnet DNS |
| **B.P3** | VPC + Private subnets + Security Groups | `infra/vpc.tf` — EC2 only reachable from ALB, RDS only from EC2 |
| **B.P4** | NAT Gateway + Internet Gateway | `infra/vpc.tf` — private subnet → NAT → internet for outbound; IGW for ALB |
| **C.P5** | Cloud network design (Terraform IaC) | `infra/` — complete AWS VPC, ALB, ASG, RDS in code |
| **C.P6** | Implementation — Docker Compose + Nginx LB | `docker-compose.yml`, `nginx/nginx.conf` — running load balancer |
| **C.M3** | Load balancing test | `docker-compose.scale.yml` + `scripts/load-test.sh` — compare 1 vs 3 backends |
| **C.D2** | Auto-scaling proof | `infra/asg.tf` — ASG min=2/max=4, CPU>60% triggers scale-out |
| **D.P7** | Network improvement | Rate limiting, gzip, security headers, structured logging |
| **D.P8** | Justification | CI/CD pipeline, zero-downtime deployment, health checks |
| **D.M4** | Performance analysis | Load test results table, CloudWatch metrics |
| **D.D3** | Evaluation | Comparison table before/after load balancing |

---

## Quick Start — Local (Docker Compose)

### Prerequisites
- Docker Desktop installed and running
- Git

### Step 1: Clone and configure
```bash
git clone https://github.com/yourusername/crm-cloud.git
cd crm-cloud
cp .env.example .env
# Edit .env — change passwords and JWT_SECRET
```

### Step 2: Start the full stack
```bash
docker compose up -d
```

This starts:
- **PostgreSQL** on port 5432
- **Backend API** (Express) on internal port 3001
- **Frontend** (React) on internal port 80
- **Nginx** load balancer on port **80** (your entry point)
- **migrate** service (runs DB migrations + seed data, then exits)

### Step 3: Access the application
```
http://localhost
```

Login credentials (seeded automatically):
- **Admin:** admin@crmcloud.uz / admin123
- **Sales:** sales1@crmcloud.uz / sales123

### Step 4: Verify it's working
```bash
# Health check (shows which backend instance responded)
curl http://localhost/api/health

# Check all containers are healthy
docker compose ps
```

### Stop everything
```bash
docker compose down          # stop containers
docker compose down -v       # also delete database volume (fresh start)
```

---

## Load Balancing Demo (BTEC C.M3)

### Start with 3 backend instances
```bash
docker compose -f docker-compose.yml -f docker-compose.scale.yml up --scale backend=3 -d
```

### Prove load balancing is working
Watch the `X-Backend-Instance` header change with each request:

```bash
# Windows PowerShell:
1..12 | ForEach-Object {
    $r = Invoke-WebRequest http://localhost/api/health
    $backend = $r.Headers["X-Backend-Instance"]
    Write-Host "Request $_: Backend = $backend"
}

# Linux/Mac:
for i in {1..12}; do
    curl -s -I http://localhost/api/health | grep -i "x-backend-instance"
done
```

**Expected output** — different IP for each request (round-robin):
```
X-Backend-Instance: 172.18.0.4:3001
X-Backend-Instance: 172.18.0.5:3001
X-Backend-Instance: 172.18.0.6:3001
X-Backend-Instance: 172.18.0.4:3001   ← cycles back
```

---

## Load Test Results (BTEC C.M3 / D.M4 / D.D3)

Run the load test script then fill in your results:

```bash
# Install k6 on Windows:
choco install k6

# Test 1 — Single backend
docker compose up -d
bash scripts/load-test.sh http://localhost 30s 50

# Test 2 — 3 backends (load balanced)
docker compose -f docker-compose.yml -f docker-compose.scale.yml up --scale backend=3 -d
bash scripts/load-test.sh http://localhost 30s 150
```

### Results Table (fill in after running tests)

| Metric | 1 Backend | 3 Backends (Load Balanced) | Improvement |
|--------|-----------|---------------------------|-------------|
| Requests/sec | ___ | ___ | ___ % |
| P50 latency (ms) | ___ | ___ | ___ % |
| P95 latency (ms) | ___ | ___ | ___ % |
| P99 latency (ms) | ___ | ___ | ___ % |
| Error rate | ___ % | ___ % | ___ |
| Max concurrent users | ___ | ___ | ___ |

---

## CI/CD Pipeline

```
Push to GitHub
      │
      ▼
┌─────────────┐
│  1. LINT    │ ESLint on backend + frontend TypeScript
└──────┬──────┘
       │ pass
       ▼
┌─────────────┐
│  2. TEST    │ Jest + Supertest against real PostgreSQL
│             │ (GitHub Actions service container)
└──────┬──────┘
       │ pass
       ▼
┌─────────────┐
│  3. BUILD   │ Docker multi-stage build
│             │ Push to GHCR with SHA tag
└──────┬──────┘
       │ main branch only
       ▼
┌─────────────┐
│  4. DEPLOY  │ SSH to EC2 → pull new images
│             │ Rolling update → nginx reload
│             │ Zero downtime ✅
└─────────────┘
```

### GitHub Secrets Required

Go to: Repository → Settings → Secrets and variables → Actions

| Secret Name | Value |
|-------------|-------|
| `EC2_HOST` | Your EC2 public IP or DNS |
| `EC2_USER` | `ubuntu` |
| `EC2_SSH_KEY` | Contents of your `.pem` key file |
| `REGISTRY_TOKEN` | GitHub Personal Access Token with `packages:write` |
| `DB_PASSWORD` | PostgreSQL password |
| `JWT_SECRET` | At least 32 character random string |

---

## AWS Deployment (Terraform)

⚠️ **Cost warning:** Running this infrastructure costs approximately $30-50/month (t3.micro × 2 + NAT Gateway + ALB). Always `terraform destroy` when done testing.

### Prerequisites
```bash
# Install Terraform
# Windows: choco install terraform
# Mac: brew install terraform

# Configure AWS CLI
aws configure
# Enter: Access Key ID, Secret Key, Region (us-east-1), output (json)
```

### Deploy Infrastructure
```bash
cd infra

# Initialise Terraform
terraform init

# Preview what will be created (NO cost yet)
terraform plan \
  -var="db_password=YourSecurePassword123!" \
  -var="jwt_secret=your-32-char-jwt-secret-here!!" \
  -var="key_pair_name=your-ec2-keypair-name"

# REVIEW the plan carefully, then apply
terraform apply \
  -var="db_password=YourSecurePassword123!" \
  -var="jwt_secret=your-32-char-jwt-secret-here!!" \
  -var="key_pair_name=your-ec2-keypair-name"

# Get the ALB URL
terraform output application_url
```

### What Gets Created
```
AWS Account
└── VPC (10.0.0.0/16)
    ├── Public Subnet AZ-1 (10.0.1.0/24)  ← ALB, NAT Gateway EIP
    ├── Public Subnet AZ-2 (10.0.2.0/24)  ← ALB (multi-AZ)
    ├── Private Subnet AZ-1 (10.0.10.0/24)← EC2 instances, RDS
    ├── Private Subnet AZ-2 (10.0.11.0/24)← EC2 instances (HA)
    ├── Internet Gateway
    ├── NAT Gateway
    ├── Application Load Balancer
    │   └── Target Group (health check: /api/health)
    ├── Auto Scaling Group
    │   ├── min=2, max=4, desired=2
    │   └── Scale-out: CPU > 60%
    ├── RDS PostgreSQL (private subnet)
    └── Security Groups (ALB→EC2→RDS chain)
```

### Monitor Auto-Scaling (BTEC C.D2)
```bash
# Trigger high CPU load (from load test)
bash scripts/load-test.sh http://YOUR-ALB-DNS 5m 200

# Watch ASG scale out in AWS Console:
# EC2 → Auto Scaling Groups → crm-cloud-asg → Activity tab
# You'll see new instances launching when CPU > 60%

# Or via CLI:
aws autoscaling describe-scaling-activities \
  --auto-scaling-group-name crm-cloud-asg \
  --region us-east-1
```

### Destroy Infrastructure (avoid charges!)
```bash
cd infra
terraform destroy -var="db_password=any" -var="jwt_secret=any"
```

---

## Network Concepts Explained

| Concept | In this project | AWS equivalent |
|---------|-----------------|----------------|
| **VPC** | Docker `crm-network` bridge | `aws_vpc` — isolated network |
| **Subnet** | Docker service groups | `aws_subnet` — network segment |
| **Internet Gateway** | Docker host networking | `aws_internet_gateway` |
| **NAT Gateway** | Docker NAT (default) | `aws_nat_gateway` — outbound only |
| **Load Balancer** | Nginx upstream | `aws_lb` — ALB |
| **Health Check** | `GET /api/health` | ALB target group health check |
| **Auto Scaling** | `docker compose --scale` | `aws_autoscaling_group` |
| **DNS** | Docker service name (`backend`) | Route 53 + ALB DNS |
| **Firewall** | Rate limiting in Nginx | `aws_security_group` |
| **Private network** | Container-to-container | Private subnet — no public IP |

---

## API Reference

Base URL: `http://localhost/api`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/health` | None | Health check (ALB uses this) |
| POST | `/auth/register` | None | Register new user |
| POST | `/auth/login` | None | Get JWT token |
| GET | `/auth/me` | JWT | Current user info |
| GET | `/customers` | JWT | List customers (paginated) |
| POST | `/customers` | JWT (admin/sales) | Create customer |
| PUT | `/customers/:id` | JWT (admin/sales) | Update customer |
| DELETE | `/customers/:id` | JWT (admin) | Delete customer |
| GET | `/leads` | JWT | List leads |
| GET | `/leads/funnel` | JWT | Lead pipeline stats |
| PUT | `/leads/:id` | JWT (admin/sales) | Update lead status |
| GET | `/products` | JWT | Product catalogue |
| GET | `/orders` | JWT | Order list |
| POST | `/orders` | JWT (admin/sales) | Create order |
| PUT | `/orders/:id/status` | JWT (admin/sales) | Update order status |
| GET | `/dashboard/stats` | JWT | KPI statistics |

---

## Project Structure

```
crm-cloud/
├── backend/              # Node.js + Express API
│   ├── src/
│   │   ├── index.ts      # App entry, middleware setup
│   │   ├── middleware/   # auth, error, logger
│   │   └── routes/       # auth, customers, leads, products, orders, dashboard
│   ├── prisma/
│   │   ├── schema.prisma # Database schema (6 models)
│   │   └── seed.ts       # Demo data
│   ├── tests/            # Jest integration tests
│   └── Dockerfile        # Multi-stage build
├── frontend/             # React + Vite + TypeScript + Tailwind
│   ├── src/
│   │   ├── pages/        # Login, Dashboard, Customers, Leads, Products, Orders
│   │   ├── components/   # Layout, Sidebar
│   │   ├── api/          # Axios client + endpoints
│   │   └── hooks/        # useAuth
│   └── Dockerfile        # Multi-stage → Nginx static
├── nginx/
│   ├── nginx.conf        # Load balancer (round-robin)
│   └── nginx-scale.conf  # For --scale backend=N mode
├── infra/                # Terraform — AWS infrastructure
│   ├── main.tf           # Provider, locals
│   ├── vpc.tf            # VPC, subnets, IGW, NAT, security groups
│   ├── alb.tf            # Application Load Balancer
│   ├── asg.tf            # Auto Scaling Group, RDS
│   ├── variables.tf      # Input variables
│   └── outputs.tf        # ALB DNS, VPC ID, etc.
├── .github/workflows/
│   └── ci-cd.yml         # Lint → Test → Build → Deploy
├── scripts/
│   ├── load-test.sh      # k6 / ab performance test
│   └── deploy.sh         # Manual EC2 deploy
├── docker-compose.yml        # Full stack (single backend)
├── docker-compose.scale.yml  # Override for --scale backend=3
└── .env.example              # Environment variable template
```
# CloudCRM
