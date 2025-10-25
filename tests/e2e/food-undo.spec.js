import { test, expect } from '@playwright/test'
import { clearState } from './helpers.js'

test.describe('Food management undo flow', () => {
  test.beforeEach(async ({ page }) => {
    await clearState(page)
  })

  test('allows undoing a food deletion', async ({ page }) => {
    await page.fill('#food-name', 'Apple')
    await page.fill('#food-unit', '1 medium')
    await page.fill('#food-kcal', '95')
    await page.fill('#food-protein', '0.3')
    await page.fill('#food-carbs', '25')
    await page.fill('#food-fat', '0.2')
    await page.click('#food-form button[type="submit"]')

    await expect(page.locator('#food-list')).toContainText('Apple')

  page.once('dialog', dialog => dialog.accept())
  await page.click('#food-list .food-item button.danger')

    const feedback = page.locator('#food-feedback')
    await expect(feedback).toContainText('Deleted Apple')
    await feedback.getByRole('button', { name: 'Undo' }).click()
    await expect(feedback).toContainText('Restored Apple')
    await expect(page.locator('#food-list')).toContainText('Apple')
  })
})
