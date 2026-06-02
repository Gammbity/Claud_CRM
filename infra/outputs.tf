# Terraform Outputs — values displayed after terraform apply

output "alb_dns_name" {
  description = "ALB DNS name — use this to access the application"
  value       = aws_lb.main.dns_name
}

output "alb_arn" {
  description = "ALB ARN"
  value       = aws_lb.main.arn
}

output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.main.id
}

output "public_subnet_ids" {
  description = "Public subnet IDs"
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "Private subnet IDs"
  value       = aws_subnet.private[*].id
}

output "asg_name" {
  description = "Auto Scaling Group name — use in AWS console to monitor scaling"
  value       = aws_autoscaling_group.app.name
}

output "rds_endpoint" {
  description = "RDS PostgreSQL endpoint (private)"
  value       = aws_db_instance.postgres.endpoint
  sensitive   = true
}

output "nat_gateway_ip" {
  description = "NAT Gateway public IP — all private subnet outbound traffic uses this IP"
  value       = aws_eip.nat.public_ip
}

output "application_url" {
  description = "CRM application URL"
  value       = "http://${aws_lb.main.dns_name}"
}
