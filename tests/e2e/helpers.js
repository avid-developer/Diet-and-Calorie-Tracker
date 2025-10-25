import { expect } from '@playwright/test'

export const clearState = async (page) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
}

export const addFood = async (page, { name, unit, kcal, protein, carbs, fat }) => {
  await page.fill('#food-name', name)
  await page.fill('#food-unit', unit)
  await page.fill('#food-kcal', String(kcal))
  await page.fill('#food-protein', String(protein))
  await page.fill('#food-carbs', String(carbs))
  await page.fill('#food-fat', String(fat))
  await page.click('#food-form button[type="submit"]')
  await expect(page.locator('#food-list')).toContainText(name)
}

export const logMeal = async (page, { date, time, foodLabel, quantity }) => {
  const select = page.locator('#meal-items .meal-item-row select').first()
  await expect(select).toBeEnabled()
  await select.selectOption({ label: foodLabel })
  const quantityInput = page.locator('#meal-items .meal-item-row input[type="number"]').first()
  await quantityInput.fill(String(quantity))
  await page.fill('#meal-date', date)
  await page.fill('#meal-time', time)
  await page.click('#meal-form button[type="submit"]')
  await expect(page.locator('#meal-feedback')).toContainText(`Logged meal for ${date}`)
}
