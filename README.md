# Apex Nexus — Enterprise Content Management System

A high-security, compliant Enterprise Content Management (ECM) platform built as a modern alternative to ELO. Designed for 20+ year document retention, advanced workflows, and seamless mobile/web access.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Clients                                │
│   ┌──────────┐  ┌──────────────┐  ┌──────────────────┐  │
│   │ Next.js  │  │ React Native │  │ External Systems │  │
│   │ Web App  │  │ Mobile App   │  │ (API Consumers)  │  │
│   └────┬─────┘  └──────┬───────┘  └────────┬─────────┘  │
└────────┼───────────────┼────────────────────┼────────────┘
         │               │                    │
         ▼               ▼                    ▼
┌─────────────────────────────────────────────────────────┐
│              API Gateway (Spring Cloud Gateway)          │
│                    + Redis Rate Limiting                  │
└────────────────────────┬────────────────────────────────┘
                         │
    ┌────────────────────┼────────────────────┐
    │                    │                    │
    ▼                    ▼                    ▼
┌─────────┐    ┌──────────────┐    ┌──────────────┐
│  Auth   │    │  Document    │    │  Workflow     │
│ Service │    │  Service     │    │  Service      │
└─────────┘    └──────────────┘    └──────────────┘
    │                    │                    │
    ▼                    ▼                    ▼
┌─────────┐    ┌──────────────┐    ┌──────────────┐
│  Audit  │    │  Search      │    │  Retention    │
│ Service │    │  Service     │    │  Service      │
└─────────┘    └──────────────┘    └──────────────┘
                                          │
                              ┌──────────────┐
                              │ Notification │
                              │  Service     │
                              └──────────────┘

Infrastructure: PostgreSQL │ MinIO │ Redis │ Elasticsearch
```

## Tech Stack

| Layer          | Technology                              |
|----------------|----------------------------------------|
| Backend        | Java 21, Spring Boot 3.3, Spring Cloud |
| Web Frontend   | Next.js 14, React 18, TailwindCSS      |
| Mobile         | React Native, WatermelonDB             |
| Database       | PostgreSQL 16 with Row-Level Security  |
| Object Storage | MinIO (S3-compatible)                  |
| Search         | Elasticsearch 8.x                      |
| Cache          | Redis 7                                |
| Messaging      | Redis Streams                          |
| Containers     | Docker, Docker Compose                 |

## Quick Start

```bash
# Clone and start all services
docker-compose up -d

# Access points:
# Web App:        http://localhost:3000
# API Gateway:    http://localhost:8080
# MinIO Console:  http://localhost:9001
# Kibana:         http://localhost:5601
```

## Microservices

| Service              | Port  | Description                              |
|---------------------|-------|------------------------------------------|
| apex-gateway        | 8080  | API Gateway, routing, rate limiting      |
| apex-auth-service   | 8081  | Authentication, RBAC, JWT tokens         |
| apex-document-service| 8082 | Document CRUD, versioning, notes, vault  |
| apex-workflow-service| 8083 | State machine, approvals, corrections    |
| apex-search-service | 8084  | Full-text search via Elasticsearch       |
| apex-retention-service| 8085| Compliance, retention policies, disposal |
| apex-audit-service  | 8086  | Immutable audit trail logging            |
| apex-notification-service| 8087| Real-time notifications, email alerts |

## License

Proprietary — Internal Use Only
