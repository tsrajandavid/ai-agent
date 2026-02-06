---
name: testing
description: Comprehensive testing strategies and patterns
---

# SKILL: TESTING

When writing tests, adhere to these principles:

## TESTING PYRAMID
- **Unit Tests**: Check individual functions/classes in isolation. (Fast, specific)
- **Integration Tests**: Check interactions between modules/database. (Slower, realistic)
- **E2E Tests**: Check full user flows. (Slow, most realistic)

## TEST STRUCTURE (AAA Pattern)
1. **Arrange**: Set up the initial state, mocks, and data.
2. **Act**: Trigger the function or component behavior.
3. **Assert**: Verify the result matches expectations.

## REACT TESTING (React Testing Library)
- **Test Behavior**: Test what the user sees/does, not internal state.
- **Queries**: Prefer `getByRole`, `getByLabelText`, `getByText`. Avoid `testId` unless necessary.
- **User Events**: Use `user-event` library for interactions (click, type).
- **Mocking**: Mock network requests (MSW) and complex child components context if needed.

## BACKEND TESTING (Jest/Supertest)
- **Isolation**: Reset database/mocks between tests.
- **Coverage**: Test happy paths, edge cases, and error handling.
- **Status Codes**: Verify correct HTTP status codes (200, 400, 401, 500).

## MOCKING
- Mock external systems (APIs, third-party services).
- Do NOT mock the logic you are testing.
- Keep mocks simple and relevant.

## QUALITY
- Descriptive test names: `it('should calculate total with discount', ...)`
- One concept per test suite.
- Clean up resources (spy.mockRestore()).
