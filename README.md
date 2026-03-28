# ShravanKirana

A modern monorepo architecture for building scalable web applications using microservices, shared libraries, and containerized deployment.

## Project Overview

ShravanKirana is a comprehensive project template that demonstrates best practices for building and deploying full-stack applications. It provides a well-structured foundation with separate services, web applications, and shared utilities organized in a monorepo using npm workspaces.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        ShravanKirana                            │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │   Services   │  │    Apps     │  │       Shared         │   │
│  ├──────────────┤  ├──────────────┤  ├──────────────────────┤   │
│  │ auth-service │  │ web-app     │  │ shared (utils, types,│   │
│  │ (3001)       │  │ (3000)       │  │       constants)     │   │
│  │              │  │             │  │                     │   │
│  │ api-gateway  │  │ admin-app   │  │                      │   │
│  │ (3002)       │  │ (3003)       │  │                      │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Service Inventory

| Service       | Port  | Description                    |
|---------------|-------|--------------------------------|
| web-app       | 3000  | Main frontend application      |
| auth-service  | 3001  | Authentication & authorization |
| api-gateway   | 3002  | API routing & middleware       |
| admin-app     | 3003  | Admin dashboard                |

## Quick Start

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- npm 9+

### Running with Docker Compose

```bash
# Clone the repository
git clone https://github.com/your-org/shravankirana.git
cd shravankirana

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f
```

### Running Locally

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Start all services in development mode
npm run dev

# Or start specific service
cd apps/web-app && npm run dev
```

## Development Setup

### Project Structure

```
shravankirana/
├── apps/
│   ├── web-app/        # Main web application
│   └── admin-app/      # Admin dashboard
├── services/
│   ├── auth-service/    # Authentication service
│   └── api-gateway/    # API Gateway
├── shared/             # Shared utilities and types
├── docker-compose.yml  # Docker orchestration
├── package.json        # Root workspace config
└── tsconfig.json       # TypeScript configuration
```

### Environment Variables

Create `.env` files in each service directory:

```env
# .env.example for auth-service
NODE_ENV=development
PORT=3001
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d
DATABASE_URL=postgresql://user:pass@localhost:5432/auth

# .env.example for api-gateway
NODE_ENV=development
PORT=3002
AUTH_SERVICE_URL=http://localhost:3001

# .env.example for web-app
NODE_ENV=development
API_GATEWAY_URL=http://localhost:3002
```

### Available Scripts

| Command       | Description                    |
|---------------|--------------------------------|
| `npm run dev` | Start all services in dev mode |
| `npm run build` | Build all packages           |
| `npm run test` | Run tests across workspace   |
| `npm run lint` | Lint all packages            |

## API Documentation

### Authentication Endpoints

| Method | Endpoint            | Description          |
|--------|---------------------|----------------------|
| POST   | /api/auth/register  | Register new user    |
| POST   | /api/auth/login     | User login           |
| POST   | /api/auth/logout    | User logout          |
| GET    | /api/auth/me        | Get current user     |
| PUT    | /api/auth/profile   | Update user profile  |

### API Gateway Routes

| Method | Endpoint       | Service        | Description        |
|--------|----------------|----------------|---------------------|
| *      | /api/auth/*    | auth-service   | Auth routes         |
| *      | /api/users/*   | user-service   | User routes         |
| *      | /api/*         | api-gateway    | Catch-all routes    |

## Deployment

### Docker Deployment

```bash
# Build production images
docker-compose -f docker-compose.prod.yml build

# Deploy to production
docker-compose -f docker-compose.prod.yml up -d
```

### Cloud Deployment

Recommended platforms:
- **AWS**: ECS, EKS, App Runner
- **GCP**: Cloud Run, GKE
- **Azure**: Container Instances, AKS

### Kubernetes

```bash
# Apply kubernetes manifests
kubectl apply -f k8s/

# Check deployment status
kubectl get pods -n shravankirana
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style

- Use TypeScript for all new code
- Follow ESLint configuration
- Write tests for new features
- Update documentation as needed

### Commit Messages

Format: `type(scope): description`

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting
- `refactor`: Refactoring
- `test`: Testing
- `chore`: Maintenance

## License

This project is licensed under the MIT License.

## Support

- Documentation: [docs.shravankirana.dev](https://docs.shravankirana.dev)
- Issues: [GitHub Issues](https://github.com/your-org/shravankirana/issues)
- Email: support@shravankirana.dev
