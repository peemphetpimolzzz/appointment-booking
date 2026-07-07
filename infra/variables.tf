variable "region" {
  description = "AWS region."
  type        = string
  default     = "ap-southeast-1"
}

variable "app_name" {
  description = "Base name used to derive resource names."
  type        = string
  default     = "appointment-booking"
}

variable "container_image" {
  description = "Container image for the API task. Defaults to a public placeholder for the first infra-only apply; the deploy workflow points it at the ECR image on each release."
  type        = string
  default     = "public.ecr.aws/nginx/nginx:stable"
}

variable "db_username" {
  description = "PostgreSQL master username."
  type        = string
  default     = "booking"
}

variable "db_password" {
  description = "PostgreSQL master password. Supply via TF_VAR_db_password — do not commit."
  type        = string
  sensitive   = true

  # Restrict to characters that are safe inside the Prisma DATABASE_URL — a URL
  # metacharacter (@ : / ? # %) in the password would otherwise break parsing of
  # postgresql://user:PASS@host and the app would fail to connect.
  validation {
    condition     = can(regex("^[A-Za-z0-9!*_.~-]{8,}$", var.db_password))
    error_message = "db_password must be 8+ chars using only letters, digits, and ! * _ . ~ - (characters that are safe inside the DATABASE_URL)."
  }
}

variable "db_name" {
  description = "PostgreSQL database name."
  type        = string
  default     = "booking"
}

variable "desired_count" {
  description = "Number of ECS tasks to run."
  type        = number
  default     = 1
}

variable "certificate_arn" {
  description = "ACM certificate ARN for the ALB. When set, an HTTPS:443 listener is added and HTTP:80 redirects to it; when empty, the ALB serves HTTP:80 only (suitable only for demos / non-sensitive traffic)."
  type        = string
  default     = ""
}
