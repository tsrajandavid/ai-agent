---
name: database-operations
description: Best practices for database interactions and design
---

# SKILL: DATABASE OPERATIONS

When designing schemas or writing queries, follow these patterns:

## SCHEMA DESIGN

- **Normalization**: Normalize to 3NF to avoid redundancy unless write performance/read complexity dictates denormalization.
- **Indexing**: precise indexes for query predicates. Unique constraints where applicable.
- **Foreign Keys**: Enforce referential integrity at the database level.
- **Data Types**: Choose appropriate data types (e.g., proper timestamp types, UUID vs Integer IDs).

## QUERYING

- **Parameterization**: ALWAYS use parameterized queries or ORM methods to prevent SQL Injection.
- **Efficiency**: Avoid `SELECT *`. Select specific columns.
- **Transactions**: Use transactions for multi-step operations that must be atomic.
- **Pagination**: Use cursor-based pagination for large datasets instead of OFFSET/LIMIT where possible.

## ORM BEST PRACTICES (Prisma/TypeORM/Mongoose)

- Understand the generated SQL/Query.
- Use bulk operations (`createMany`, `updateMany`) instead of loops.
- Handle connection errors and timeouts gracefully.
- Run migrations as part of the deployment pipeline.

## MIGRATIONS

- Scripts should be idempotent if possible.
- Never modify existing migration files; create new ones.
- Test "down" or rollback migrations.
