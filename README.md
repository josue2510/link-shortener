# Link Shortener

A URL shortening service built with Express 5 and TypeScript, featuring a layered architecture, in-memory storage, LRU caching, and custom rate limiting.

## How to Run

### Prerequisites

- **Node.js** >= 18
- **pnpm** 10.x

### Install Dependencies

```bash
pnpm install
```

### Development Mode (hot-reload)

```bash
pnpm dev
```

The server starts at `http://localhost:3000`.

### Production Build

```bash
pnpm build
pnpm start
```

### Run Tests

```bash
pnpm test
```

### API Usage

**Shorten a URL:**

```bash
curl -X POST http://localhost:3000/api/links \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
```

Response:

```json
{
  "success": true,
  "data": {
    "id": "aBcDeFg",
    "originalUrl": "https://example.com",
    "shortCode": "xYzWvUt",
    "shortUrl": "http://localhost:3000/api/links/xYzWvUt",
    "createdAt": "2025-01-01T00:00:00.000Z"
  }
}
```

**Redirect to the original URL:**

```bash
curl -L http://localhost:3000/api/links/:shortCode
```

This issues a `301 Permanent Redirect` to the original URL.

## High-Level Design

### Layered Architecture

The project follows a strict separation of concerns:

```
Routes -> Controllers -> Services -> Repositories
```

| Layer          | Responsibility                                                                 |
| -------------- | ------------------------------------------------------------------------------ |
| **Routes**     | Define HTTP endpoints and mount middleware (`src/routes/`)                      |
| **Controllers**| Parse requests, call services, format responses (`src/controllers/`)            |
| **Services**   | Core business logic, URL validation, caching (`src/services/`)                 |
| **Repositories** | Data persistence abstraction (`src/repositories/`)                           |

### Repository Pattern

A `LinkRepository` interface defines the data access contract. The current implementation, `InMemoryLinkRepository`, uses a `Map<string, Link>` for storage. This design makes it straightforward to swap in a real database (e.g., PostgreSQL with Prisma) without changing the service layer.

### LRU Cache

The service layer uses a custom `LruCache` implementation to accelerate lookups by short code and by original URL. The cache is capped at **50 entries** and evicts the least-recently-used item when full.

### Custom Rate Limiting

A zero-dependency rate limiter middleware tracks requests per IP address with two tiers:

- **Global**: 100 requests per minute per IP (applied to all routes)
- **Link creation**: 10 requests per minute per IP (applied to `POST /api/links`)

Each response includes `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` headers. Rate-limited responses also include a `Retry-After` header.

The rate limiter store runs a periodic cleanup timer (every 60 seconds) to purge expired entries, with `.unref()` so it does not prevent the process from exiting.

### Error Handling

A custom `AppError` class and a centralized Express error middleware produce consistent JSON error envelopes:

```json
{
  "success": false,
  "error": {
    "message": "Short link not found",
    "code": "LINK_NOT_FOUND"
  }
}
```

Express 5's native async error handling support ensures that thrown errors in async route handlers are caught automatically.

### Short ID Generation

Short codes are generated using `crypto.randomBytes(4)` encoded as `base64url` and truncated to 7 characters, providing roughly 17 million unique values.

## Tradeoffs and Assumptions

- **In-memory storage**: All data is lost on server restart. Chosen for simplicity; the repository interface makes swapping to a persistent store straightforward.
- **No input validation library**: URL validation relies on the built-in `URL` constructor. A library like `zod` would provide richer validation and clearer error messages.
- **No authentication or authorization**: The API is fully open; any client can create and resolve links.
- **LRU cache size (50 entries)**: A small, fixed cache suitable for a demo. Production workloads would need tuning or an external cache like Redis.
- **In-process rate limiter**: Tracks state in a single process's memory. This does not work correctly across multiple server instances; a distributed store (e.g., Redis) would be needed for horizontal scaling.
- **Short code collisions**: 7-character base64url codes from 4 random bytes yield ~17 million possible values. Collisions are unlikely at small scale, but no collision-detection or retry logic exists.
- **301 Permanent Redirect**: Browsers cache 301 redirects aggressively. A 302 Temporary Redirect would be more flexible if link analytics or URL updates were needed later.

## What I Would Improve With More Time

- **Persistent database** (e.g., PostgreSQL with Prisma or Drizzle ORM) for durable storage.
- **Input validation** with a schema library like `zod`, covering request bodies, params, and content-type checks.
- **Higher test coverage**: Unit tests for `LinkService`, `LruCache`, and `short-id.utils`, plus integration tests for the API endpoints.
- **Analytics**: Track click counts, referrers, and timestamps per link.
- **Link expiration**: TTL-based auto-expiry for shortened links.
- **Custom short codes**: Allow users to choose their own alias.
- **Swagger/OpenAPI documentation** for the API.
- **Docker** containerization with a `docker-compose.yml` for easy local setup.
- **CI/CD pipeline** with GitHub Actions for linting, testing, and building on every push.
- **Environment configuration**: Use `dotenv` or a config library for environment-specific settings (port, cache size, rate limits, etc.).

## How I Used AI Tools
- **Scaffolding the layered architecture**: The assistant helped set up the routes, controllers, services, and repositories structure following Express best practices and separation of concerns.
- **Dependencies documentation/Setting up the configuration**: The assistant provided guidance on setting up the configuration for run a server using ts and tsx.
- **Writing tests**: Unit tests for the `RateLimiterStore` and the rate limiter middleware were written with AI assistance using `node:test` and `node:assert/strict`, following the AAA (Arrange-Act-Assert) pattern.
- **Drafting this README**: The assistant analyzed the full codebase and generated this documentation based on the project's actual structure, conventions, and implementation details.
