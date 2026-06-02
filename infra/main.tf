# BTEC C.P5 & C.P6 — Terraform Main Configuration
# Provider: AWS
# Purpose: Define cloud infrastructure for CRM deployment

terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Remote state storage (recommended for team use)
  # Uncomment after creating the S3 bucket and DynamoDB table
  # backend "s3" {
  #   bucket         = "crm-cloud-terraform-state"
  #   key            = "production/terraform.tfstate"
  #   region         = "us-east-1"
  #   dynamodb_table = "crm-cloud-terraform-lock"
  #   encrypt        = true
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "Terraform"
      BTEC        = "Unit6-CloudNetworking"
    }
  }
}

# Data source: Available AZs in the region
data "aws_availability_zones" "available" {
  state = "available"
}

# ─────────────────────────────────────────────────────────────────
# EC2 User Data Script
# Bootstraps Docker + Docker Compose on each new ASG instance
# BTEC D.P8: Automated instance configuration
# ─────────────────────────────────────────────────────────────────
locals {
  user_data = base64encode(templatefile("${path.module}/user_data.sh", {
    docker_image_backend  = var.docker_image_backend
    docker_image_frontend = var.docker_image_frontend
    db_password           = var.db_password
    jwt_secret            = var.jwt_secret
    db_host               = aws_db_instance.postgres.address
  }))
}
