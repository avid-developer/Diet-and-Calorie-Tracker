import { test, expect } from '@playwright/test'
import { promises as fs } from 'fs'
import { clearState, addFood, logMeal } from './helpers.js'

const readDownload = async (download) => {
  const path = await download.path()
  if(path){
    return fs.readFile(path, 'utf-8')
  }
  const stream = await download.createReadStream()
  if(!stream){ return '' }
  return new Promise((resolve, reject) => {
    const chunks = []
    stream.on('data', chunk => chunks.push(Buffer.from(chunk)))
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
    stream.on('error', reject)
  })
}

test.describe('Goals and exports', () => {
  test.beforeEach(async ({ page }) => {
    await clearState(page)
  })

  test('updates daily goal status when goal changes', async ({ page }) => {
    const today = new Date().toISOString().slice(0, 10)

    await page.fill('#goal-kcal', '2000')
    await page.click('#goal-form button[type="submit"]')
    await expect(page.locator('#goal-status')).toContainText(`Saved goal 2000 kcal for ${today}`)

    await page.fill('#goal-kcal', '1800')
    await page.click('#goal-form button[type="submit"]')
    await expect(page.locator('#goal-status')).toContainText(`Saved goal 1800 kcal for ${today}`)

    const dailySummary = page.locator('#daily-summary')
    await expect(dailySummary).toContainText('Goal')
  })

  test('exports weekly summary as CSV', async ({ page, context }) => {
    const today = new Date().toISOString().slice(0, 10)

    await addFood(page, {
      name: 'Oats',
      unit: '1 bowl',
      kcal: 150,
      protein: 5,
      carbs: 27,
      fat: 3
    })

    await logMeal(page, {
      date: today,
      time: '07:30',
      foodLabel: 'Oats (1 bowl)',
      quantity: 1
    })

    await page.fill('#weekly-end-date', today)
    await page.click('#weekly-form button[type="submit"]')
    await expect(page.locator('#weekly-summary')).toContainText('150 kcal')

    const downloadPromise = page.waitForEvent('download')
    await page.click('#weekly-export')
    const download = await downloadPromise

    expect(download.suggestedFilename()).toContain(`weekly-summary-${today}`)
  const csvContent = await readDownload(download)
    expect(csvContent).toContain(today)
    expect(csvContent).toContain('150')
  })
})
