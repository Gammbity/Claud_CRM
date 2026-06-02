# BTEC C.M3 & C.D2 — Auto Scaling Group (ASG)
# Automatically adds/removes EC2 instances based on CPU load
# Proves: scalability, elasticity, cost efficiency

# ─────────────────────────────────────────
# IAM Role for EC2 instances (to pull from ECR if needed)
# ─────────────────────────────────────────
resource "aws_iam_role" "ec2" {
  name = "${var.project_name}-ec2-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.ec2.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "ec2" {
  name = "${var.project_name}-ec2-profile"
  role = aws_iam_role.ec2.name
}

# ─────────────────────────────────────────
# Launch Template — defines what each new EC2 instance looks like
# ─────────────────────────────────────────
resource "aws_launch_template" "app" {
  name_prefix   = "${var.project_name}-lt-"
  image_id      = var.ami_id
  instance_type = var.instance_type
  key_name      = var.key_pair_name

  vpc_security_group_ids = [aws_security_group.ec2.id]

  iam_instance_profile {
    name = aws_iam_instance_profile.ec2.name
  }

  user_data = local.user_data

  monitoring {
    enabled = true  # CloudWatch detailed monitoring for ASG triggers
  }

  tag_specifications {
    resource_type = "instance"
    tags = {
      Name        = "${var.project_name}-app-instance"
      Environment = var.environment
    }
  }

  lifecycle {
    create_before_destroy = true
  }
}

# ─────────────────────────────────────────
# Auto Scaling Group
# BTEC C.D2: min=2 ensures HA; max=4 caps costs; scales on CPU
# ─────────────────────────────────────────
resource "aws_autoscaling_group" "app" {
  name                = "${var.project_name}-asg"
  vpc_zone_identifier = aws_subnet.private[*].id  # Launch into private subnets
  target_group_arns   = [aws_lb_target_group.app.arn]  # Register with ALB
  health_check_type   = "ELB"   # ALB health check determines instance health
  health_check_grace_period = 120

  min_size         = var.asg_min_size         # Always at least 2 instances (HA)
  max_size         = var.asg_max_size         # Never more than 4 (cost control)
  desired_capacity = var.asg_desired_capacity

  launch_template {
    id      = aws_launch_template.app.id
    version = "$Latest"
  }

  # Enable instance refresh for zero-downtime deployments
  instance_refresh {
    strategy = "Rolling"
    preferences {
      min_healthy_percentage = 50
    }
  }

  tag {
    key                 = "Name"
    value               = "${var.project_name}-asg-instance"
    propagate_at_launch = true
  }

  lifecycle {
    create_before_destroy = true
  }
}

# ─────────────────────────────────────────
# Auto Scaling Policy — Target Tracking
# BTEC C.M3/C.D2: Scale out when CPU > 60%, scale in when below
# ─────────────────────────────────────────
resource "aws_autoscaling_policy" "cpu_scale" {
  name                   = "${var.project_name}-cpu-scale"
  autoscaling_group_name = aws_autoscaling_group.app.name
  policy_type            = "TargetTrackingScaling"

  target_tracking_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ASGAverageCPUUtilization"
    }
    target_value = var.cpu_scale_target  # 60% CPU triggers scale-out
  }
}

# ─────────────────────────────────────────
# RDS PostgreSQL (Optional — production grade)
# Deployed in private subnets for security
# ─────────────────────────────────────────
resource "aws_db_subnet_group" "main" {
  name       = "${var.project_name}-db-subnet-group"
  subnet_ids = aws_subnet.private[*].id

  tags = { Name = "${var.project_name}-db-subnet-group" }
}

resource "aws_db_instance" "postgres" {
  identifier        = "${var.project_name}-postgres"
  engine            = "postgres"
  engine_version    = "16.1"
  instance_class    = "db.t3.micro"  # Free tier eligible
  allocated_storage = 20
  storage_type      = "gp2"

  db_name  = "crmdb"
  username = "crmuser"
  password = var.db_password

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  multi_az               = false  # Set to true in production for HA
  publicly_accessible    = false  # Private subnet only
  skip_final_snapshot    = true   # Set to false in production

  backup_retention_period = 7
  backup_window           = "02:00-03:00"
  maintenance_window      = "sun:03:00-sun:04:00"

  tags = { Name = "${var.project_name}-rds" }
}
