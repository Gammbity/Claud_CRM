# BTEC B.P3 & B.P4 — Virtual Private Cloud (VPC) Configuration
# Demonstrates: isolated network, subnets, routing, NAT gateway
# Maps to: Network Addressing, Subnetting, Inter-network routing

# ─────────────────────────────────────────
# VPC — Isolated private network in the cloud
# Equivalent to having your own data centre network
# ─────────────────────────────────────────
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr    # 10.0.0.0/16 = 65,536 IPs
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = { Name = "${var.project_name}-vpc" }
}

# ─────────────────────────────────────────
# Public Subnets (2 AZs) — for ALB and NAT Gateway
# These subnets have a route to the Internet Gateway
# BTEC A.P2: Traffic from internet enters here
# ─────────────────────────────────────────
resource "aws_subnet" "public" {
  count                   = 2
  vpc_id                  = aws_vpc.main.id
  cidr_block              = var.public_subnet_cidrs[count.index]
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true   # Instances get public IPs (needed for ALB)

  tags = { Name = "${var.project_name}-public-${count.index + 1}" }
}

# ─────────────────────────────────────────
# Private Subnets (2 AZs) — for EC2 app servers and RDS
# NO direct internet access — traffic goes through NAT
# BTEC B.P3: Security through network isolation
# ─────────────────────────────────────────
resource "aws_subnet" "private" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = var.private_subnet_cidrs[count.index]
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = { Name = "${var.project_name}-private-${count.index + 1}" }
}

# ─────────────────────────────────────────
# Internet Gateway — entry point from internet to VPC
# BTEC B.P4: Connects VPC to public internet
# ─────────────────────────────────────────
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "${var.project_name}-igw" }
}

# ─────────────────────────────────────────
# Elastic IP for NAT Gateway
# ─────────────────────────────────────────
resource "aws_eip" "nat" {
  domain     = "vpc"
  depends_on = [aws_internet_gateway.main]
  tags       = { Name = "${var.project_name}-nat-eip" }
}

# ─────────────────────────────────────────
# NAT Gateway — allows private subnet resources to reach internet
# (for pulling Docker images, OS updates, etc.)
# BTEC B.P4: Outbound-only internet access from private subnet
# ─────────────────────────────────────────
resource "aws_nat_gateway" "main" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public[0].id   # NAT lives in public subnet

  depends_on = [aws_internet_gateway.main]
  tags       = { Name = "${var.project_name}-nat" }
}

# ─────────────────────────────────────────
# Route Tables
# BTEC B.P3: Controls how traffic flows within the VPC
# ─────────────────────────────────────────

# Public route table — sends 0.0.0.0/0 to Internet Gateway
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = { Name = "${var.project_name}-rt-public" }
}

# Private route table — sends 0.0.0.0/0 to NAT Gateway
resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main.id
  }

  tags = { Name = "${var.project_name}-rt-private" }
}

# Associate public subnets with public route table
resource "aws_route_table_association" "public" {
  count          = 2
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# Associate private subnets with private route table
resource "aws_route_table_association" "private" {
  count          = 2
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}

# ─────────────────────────────────────────
# Security Groups — firewall rules
# BTEC D.P7: Network access control
# ─────────────────────────────────────────

# ALB Security Group — accepts HTTP/HTTPS from anywhere (internet-facing)
resource "aws_security_group" "alb" {
  name        = "${var.project_name}-alb-sg"
  description = "Allow HTTP/HTTPS inbound to ALB"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTP from internet"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS from internet"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.project_name}-alb-sg" }
}

# EC2 Security Group — only accepts traffic from ALB (not directly from internet)
resource "aws_security_group" "ec2" {
  name        = "${var.project_name}-ec2-sg"
  description = "Allow traffic only from ALB"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "HTTP from ALB"
    from_port       = 80
    to_port         = 80
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  ingress {
    description = "SSH from anywhere (restrict to bastion/VPN in production)"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]  # Restrict this to your IP in production!
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.project_name}-ec2-sg" }
}

# RDS Security Group — only accepts connections from EC2 instances
resource "aws_security_group" "rds" {
  name        = "${var.project_name}-rds-sg"
  description = "Allow PostgreSQL only from EC2"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "PostgreSQL from EC2"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ec2.id]
  }

  tags = { Name = "${var.project_name}-rds-sg" }
}
