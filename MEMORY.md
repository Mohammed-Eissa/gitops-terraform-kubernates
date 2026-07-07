# Inventory Manager — GitOps Monorepo

## What this repo is

A **DevSecOps demonstration monorepo** that contains a full-stack Inventory Manager application alongside all its infrastructure, CI/CD pipelines, and security tooling. Everything lives here — app code, Terraform, Kubernetes manifests, Ansible playbooks, and GitHub Actions workflows.

The application is a realistic CRUD web app for managing warehouse/office inventory (products, categories, stock levels). It exists as the vehicle for demonstrating a complete enterprise DevSecOps pipeline — not as a product meant for production use.

## Repo structure

```text
.
├── backend/                  # Spring Boot REST API (Java 17, Maven)
├── frontend/                 # Angular 17 SPA (TypeScript, Angular Material)
├── terraform/                # On-prem VM provisioning (libvirt provider, QEMU/KVM)
├── ansible/                  # k3s install, app deploy, monitoring, Cloudflare tunnel
├── kubernetes/               # K8s manifests for all services
├── monitoring/               # Prometheus + Grafana helm values and manifests
├── .github/workflows/        # CI/CD pipelines (backend-ci, frontend-ci, dast)
├── docker-compose.yml        # Local dev: spins up Postgres + backend + frontend
├── MEMORY.md                 # Project context for humans and agents
├── NOTES.md                  # Lessons learned, technical decisions, gotchas
└── README.md                 # Project overview, DEPI metadata, team
```

## Application

**Inventory Manager** — track products with name, description, category, quantity, and price.

- Status is auto-computed: quantity ≥ 10 → IN_STOCK, 1–9 → LOW_STOCK, 0 → OUT_OF_STOCK
- Dashboard shows live stats and flags items needing restocking
- Products page has search, category filter, and status filter
- Access is protected by JWT authentication — login required to use the app

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | Angular 17, Angular Material, TypeScript |
| Backend | Spring Boot 3.2, Spring Security, JWT (jjwt 0.12), Spring Data JPA |
| Database | PostgreSQL 16 (H2 for tests only) |
| Container | Docker (multi-stage builds), Nginx (frontend) |
| Orchestration | Kubernetes (k3s, on-premises) |
| Infrastructure | Terraform (libvirt provider), Ansible |
| Public URL | Cloudflare Tunnel |

## Running locally

```bash
docker compose up --build
```

- Frontend: <http://localhost:80>
- Backend API: <http://localhost:8080>
- Swagger UI: <http://localhost:8080/swagger-ui.html>
- Postgres: localhost:5432 / db: inventory / user: postgres / pass: postgres

Default login: **admin / admin**

## Backend API

Authentication: `POST /api/auth/login` returns a JWT. All product endpoints require `Authorization: Bearer <token>`.

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | Public | Returns JWT token |
| GET | `/api/products` | Required | List all (supports `?search=`, `?category=`, `?status=`) |
| GET | `/api/products/{id}` | Required | Get by ID |
| POST | `/api/products` | Required | Create product |
| PUT | `/api/products/{id}` | Required | Update product |
| DELETE | `/api/products/{id}` | Required | Delete product |
| GET | `/api/products/categories` | Required | List distinct categories |

## Environment variables (backend)

All credentials are injected via environment variables — map these to Kubernetes secrets:

| Variable | Default | Description |
| --- | --- | --- |
| `DB_HOST` | `localhost` | Postgres host |
| `DB_PORT` | `5432` | Postgres port |
| `DB_NAME` | `inventory` | Database name |
| `DB_USER` | `postgres` | Database user |
| `DB_PASSWORD` | `postgres` | Database password |

## DevSecOps pipeline

### Implemented workflows

- **backend-ci.yml** — Gitleaks secrets scan → Maven build + JUnit + JaCoCo → SonarCloud SAST → OWASP Dependency-Check → Trivy image scan
- **frontend-ci.yml** — ESLint → npm audit → Karma unit tests + coverage → SonarCloud SAST → Trivy image scan
- **dast.yml** — Spins up full stack via docker compose → Selenium E2E smoke tests → OWASP ZAP full scan. Triggered manually or weekly (Monday 2am)

## GitHub Actions secrets

All secrets are added at: **repo → Settings → Secrets and variables → Actions → New repository secret**

| Secret | Required | Description |
| --- | --- | --- |
| `SONAR_TOKEN` | Yes | SonarCloud personal access token |
| `SONAR_HOST_URL` | Yes | Always `https://sonarcloud.io` |
| `SONAR_ORGANIZATION` | Yes | SonarCloud org key (found in the org URL: `sonarcloud.io/organizations/<key>`) |
| `NVD_API_KEY` | Recommended | Speeds up OWASP Dependency-Check from 20 min to 2 min |
| `GITLEAKS_LICENSE` | No | Only needed for private repos — public repos work without it |

