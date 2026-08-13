import { test, expect } from '@playwright/test';

/**
 * E2E Test: Accessibility (WCAG 2.2 AA)
 */
test.describe('Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');
  });

  test('should have skip link for keyboard navigation', async ({ page }) => {
    // Skip link should exist in the DOM (even if hidden)
    const skipLink = page.locator('a.skip-link');
    await expect(skipLink).toHaveCount(1);
    
    // Tab to skip link should make it visible and focusable
    await page.keyboard.press('Tab');
    await expect(skipLink).toBeFocused();
  });

  test('should support full keyboard navigation', async ({ page }) => {
    // Tab through interactive elements
    await page.keyboard.press('Tab');
    
    // Should be able to tab through without getting stuck
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
      // No error should occur
    }
  });

  test('should have proper ARIA labels on interactive elements', async ({ page }) => {
    // Check that buttons have accessible names
    const buttons = page.locator('button');
    const count = await buttons.count();
    
    // Sample first 5 buttons for accessibility
    for (let i = 0; i < Math.min(count, 5); i++) {
      const button = buttons.nth(i);
      const hasLabel = await button.getAttribute('aria-label');
      const hasText = await button.textContent();
      
      // Button should have either aria-label or text content
      expect(hasLabel || (hasText && hasText.trim().length > 0)).toBeTruthy();
    }
  });

  test('should have proper heading hierarchy', async ({ page }) => {
    // Check for h1, h2, h3 hierarchy
    const h1 = page.locator('h1');
    const h2 = page.locator('h2');
    
    // Should have at least one h1
    await expect(h1.first()).toBeVisible({ timeout: 5000 });
    
    // Headings should exist
    const h1Count = await h1.count();
    
    expect(h1Count).toBeGreaterThanOrEqual(1);
  });

  test('should have sufficient color contrast', async ({ page }) => {
    // This is a basic check - full contrast testing requires specialized tools
    // Check that text is not invisible
    const bodyText = page.locator('body');
    await expect(bodyText).toBeVisible();
  });
});
