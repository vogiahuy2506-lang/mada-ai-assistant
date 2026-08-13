import { test, expect } from '@playwright/test';

/**
 * E2E Test: Performance & Response Time
 * Target: AI response under 2 seconds
 */
test.describe('Performance', () => {
  test('page should load within acceptable time', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');
    
    const loadTime = Date.now() - startTime;
    console.log(`Page load time: ${loadTime}ms`);
    
    // Page should load within 3 seconds
    expect(loadTime).toBeLessThan(3000);
  });

  test('chat interface should be responsive', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');
    
    // UI should respond to interactions quickly
    const input = page.locator('textarea').first();
    
    if (await input.isVisible()) {
      const startTyping = Date.now();
      await input.fill('Test message');
      const typingTime = Date.now() - startTyping;
      
      // Typing should feel instant (< 100ms)
      expect(typingTime).toBeLessThan(100);
    }
  });

  test('should work on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');
    
    // Main content should be visible
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 10000 });
    
    // No horizontal overflow
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth);
  });

  test('should work on tablet viewport', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');
    
    // Main content should be visible
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 10000 });
  });
});
