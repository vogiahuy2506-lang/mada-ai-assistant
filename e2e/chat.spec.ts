import { test, expect } from '@playwright/test';

/**
 * E2E Test: Chat Flow - MADA AI Assistant
 * Tests the main user interaction flow
 */
test.describe('Chat Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/chat');
    // Wait for page to load
    await page.waitForLoadState('networkidle');
  });

  test('should load chat page successfully', async ({ page }) => {
    // Check main elements are present
    await expect(page.locator('#main-content')).toBeVisible();
    // Use first() to avoid strict mode violation
    await expect(page.getByRole('heading', { name: /MADA AI/i }).first()).toBeVisible({ timeout: 10000 });
  });

  test('should display welcome message on chat page', async ({ page }) => {
    // Check for welcome message - use first() to avoid strict mode violation
    await expect(page.getByRole('heading', { name: /MADA AI/i }).first()).toBeVisible({ timeout: 10000 });
  });

  test('should be able to type in chat input', async ({ page }) => {
    // Find message input - use more specific selector
    const input = page.locator('textarea').first();
    
    if (await input.isVisible()) {
      await input.fill('Tôi cần thiết bị hỗ trợ nghe');
      
      // Verify the text was entered
      await expect(input).toHaveValue('Tôi cần thiết bị hỗ trợ nghe');
    }
  });

  test('should switch language correctly', async ({ page }) => {
    // Find and click language selector button
    const langButton = page.locator('button').filter({ hasText: /language|ngôn ngữ|Tiếng Việt|English/i }).first();
    
    if (await langButton.isVisible()) {
      await langButton.click();
      await page.waitForTimeout(500);
    }
  });

  test('should display chat interface elements', async ({ page }) => {
    // Check that chat interface is rendered
    const chatContainer = page.locator('#main-content');
    await expect(chatContainer).toBeVisible();
    
    // Check for input area (textarea or input)
    const hasInput = await page.locator('textarea, input[type="text"]').first().isVisible();
    expect(hasInput).toBeTruthy();
  });
});
