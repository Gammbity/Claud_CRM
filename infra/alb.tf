# BTEC C.P5 & C.P6 — Application Load Balancer (ALB)
# Distributes traffic across EC2 instances in multiple AZs
# BTEC C.M3: Used to test load balancing behaviour

# ─────────────────────────────────────────
# Application Load Balancer
# ─────────────────────────────────────────
resource "aws_lb" "main" {
  name               = "${var.project_name}-alb"
  internal           = false   # Internet-facing
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id  # Deployed in public subnets across 2 AZs

  enable_deletion_protection = false  # Set to true in production

  tags = { Name = "${var.project_name}-alb" }
}

# ─────────────────────────────────────────
# Target Group — group of EC2 instances behind ALB
# Health check hits /api/health on each instance
# ─────────────────────────────────────────
resource "aws_lb_target_group" "app" {
  name     = "${var.project_name}-tg"
  port     = 80
  protocol = "HTTP"
  vpc_id   = aws_vpc.main.id

  # BTEC B.P3: Health check — ALB only sends traffic to healthy instances
  health_check {
    path                = "/api/health"
    port                = "traffic-port"
    protocol            = "HTTP"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
    matcher             = "200"
  }

  deregistration_delay = 30

  tags = { Name = "${var.project_name}-tg" }
}

# ─────────────────────────────────────────
# ALB Listener — accepts HTTP on port 80
# ─────────────────────────────────────────
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }
}

# Optional: HTTPS listener (requires ACM certificate)
# resource "aws_lb_listener" "https" {
#   load_balancer_arn = aws_lb.main.arn
#   port              = "443"
#   protocol          = "HTTPS"
#   certificate_arn   = var.acm_certificate_arn
#   default_action {
#     type             = "forward"
#     target_group_arn = aws_lb_target_group.app.arn
#   }
# }
