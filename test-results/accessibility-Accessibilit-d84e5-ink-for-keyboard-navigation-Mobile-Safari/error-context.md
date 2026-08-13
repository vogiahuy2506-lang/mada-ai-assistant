# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: accessibility.spec.ts >> Accessibility >> should have skip link for keyboard navigation
- Location: e2e/accessibility.spec.ts:12:3

# Error details

```
Error: expect(locator).toBeFocused() failed

Locator:  locator('a.skip-link')
Expected: focused
Received: inactive
Timeout:  5000ms

Call log:
  - Expect "toBeFocused" with timeout 5000ms
  - waiting for locator('a.skip-link')
    14 × locator resolved to <a class="skip-link" href="#main-content">Skip to main content</a>
       - unexpected value "inactive"

```

```yaml
- link "Skip to main content":
  - /url: "#main-content"
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | /**
  4  |  * E2E Test: Accessibility (WCAG 2.2 AA)
  5  |  */
  6  | test.describe('Accessibility', () => {
  7  |   test.beforeEach(async ({ page }) => {
  8  |     await page.goto('/chat');
  9  |     await page.waitForLoadState('networkidle');
  10 |   });
  11 | 
  12 |   test('should have skip link for keyboard navigation', async ({ page }) => {
  13 |     // Skip link should exist in the DOM (even if hidden)
  14 |     const skipLink = page.locator('a.skip-link');
  15 |     await expect(skipLink).toHaveCount(1);
  16 |     
  17 |     // Tab to skip link should make it visible and focusable
  18 |     await page.keyboard.press('Tab');
> 19 |     await expect(skipLink).toBeFocused();
     |                            ^ Error: expect(locator).toBeFocused() failed
  20 |   });
  21 | 
  22 |   test('should support full keyboard navigation', async ({ page }) => {
  23 |     // Tab through interactive elements
  24 |     await page.keyboard.press('Tab');
  25 |     
  26 |     // Should be able to tab through without getting stuck
  27 |     for (let i = 0; i < 10; i++) {
  28 |       await page.keyboard.press('Tab');
  29 |       // No error should occur
  30 |     }
  31 |   });
  32 | 
  33 |   test('should have proper ARIA labels on interactive elements', async ({ page }) => {
  34 |     // Check that buttons have accessible names
  35 |     const buttons = page.locator('button');
  36 |     const count = await buttons.count();
  37 |     
  38 |     // Sample first 5 buttons for accessibility
  39 |     for (let i = 0; i < Math.min(count, 5); i++) {
  40 |       const button = buttons.nth(i);
  41 |       const hasLabel = await button.getAttribute('aria-label');
  42 |       const hasText = await button.textContent();
  43 |       
  44 |       // Button should have either aria-label or text content
  45 |       expect(hasLabel || (hasText && hasText.trim().length > 0)).toBeTruthy();
  46 |     }
  47 |   });
  48 | 
  49 |   test('should have proper heading hierarchy', async ({ page }) => {
  50 |     // Check for h1, h2, h3 hierarchy
  51 |     const h1 = page.locator('h1');
  52 |     const h2 = page.locator('h2');
  53 |     
  54 |     // Should have at least one h1
  55 |     await expect(h1.first()).toBeVisible({ timeout: 5000 });
  56 |     
  57 |     // Headings should exist
  58 |     const h1Count = await h1.count();
  59 |     
  60 |     expect(h1Count).toBeGreaterThanOrEqual(1);
  61 |   });
  62 | 
  63 |   test('should have sufficient color contrast', async ({ page }) => {
  64 |     // This is a basic check - full contrast testing requires specialized tools
  65 |     // Check that text is not invisible
  66 |     const bodyText = page.locator('body');
  67 |     await expect(bodyText).toBeVisible();
  68 |   });
  69 | });
  70 | 
```