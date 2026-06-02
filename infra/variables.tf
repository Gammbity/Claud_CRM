# BTEC C.P5 — Terraform Variables for AWS Infrastructure

variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Project name used as prefix for all resources"
  type        = string
  default     = "crm-cloud"
}

variable "environment" {
  description = "Environment name (dev/staging/production)"
  type        = string
  default     = "production"
}

# VPC
variable "vpc_cidr" {
  description = "CIDR block for the VPC — BTEC B.P3: private network address space"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets (one per AZ) — for ALB and NAT Gateway"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets (one per AZ) — for EC2 instances and RDS"
  type        = list(string)
  default     = ["10.0.10.0/24", "10.0.11.0/24"]
}

# EC2
variable "instance_type" {
  description = "EC2 instance type for application servers"
  type        = string
  default     = "t3.micro"  # Free tier eligible
}

variable "key_pair_name" {
  description = "EC2 Key Pair name for SSH access (must exist in AWS)"
  type        = string
  default     = "crm-keypair"
}

variable "ami_id" {
  description = "Ubuntu 22.04 LTS AMI ID (region-specific)"
  type        = string
  default     = "ami-0c7217cdde317cfec"  # us-east-1 Ubuntu 22.04 LTS
}

# Auto Scaling
variable "asg_min_size" {
  description = "Minimum number of EC2 instances in the ASG"
  type        = number
  default     = 2
}

variable "asg_max_size" {
  description = "Maximum number of EC2 instances in the ASG"
  type        = number
  default     = 4
}

variable "asg_desired_capacity" {
  description = "Desired number of EC2 instances in the ASG"
  type        = number
  default     = 2
}

variable "cpu_scale_target" {
  description = "CPU utilization % that triggers scale-out — BTEC C.D2"
  type        = number
  default     = 60
}

# App
variable "docker_image_backend" {
  description = "Docker image for backend (from GHCR or Docker Hub)"
  type        = string
  default     = "ghcr.io/yourusername/crm-cloud/crm-backend:latest"
}

variable "docker_image_frontend" {
  description = "Docker image for frontend"
  type        = string
  default     = "ghcr.io/yourusername/crm-cloud/crm-frontend:latest"
}

variable "db_password" {
  description = "PostgreSQL database password"
  type        = string
  sensitive   = true
}

variable "jwt_secret" {
  description = "JWT signing secret (minimum 32 characters)"
  type        = string
  sensitive   = true
}
