# MADA AI Assistant - E2E Tests

## Setup

```bash
# Install Playwright browsers
npx playwright install

# Run tests
npm run test:e2e

# Run with UI
npm run test:e2e:ui

# Run specific test
npx playwright test e2e/chat.spec.ts
```

## Test Structure

- `e2e/chat.spec.ts` - Main chat flow tests
- `e2e/accessibility.spec.ts` - WCAG 2.2 AA compliance tests
- `e2e/performance.spec.ts` - Performance & responsiveness tests

## CI/CD

Tests run automatically on push to main branch when `BASE_URL` is configured.
