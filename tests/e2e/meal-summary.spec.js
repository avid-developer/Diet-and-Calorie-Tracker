import { test, expect } from '@playwright/test'
import { clearState, addFood, logMeal } from './helpers.js'

test.describe('Meal logging and summaries', () => {
  test.beforeEach(async ({ page }) => {
    await clearState(page)
  })

  test('updates daily and weekly summaries after logging meals', async ({ page }) => {
    const today = new Date().toISOString().slice(0, 10)

    await addFood(page, {
      name: 'Rice',
      unit: '1 cup',
      kcal: 200,
      protein: 4,
      carbs: 45,
      fat: 1
    })

    await logMeal(page, {
      date: today,
      time: '08:00',
      foodLabel: 'Rice (1 cup)',
      quantity: 2
    })

    await page.fill('#goal-kcal', '500')
    await page.click('#goal-form button[type="submit"]')

    const dailySummary = page.locator('#daily-summary')
    await expect(dailySummary).toContainText('400 kcal')
    await expect(dailySummary).toContainText('Goal')

    const weeklySummaryTable = page.locator('#weekly-summary table')
    await expect(weeklySummaryTable).toContainText('400 kcal')
    await expect(page.locator('.weekly-chart .chart-bar').first()).toBeVisible()
  })
})
