---
name: api-design
description: RESTful API design principles, best practices, and common patterns. Use when designing or implementing backend APIs.
---

# API Design Best Practices

## RESTful Principles

### HTTP Methods

- **GET** - Retrieve resources (idempotent, safe)
- **POST** - Create new resources
- **PUT** - Update/replace entire resource (idempotent)
- **PATCH** - Partial update (idempotent)
- **DELETE** - Remove resource (idempotent)

### Resource Naming

✅ **Good:**
```
GET    /users
GET    /users/123
POST   /users
PUT    /users/123
DELETE /users/123
GET    /users/123/posts
```

❌ **Bad:**
```
GET    /getUsers
POST   /createUser
GET    /user/123/getPosts
DELETE /deleteUser/123
```

**Rules:**
- Use nouns, not verbs
- Use plural for collections
- Use lowercase
- Use hyphens for multi-word resources
- Keep URLs simple and intuitive

## URL Structure

```
https://api.example.com/v1/users/123/posts?status=published&limit=10

Protocol: https
Domain:   api.example.com
Version:  v1
Resource: users/123/posts
Query:    status=published&limit=10
```

### Versioning

**Option 1: URL Path (Recommended)**
```
/v1/users
/v2/users
```

**Option 2: Header**
```
Accept: application/vnd.api+json; version=1
```

**Option 3: Query Parameter**
```
/users?version=1
```

## Request/Response Patterns

### Successful Responses

```typescript
// GET /users/123
{
  "id": "123",
  "name": "John Doe",
  "email": "john@example.com",
  "createdAt": "2024-01-01T00:00:00Z"
}

// GET /users
{
  "data": [
    { "id": "123", "name": "John" },
    { "id": "456", "name": "Jane" }
  ],
  "meta": {
    "total": 100,
    "page": 1,
    "perPage": 20
  },
  "links": {
    "self": "/users?page=1",
    "next": "/users?page=2",
    "prev": null
  }
}

// POST /users (201 Created)
{
  "id": "789",
  "name": "New User",
  "createdAt": "2024-01-01T00:00:00Z"
}
```

### Error Responses

```typescript
// 400 Bad Request
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      {
        "field": "email",
        "message": "Email is required"
      },
      {
        "field": "age",
        "message": "Must be at least 18"
      }
    ]
  }
}

// 404 Not Found
{
  "error": {
    "code": "NOT_FOUND",
    "message": "User not found",
    "resource": "User",
    "id": "123"
  }
}

// 500 Internal Server Error
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred",
    "requestId": "abc-123-def"
  }
}
```

## Status Codes

### Success (2xx)
- **200 OK** - Successful GET, PUT, PATCH, DELETE
- **201 Created** - Successful POST
- **204 No Content** - Successful DELETE (no body)

### Client Errors (4xx)
- **400 Bad Request** - Invalid input
- **401 Unauthorized** - Missing/invalid authentication
- **403 Forbidden** - Authenticated but not authorized
- **404 Not Found** - Resource doesn't exist
- **409 Conflict** - Resource conflict (e.g., duplicate)
- **422 Unprocessable Entity** - Validation failed
- **429 Too Many Requests** - Rate limit exceeded

### Server Errors (5xx)
- **500 Internal Server Error** - Generic server error
- **502 Bad Gateway** - Invalid upstream response
- **503 Service Unavailable** - Temporary unavailability
- **504 Gateway Timeout** - Upstream timeout

## Pagination

### Offset-based
```
GET /users?limit=20&offset=40
```

Response:
```json
{
  "data": [...],
  "pagination": {
    "limit": 20,
    "offset": 40,
    "total": 100
  }
}
```

### Cursor-based (Better for large datasets)
```
GET /users?limit=20&cursor=eyJpZCI6MTIzfQ==
```

Response:
```json
{
  "data": [...],
  "pagination": {
    "nextCursor": "eyJpZCI6MTQzfQ==",
    "hasMore": true
  }
}
```

## Filtering & Sorting

```
GET /users?status=active&role=admin&sort=-createdAt,name
```

- `status=active` - Filter by status
- `role=admin` - Filter by role
- `sort=-createdAt,name` - Sort by createdAt desc, then name asc

## Authentication

### Bearer Token (Recommended)
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

### API Key
```
X-API-Key: your-api-key-here
```

### Basic Auth (Less secure)
```
Authorization: Basic base64(username:password)
```

## Rate Limiting

Response Headers:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1640995200
```

When exceeded (429):
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests",
    "retryAfter": 60
  }
}
```

## CORS Headers

```
Access-Control-Allow-Origin: https://example.com
Access-Control-Allow-Methods: GET, POST, PUT, DELETE
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Max-Age: 86400
```

## Validation

```typescript
// Request validation
interface CreateUserRequest {
  name: string;        // Required, 1-100 chars
  email: string;       // Required, valid email
  age?: number;        // Optional, >= 18
  role?: 'user' | 'admin'; // Optional, enum
}

// Validation errors
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "email",
        "value": "invalid-email",
        "message": "Must be a valid email address"
      }
    ]
  }
}
```

## Idempotency

For non-idempotent operations (POST), use idempotency keys:

```
POST /payments
Idempotency-Key: unique-key-123
```

Server stores the key and returns same response for duplicate requests.

## Webhooks

```typescript
// Webhook payload
{
  "event": "user.created",
  "timestamp": "2024-01-01T00:00:00Z",
  "data": {
    "id": "123",
    "name": "John Doe"
  },
  "signature": "sha256=abc123..." // For verification
}
```

## API Documentation

Use OpenAPI/Swagger:

```yaml
openapi: 3.0.0
info:
  title: User API
  version: 1.0.0
paths:
  /users:
    get:
      summary: List users
      parameters:
        - name: limit
          in: query
          schema:
            type: integer
            default: 20
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      $ref: '#/components/schemas/User'
```

## Best Practices Checklist

- [ ] Use consistent naming conventions
- [ ] Version your API
- [ ] Implement proper error handling
- [ ] Use appropriate status codes
- [ ] Support pagination for lists
- [ ] Implement rate limiting
- [ ] Use HTTPS everywhere
- [ ] Validate all inputs
- [ ] Document your API
- [ ] Handle CORS properly
- [ ] Log requests and errors
- [ ] Monitor API performance
- [ ] Implement caching where appropriate
- [ ] Use compression (gzip)
- [ ] Support filtering and sorting
