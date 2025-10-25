import { test, expect } from '@playwright/test'
import { clearState, addFood, logMeal } from './helpers.js'

test.describe('Meal undo workflow', () => {
  test.beforeEach(async ({ page }) => {
    await clearState(page)
  })

  test('allows undoing a meal deletion', async ({ page }) => {
    const today = new Date().toISOString().slice(0, 10)

    await addFood(page, {
      name: 'Toast',
      unit: '2 slices',
      kcal: 160,
      protein: 6,
      carbs: 28,
      fat: 3
    })

    await logMeal(page, {
      date: today,
      time: '07:45',
      foodLabel: 'Toast (2 slices)',
      quantity: 1
    })

    await expect(page.locator('#meal-list')).toContainText('07:45')

    page.once('dialog', dialog => dialog.accept())
    await page.click('#meal-list .meal-entry button.danger')

    const feedback = page.locator('#meal-feedback')
    await expect(feedback).toContainText('Deleted meal')

    await feedback.getByRole('button', { name: 'Undo' }).click()
    await expect(feedback).toContainText('Restored meal')
    await expect(page.locator('#meal-list')).toContainText('07:45')
  })
})
