# REFER-AND-EARN- (RamNet)

A full-stack, production-ready **2-Tier Referral Commission Web Application** built with **Node.js**, **Express**, **SQLite**, **Paystack Payment Gateway**, **Swagger OpenAPI**, and **Docker**.

---

## 🌟 Core System Features

- **Tiered Referral Earning System**:
  - **Registration Fee**: One-time **KSh. 250** payment via Paystack Inline JS.
  - **Level 1 (Direct Referral)**: Earn **KSh. 100** instantly per direct referral.
  - **Level 2 (Indirect Referral)**: Earn **KSh. 50** instantly per sub-referral.
- **Paystack Integration & Sandbox Demo Bypass**:
  - Full Paystack Inline JS checkout integration (`KES`).
  - Built-in developer demo sandbox mode button for instant local testing without requiring live credentials.
- **Decoupled 3-Service Microservice Architecture**:
  - **Backend REST API (Port 8080)**: Handles authentication, Paystack verification, tiered bonus engine, database storage, and admin APIs.
  - **Swagger OpenAPI Docs (Port 8080)**: Interactive API specs exposed at `/api-docs`.
  - **Member Frontend Client (Port 3000)**: Clean, consumer-facing EJS web application with referral link generator, level 1 & level 2 tree network, and wallet withdrawal modal.
  - **Executive Admin Portal (Port 3001)**: Comprehensive admin dashboard for platform revenue tracking (KSh. 250 fee), total commission payouts, company net margin, manual user activation override, and financial audit logs.
- **Docker & Docker Compose Containerization**:
  - Individual `Dockerfile` for each microservice with persistent database volume.

---

## 🚀 Quick Start with Docker Compose

```bash
# Clone the repository
git clone https://github.com/Majorstanwachira5/REFER-AND-EARN-.git
cd REFER-AND-EARN-

# Start all 3 microservices concurrently
docker compose up -d --build
```

### 🌐 Access Endpoints
- **Member Client Application**: [http://localhost:3000](http://localhost:3000)
- **Executive Admin Portal**: [http://localhost:3001](http://localhost:3001) (`admin@ramnet.com` / `admin123password`)
- **Swagger API Documentation**: [http://localhost:8080/api-docs](http://localhost:8080/api-docs)
- **Backend Health Check**: [http://localhost:8080/api/health](http://localhost:8080/api/health)

---

## 🔑 Default Admin Account
- **Email**: `admin@ramnet.com`
- **Password**: `admin123password`

---

## 📄 License
ISC License