### Getting SONAR_TOKEN

1. Go to <https://sonarcloud.io> and sign in with GitHub
2. Import the repo via "+" → "Analyze new project"
3. Disable **Automatic Analysis**: Administration → Analysis Method → toggle off (required or CI scan fails)
4. Go to **My Account → Security → Generate Token** — type: Global Analysis Token
5. The `sonar.projectKey` in `backend/pom.xml` and `frontend/sonar-project.properties` must exactly match the key SonarCloud auto-generates (`{org}_{repo}`, e.g. `ToYoNiX_gitops-terraform-kubernates`)

### Getting NVD_API_KEY

1. Go to <https://nvd.nist.gov/developers/request-an-api-key>
2. Fill in your email, organization name, and organization type
3. You will receive an email with a UUID and a verification link
4. Click the link, enter your email and the UUID
5. Your API key is shown — copy it and add it as `NVD_API_KEY` in GitHub secrets

---

## Commit message standard

Every commit — whether from a human or an agent — must follow this format:

```text
<type>(<scope>): <short summary>

<body — optional, explain WHY not WHAT>

<footer — optional, e.g. closes #issue, breaking change>
```

### Types

| Type | When to use |
| --- | --- |
| `feat` | A new feature or capability |
| `fix` | A bug fix |
| `infra` | Terraform, Kubernetes, Ansible, or Docker changes |
| `ci` | GitHub Actions workflow changes |
| `refactor` | Code restructure with no behaviour change |
| `test` | Adding or updating tests |
| `docs` | Documentation only (MEMORY.md, README, comments) |
| `chore` | Dependency bumps, config tweaks, tooling |
| `security` | Security patches, secret rotation, policy changes |

### Scopes

| Scope | Maps to |
| --- | --- |
| `backend` | `backend/` |
| `frontend` | `frontend/` |
| `k8s` | `kubernetes/` |
| `terraform` | `terraform/` |
| `ansible` | `ansible/` |
| `ci` | `.github/workflows/` |
| `root` | Repo-level files (MEMORY.md, docker-compose.yml, .gitignore) |

### Rules

- Summary line: **50 chars max**, lowercase, no period at the end
- Use **imperative mood**: "add endpoint" not "added endpoint"
- Body: wrap at 72 chars, explain the **why** (not the what)
- Never commit secrets, credentials, or generated build artifacts

### Examples

```text
feat(backend): add jwt authentication

Protects all product endpoints behind Bearer token auth.
Admin user seeded with BCrypt on startup.
```

```text
fix(frontend): correct status badge colour for LOW_STOCK
```

```text
infra(k8s): add postgres statefulset with persistent volume

Uses a PVC so data survives pod restarts. Secret refs replace
hardcoded credentials in the deployment manifest.
```

```text
ci: add sonarcloud sast step to backend workflow

Runs after tests so JaCoCo coverage is available for the scan.
Fails the build if quality gate is not passed.
```

---

## Key design decisions

- **Monorepo**: all code, infra, and pipelines in one place for simplicity of demonstration
- **On-prem over cloud**: QEMU/KVM VMs provisioned by Terraform (libvirt provider) + Ansible instead of AWS EKS — avoids cloud costs, demonstrates on-prem DevSecOps
- **Cloud images + cloud-init**: Ubuntu cloud qcow2 images with cloud-init eliminate manual OS installation; VM is SSH-ready in ~60s after `terraform apply`
- **k3s over full Kubernetes**: single-binary lightweight Kubernetes appropriate for on-prem; includes Traefik ingress by default
- **Cloudflare Tunnel**: provides a free public HTTPS URL without port forwarding; deployed as a Kubernetes Deployment inside the cluster
- **JWT over session auth**: stateless, suitable for a Kubernetes environment where multiple pod replicas share no session state
- **PostgreSQL over H2**: enterprise-standard SQL database; H2 is used only in tests so CI needs no external DB
- **Angular Material**: professional UI out of the box, minimal custom CSS required
- **Env-var-driven config**: no secrets hardcoded anywhere; ready for Kubernetes Secrets injection
- **Status auto-computation**: the service layer derives stock status from quantity — no manual status field exposed to the frontend form
- **nginx:alpine-slim over nginx:alpine**: frontend final stage uses `nginx:alpine-slim` (21.8MB vs 93.9MB) — strips bash, apk, and unused modules while keeping static serving, `try_files`, and `proxy_pass`
- **jlink custom JRE for backend**: 3-stage build uses `jdeps` + `jlink` to assemble a minimal JRE with only the modules Spring Boot actually imports (204MB vs 355MB)
