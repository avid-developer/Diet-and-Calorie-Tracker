import * as storage from './storage.js'
import { renderFoodList, renderMealList } from './ui.js'

document.addEventListener('DOMContentLoaded', () => {
  // Food form elements
  const foodForm = document.getElementById('food-form')
  const foodList = document.getElementById('food-list')
  const foodIdInput = document.getElementById('food-id')
  const foodNameInput = document.getElementById('food-name')
  const foodUnitInput = document.getElementById('food-unit')
  const foodKcalInput = document.getElementById('food-kcal')
  const foodProteinInput = document.getElementById('food-protein')
  const foodCarbsInput = document.getElementById('food-carbs')
  const foodFatInput = document.getElementById('food-fat')
  const foodCancelBtn = document.getElementById('food-cancel')
  const foodFeedback = document.getElementById('food-feedback')

  // Meal form elements
  const mealForm = document.getElementById('meal-form')
  const mealIdInput = document.getElementById('meal-id')
  const mealDateInput = document.getElementById('meal-date')
  const mealTimeInput = document.getElementById('meal-time')
  const mealItemsContainer = document.getElementById('meal-items')
  const mealAddItemBtn = document.getElementById('meal-add-item')
  const mealCancelBtn = document.getElementById('meal-cancel')
  const mealTotalEl = document.getElementById('meal-total')
  const mealTotalProteinEl = document.getElementById('meal-total-protein')
  const mealTotalCarbsEl = document.getElementById('meal-total-carbs')
  const mealTotalFatEl = document.getElementById('meal-total-fat')
  const mealFeedback = document.getElementById('meal-feedback')
  const mealList = document.getElementById('meal-list')

  // Goal form
  const goalForm = document.getElementById('goal-form')
  const goalStatus = document.getElementById('goal-status')

  // Summary elements
  const dailySummaryEl = document.getElementById('daily-summary')
  const weeklySummaryEl = document.getElementById('weekly-summary')
  const weeklyForm = document.getElementById('weekly-form')
  const weeklyEndDateInput = document.getElementById('weekly-end-date')
  const weeklyExportBtn = document.getElementById('weekly-export')
  const macroBreakdownToggle = document.getElementById('macro-breakdown-toggle')
  const macroModal = document.getElementById('macro-modal')
  const macroModalClose = document.getElementById('macro-modal-close')
  const macroModalBody = document.getElementById('macro-modal-body')
  const toggleMacroModal = (isOpen) => {
    if(!macroModal){ return }
    macroModal.hidden = !isOpen
    document.body.classList.toggle('modal-open', isOpen)
    if(isOpen){
      macroModal.focus()
    } else {
      macroBreakdownToggle?.focus()
    }
  }

  const renderMacroBreakdown = (summaries) => {
  if(!macroModalBody){ return }
    if(!Array.isArray(summaries) || summaries.length === 0){
      macroModalBody.innerHTML = '<p>No data to display yet.</p>'
      return
    }
    const aggregate = summaries.reduce((acc, summary) => {
      acc.protein += summary.totalProtein || 0
      acc.carbs += summary.totalCarbs || 0
      acc.fat += summary.totalFat || 0
      return acc
    }, { protein: 0, carbs: 0, fat: 0 })
    const totalGrams = aggregate.protein + aggregate.carbs + aggregate.fat
    const segments = [
      { key: 'protein', label: 'Protein', value: aggregate.protein, colorClass: 'protein' },
      { key: 'carbs', label: 'Carbs', value: aggregate.carbs, colorClass: 'carbs' },
      { key: 'fat', label: 'Fat', value: aggregate.fat, colorClass: 'fat' }
    ]
    const rows = segments.map(({ key, label, value, colorClass }) => {
      const percent = totalGrams > 0 ? Math.round((value / totalGrams) * 100) : 0
      return `
        <tr>
          <th scope="row">${label}</th>
          <td>${roundOne(value)} g</td>
          <td>${percent}%</td>
        </tr>
      `
    }).join('')

    const bars = segments.map(({ label, value, colorClass }) => {
      const percent = totalGrams > 0 ? (value / totalGrams) * 100 : 0
      return `<div class="macro-dist-segment ${colorClass}" style="flex:${Math.max(percent, 5)}" aria-label="${label} ${roundOne(value)} g (${Math.round(percent)}%)"></div>`
    }).join('')

    macroModalBody.innerHTML = `
      <div class="macro-dist-bar" role="img" aria-label="Macro distribution across 7 days">${bars}</div>
      <table class="macro-dist-table">
        <thead>
          <tr><th scope="col">Macro</th><th scope="col">Total grams</th><th scope="col">Share</th></tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `
  }

  let cachedFoods = storage.loadFoods()
  let pendingFoodUndo = null
  const FOOD_UNDO_WINDOW_MS = 8000
  let pendingMealUndo = null
  const MEAL_UNDO_WINDOW_MS = 8000

  const dateFormatter = new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  })
  const weekdayFormatter = new Intl.DateTimeFormat(undefined, { weekday: 'short' })

  const getTodayISO = () => new Date().toISOString().slice(0, 10)

  const roundOne = (value) => Math.round(Number(value ?? 0) * 10) / 10

  const getMealRows = () => Array.from(mealItemsContainer.querySelectorAll('.meal-item-row'))

  const setFoodFeedback = (message, tone = 'info') => {
    foodFeedback.textContent = message
    foodFeedback.className = tone
  }

  const cancelFoodUndo = () => {
    if(pendingFoodUndo?.timer){
      clearTimeout(pendingFoodUndo.timer)
    }
    pendingFoodUndo = null
  }

  const restoreFoodSnapshot = (snapshot) => {
    const foods = storage.loadFoods()
    const withRestored = [...foods, snapshot].sort((a, b) => a.name.localeCompare(b.name))
    storage.saveFoods(withRestored)
    refreshFoodList()
    setFoodFeedback(`Restored ${snapshot.name}.`, 'success')
  }

  const cancelMealUndo = () => {
    if(pendingMealUndo?.timer){
      clearTimeout(pendingMealUndo.timer)
    }
    pendingMealUndo = null
  }

  const sortMealsDescending = (list) => [...list].sort((a, b) => {
    const aKey = `${a.date || ''}T${a.time || ''}`
    const bKey = `${b.date || ''}T${b.time || ''}`
    if(aKey === bKey){ return 0 }
    return aKey > bKey ? -1 : 1
  })

  const formatMealLabel = (meal) => {
    const dateLabel = meal.date || 'selected date'
    const timeLabel = meal.time || 'selected time'
    return `${dateLabel} ${timeLabel}`.trim()
  }

  const restoreMealSnapshot = (snapshot) => {
    const meals = storage.loadMeals().filter(meal => meal.id !== snapshot.id)
    const sorted = sortMealsDescending([...meals, snapshot])
    storage.saveMeals(sorted)
    pendingMealUndo = null
    refreshMealList()
    setMealFeedback(`Restored meal on ${formatMealLabel(snapshot)}.`, 'success')
  }

  const setMealFeedback = (message, tone = 'info') => {
    mealFeedback.textContent = message
    mealFeedback.className = tone
  }

  const setFoodFormMode = (isEditing) => {
    foodForm.dataset.mode = isEditing ? 'edit' : 'create'
    foodCancelBtn.hidden = !isEditing
  }

  const setMealFormMode = (isEditing) => {
    mealForm.dataset.mode = isEditing ? 'edit' : 'create'
    mealCancelBtn.hidden = !isEditing
  }

  const setDefaultMealDateTime = () => {
    const now = new Date()
    mealDateInput.value = now.toISOString().slice(0, 10)
    mealTimeInput.value = now.toTimeString().slice(0, 5)
  }

  const resetFoodForm = () => {
    foodForm.reset()
    foodIdInput.value = ''
    setFoodFormMode(false)
  }

  const setRowSnapshot = (row, snapshot) => {
    row.dataset.snapshot = JSON.stringify(snapshot || {})
  }

  const getRowSnapshot = (row) => {
    try {
      return JSON.parse(row.dataset.snapshot || '{}')
    } catch (error) {
      console.warn('Invalid meal row snapshot', error)
      return {}
    }
  }

  const populateFoodOptions = (select, row, item = {}) => {
    const previousValue = item.foodId || select.value || ''
    const hasFoods = cachedFoods.length > 0
    select.innerHTML = ''

    const placeholder = document.createElement('option')
    placeholder.value = ''
    placeholder.textContent = hasFoods ? 'Select food' : 'Add foods first'
    placeholder.disabled = true
    placeholder.selected = !previousValue
    select.appendChild(placeholder)

    cachedFoods.forEach(food => {
      const option = document.createElement('option')
      option.value = food.id
      option.textContent = food.unit ? `${food.name} (${food.unit})` : food.name
      option.dataset.kcal = food.kcal
      option.dataset.name = food.name
      option.dataset.unit = food.unit || ''
      option.dataset.protein = food.protein ?? 0
      option.dataset.carbs = food.carbs ?? 0
      option.dataset.fat = food.fat ?? 0
      select.appendChild(option)
    })

    if(previousValue){
      const match = cachedFoods.find(food => food.id === previousValue)
      if(match){
        select.value = previousValue
        setRowSnapshot(row, {
          foodId: match.id,
          foodName: match.name,
          unit: match.unit || '',
          kcalPerUnit: Number(match.kcal || 0),
          proteinPerUnit: Number(match.protein ?? 0),
          carbsPerUnit: Number(match.carbs ?? 0),
          fatPerUnit: Number(match.fat ?? 0)
        })
      } else if(item && (item.foodName || item.kcalPerUnit !== undefined)){
        const archived = document.createElement('option')
        archived.value = previousValue
        archived.textContent = `${item.foodName || 'Archived food'} (archived)`
        archived.dataset.kcal = item.kcalPerUnit ?? 0
        archived.dataset.name = item.foodName || 'Archived food'
        archived.dataset.unit = item.unit || ''
        archived.dataset.protein = item.proteinPerUnit ?? item.protein ?? 0
        archived.dataset.carbs = item.carbsPerUnit ?? item.carbs ?? 0
        archived.dataset.fat = item.fatPerUnit ?? item.fat ?? 0
        archived.selected = true
        select.appendChild(archived)
        setRowSnapshot(row, {
          foodId: previousValue,
          foodName: item.foodName || 'Archived food',
          unit: item.unit || '',
          kcalPerUnit: Number(item.kcalPerUnit ?? item.kcal ?? 0),
          proteinPerUnit: Number(item.proteinPerUnit ?? item.protein ?? 0),
          carbsPerUnit: Number(item.carbsPerUnit ?? item.carbs ?? 0),
          fatPerUnit: Number(item.fatPerUnit ?? item.fat ?? 0)
        })
      } else {
        setRowSnapshot(row, null)
      }
    } else {
      setRowSnapshot(row, null)
    }

    select.disabled = !hasFoods && !previousValue
  }

  const createMealRow = (item = {}) => {
    const row = document.createElement('div')
    row.className = 'meal-item-row'

    const foodSelect = document.createElement('select')
    foodSelect.required = true

    const quantityInput = document.createElement('input')
    quantityInput.type = 'number'
    quantityInput.min = '0'
    quantityInput.step = '0.1'
    quantityInput.required = true
    quantityInput.value = item.quantity ?? 1

    const removeBtn = document.createElement('button')
    removeBtn.type = 'button'
    removeBtn.textContent = 'Remove'
    removeBtn.className = 'danger'

    row.append(foodSelect, quantityInput, removeBtn)
    mealItemsContainer.appendChild(row)

    populateFoodOptions(foodSelect, row, item)

    foodSelect.addEventListener('change', () => {
      const selectedId = foodSelect.value
      if(selectedId){
        const match = cachedFoods.find(food => food.id === selectedId)
        if(match){
          setRowSnapshot(row, {
            foodId: match.id,
            foodName: match.name,
            unit: match.unit || '',
            kcalPerUnit: Number(match.kcal || 0),
            proteinPerUnit: Number(match.protein ?? 0),
            carbsPerUnit: Number(match.carbs ?? 0),
            fatPerUnit: Number(match.fat ?? 0)
          })
        }
      }
      recomputeMealTotal()
    })

    quantityInput.addEventListener('input', () => {
      recomputeMealTotal()
    })

    removeBtn.addEventListener('click', () => {
      row.remove()
      if(getMealRows().length === 0){
        ensureBaseMealRow()
      }
      recomputeMealTotal()
    })

    recomputeMealTotal()
  }

  const ensureBaseMealRow = () => {
    if(cachedFoods.length === 0){
      mealItemsContainer.innerHTML = ''
      return
    }
    if(getMealRows().length === 0){
      createMealRow()
    }
  }

  const refreshMealFoodOptions = () => {
    getMealRows().forEach(row => {
      const select = row.querySelector('select')
      const snapshot = getRowSnapshot(row)
      populateFoodOptions(select, row, snapshot)
    })
  }

  const collectMealItems = ({ strict = false } = {}) => {
    const rows = getMealRows()
    const items = []
    let valid = rows.length > 0

    rows.forEach(row => {
      const select = row.querySelector('select')
      const qtyInput = row.querySelector('input')
      const foodId = select.value
      const quantity = Number(qtyInput.value || 0)
      const snapshot = getRowSnapshot(row)
      const food = cachedFoods.find(f => f.id === foodId) || snapshot

      if(!foodId || Number.isNaN(quantity) || quantity <= 0 || !food){
        if(strict){ valid = false }
        return
      }

      const kcalPerUnit = Number(food.kcalPerUnit ?? food.kcal ?? 0)
      const proteinPerUnit = Number(food.proteinPerUnit ?? food.protein ?? 0)
      const carbsPerUnit = Number(food.carbsPerUnit ?? food.carbs ?? 0)
      const fatPerUnit = Number(food.fatPerUnit ?? food.fat ?? 0)

      const itemKcal = storage.roundKcal(quantity * kcalPerUnit)
      const itemProtein = roundOne(quantity * proteinPerUnit)
      const itemCarbs = roundOne(quantity * carbsPerUnit)
      const itemFat = roundOne(quantity * fatPerUnit)
      items.push({
        foodId,
        quantity,
        foodName: food.foodName || food.name || 'Food',
        unit: food.unit || '',
        kcalPerUnit,
        proteinPerUnit,
        carbsPerUnit,
        fatPerUnit,
        itemKcal,
        itemProtein,
        itemCarbs,
        itemFat
      })
    })

    if(rows.length === 0){ valid = false }
    return { items, valid }
  }

  const recomputeMealTotal = () => {
    const { items } = collectMealItems({ strict: false })
    const totals = items.reduce((acc, item) => {
      acc.kcal += item.itemKcal || 0
      acc.protein += item.itemProtein || 0
      acc.carbs += item.itemCarbs || 0
      acc.fat += item.itemFat || 0
      return acc
    }, { kcal: 0, protein: 0, carbs: 0, fat: 0 })
    mealTotalEl.textContent = storage.roundKcal(totals.kcal)
    mealTotalProteinEl.textContent = roundOne(totals.protein)
    mealTotalCarbsEl.textContent = roundOne(totals.carbs)
    mealTotalFatEl.textContent = roundOne(totals.fat)
    return totals
  }

  const renderDailySummary = (summary) => {
    if(!summary){
      dailySummaryEl.textContent = 'No summary available.'
      return
    }
  const { totalKcal, goalKcal, difference, status, date } = summary
  const protein = roundOne(summary.totalProtein)
  const carbs = roundOne(summary.totalCarbs)
  const fat = roundOne(summary.totalFat)
    const hasGoal = typeof goalKcal === 'number'
    const statusClass = `summary-status ${status}`
    let statusLabel = 'No goal set'
    if(status === 'over'){ statusLabel = `Over goal by ${difference} kcal` }
    else if(status === 'under'){ statusLabel = `Under goal by ${Math.abs(difference)} kcal` }
    else if(status === 'on'){ statusLabel = 'On target' }

    const progressPercent = hasGoal && goalKcal > 0
      ? Math.min(200, Math.round((totalKcal / goalKcal) * 100))
      : 0

    dailySummaryEl.innerHTML = `
      <div class="metrics">
        <div class="metric" aria-label="Total intake for ${date}">
          ${totalKcal} kcal
          <span>Total intake</span>
        </div>
        <div class="metric" aria-label="Daily goal">
          ${hasGoal ? `${goalKcal} kcal` : '—'}
          <span>Goal</span>
        </div>
        <div class="metric" aria-label="Difference from goal">
          ${hasGoal ? `${difference > 0 ? '+' : ''}${difference} kcal` : '—'}
          <span>Difference</span>
        </div>
      </div>
      ${hasGoal ? `
        <div class="progress-wrapper" aria-hidden="${goalKcal === 0}">
          <div class="progress-track">
            <div class="progress-bar ${status === 'over' ? 'over' : ''}" style="width:${Math.min(progressPercent, 100)}%"></div>
          </div>
          <small>${progressPercent}% of goal</small>
        </div>
      ` : ''}
      <div class="macro-breakdown" aria-label="Daily macro totals">
        <div class="macro">${protein} g<span>Protein</span></div>
        <div class="macro">${carbs} g<span>Carbs</span></div>
        <div class="macro">${fat} g<span>Fat</span></div>
      </div>
      <div class="${statusClass}">${statusLabel}</div>
      ${totalKcal === 0 ? '<small>No meals logged for today yet.</small>' : ''}
    `
  }

  const renderWeeklySummary = (summaries, endDateISO) => {
    if(!Array.isArray(summaries) || summaries.length === 0){
      weeklySummaryEl.textContent = 'No data yet.'
      return
    }
    const endDate = new Date(endDateISO || summaries[summaries.length - 1]?.date)
    const rangeTitle = Number.isNaN(endDate.getTime()) ? '' : `Week ending ${dateFormatter.format(endDate)}`
    const aggregate = summaries.reduce((acc, summary) => {
      acc.kcal += summary.totalKcal || 0
      acc.protein += summary.totalProtein || 0
      acc.carbs += summary.totalCarbs || 0
      acc.fat += summary.totalFat || 0
      return acc
    }, { kcal: 0, protein: 0, carbs: 0, fat: 0 })
    const maxKcal = Math.max(1, ...summaries.map(summary => summary.totalKcal || 0))

    const rows = summaries.map(summary => {
      const dateLabel = dateFormatter.format(new Date(summary.date))
      const statusClass = summary.status
      const diffLabel = summary.goalKcal == null ? '—' : `${summary.difference > 0 ? '+' : ''}${summary.difference} kcal`
      return `
        <tr>
          <td>${dateLabel}</td>
          <td>${summary.totalKcal} kcal</td>
          <td>${summary.goalKcal ?? '—'}</td>
          <td class="summary-status ${statusClass}">${diffLabel}</td>
        </tr>
      `
    }).join('')
    const chartBars = summaries.map(summary => {
      const dateObj = new Date(summary.date)
      const weekdayLabel = Number.isNaN(dateObj.getTime()) ? summary.date : weekdayFormatter.format(dateObj)
      const displayKcal = summary.totalKcal ?? 0
      const rawPercent = maxKcal === 0 ? 0 : Math.round((displayKcal / maxKcal) * 100)
      const heightPercent = displayKcal > 0 ? Math.min(100, Math.max(8, rawPercent)) : 2
      const shortLabel = typeof weekdayLabel === 'string' ? weekdayLabel.slice(0, 2).toUpperCase() : ''
      return `
        <div class="chart-bar" role="listitem" tabindex="0" aria-label="${weekdayLabel} total ${displayKcal} kcal" title="${weekdayLabel}: ${displayKcal} kcal">
          <div class="chart-bar-track">
            <div class="chart-bar-fill" style="height:${heightPercent}%"></div>
          </div>
          <span class="chart-bar-value" aria-hidden="true">${displayKcal}</span>
          <span class="chart-bar-label" aria-hidden="true">${shortLabel}</span>
        </div>
      `
    }).join('')

    weeklySummaryEl.innerHTML = `
      ${rangeTitle ? `<p class="summary-range">${rangeTitle}</p>` : ''}
      <table aria-label="Weekly calorie summary">
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Total</th>
            <th scope="col">Goal</th>
            <th scope="col">Δ</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
      <div class="weekly-chart-wrapper">
        <p class="weekly-chart-title">Daily calories</p>
        <div class="weekly-chart" role="list" aria-label="Daily calorie totals for the selected week">
          ${chartBars}
        </div>
      </div>
      <div class="macro-breakdown" aria-label="Weekly macro totals">
        <div class="macro">${roundOne(aggregate.protein)} g<span>Protein (7d)</span></div>
        <div class="macro">${roundOne(aggregate.carbs)} g<span>Carbs (7d)</span></div>
        <div class="macro">${roundOne(aggregate.fat)} g<span>Fat (7d)</span></div>
      </div>
    `

    renderMacroBreakdown(summaries)
  }

  const getSelectedWeekEnd = () => {
    const value = weeklyEndDateInput.value
    if(value){ return value }
    const today = getTodayISO()
    weeklyEndDateInput.value = today
    return today
  }

  const updateAllSummaries = () => {
    const todayISO = getTodayISO()
    renderDailySummary(storage.getDailySummary(todayISO))
    const weekEnd = getSelectedWeekEnd()
    renderWeeklySummary(storage.getWeeklySummary({ endDateISO: weekEnd, days: 7 }), weekEnd)
  }

  const refreshMealList = () => {
    renderMealList(mealList, { onEdit: handleMealEdit, onDelete: handleMealDelete })
    updateAllSummaries()
  }

  const handleFoodDelete = (food) => {
    if(!confirm(`Delete ${food.name}?`)){
      return
    }
    const snapshot = storage.getFoodById(food.id) || food
    storage.deleteFood(food.id)
    refreshFoodList()
    if(foodIdInput.value === food.id){
      resetFoodForm()
    }
    cancelFoodUndo()
    const timer = setTimeout(() => {
      if(pendingFoodUndo?.snapshot.id === snapshot.id){
        pendingFoodUndo = null
        setFoodFeedback(`${snapshot.name} removed.`, 'info')
      }
    }, FOOD_UNDO_WINDOW_MS)
    pendingFoodUndo = { snapshot, timer }
    setFoodFeedback('', 'info')
    const message = document.createElement('span')
    message.textContent = `Deleted ${snapshot.name}. `
    const undoBtn = document.createElement('button')
    undoBtn.type = 'button'
    undoBtn.className = 'link-button'
    undoBtn.textContent = 'Undo'
    undoBtn.addEventListener('click', () => {
      if(!pendingFoodUndo){ return }
      clearTimeout(pendingFoodUndo.timer)
      pendingFoodUndo = null
      restoreFoodSnapshot(snapshot)
    })
    foodFeedback.append(message, undoBtn)
  }

  const handleFoodEdit = (food) => {
    foodIdInput.value = food.id
    foodNameInput.value = food.name
    foodUnitInput.value = food.unit || ''
    foodKcalInput.value = food.kcal
    foodProteinInput.value = food.protein ?? ''
    foodCarbsInput.value = food.carbs ?? ''
    foodFatInput.value = food.fat ?? ''
    setFoodFormMode(true)
    setFoodFeedback(`Editing ${food.name}. Update details and save.`, 'info')
    foodNameInput.focus()
  }

  const handleMealEdit = (meal) => {
    mealIdInput.value = meal.id
    mealDateInput.value = meal.date || ''
    mealTimeInput.value = meal.time || ''
    mealItemsContainer.innerHTML = ''

    if(Array.isArray(meal.items) && meal.items.length > 0){
      meal.items.forEach(item => createMealRow(item))
    } else {
      ensureBaseMealRow()
    }

    setMealFormMode(true)
    setMealFeedback(`Editing meal from ${meal.date || 'unknown date'}.`, 'info')
    recomputeMealTotal()
  }

  const handleMealDelete = (meal) => {
    const snapshot = storage.getMealById(meal.id) || meal
    const label = formatMealLabel(snapshot)
    if(!confirm(`Delete meal logged on ${label || 'selected time'}?`)){
      return
    }
    storage.deleteMeal(meal.id)
    if(mealIdInput.value === meal.id){
      resetMealForm()
    }
    refreshMealList()
    cancelMealUndo()
    const timer = setTimeout(() => {
      if(pendingMealUndo?.snapshot.id === snapshot.id){
        pendingMealUndo = null
        setMealFeedback(`Meal on ${label} removed.`, 'info')
      }
    }, MEAL_UNDO_WINDOW_MS)
    pendingMealUndo = { snapshot, timer }
    setMealFeedback('', 'info')
    const message = document.createElement('span')
    message.textContent = `Deleted meal on ${label}. `
    const undoBtn = document.createElement('button')
    undoBtn.type = 'button'
    undoBtn.className = 'link-button'
    undoBtn.textContent = 'Undo'
    undoBtn.addEventListener('click', () => {
      if(!pendingMealUndo || pendingMealUndo.snapshot.id !== snapshot.id){ return }
      clearTimeout(pendingMealUndo.timer)
      restoreMealSnapshot(snapshot)
    })
    mealFeedback.append(message, undoBtn)
  }

  const resetMealForm = () => {
    mealForm.reset()
    mealIdInput.value = ''
    mealItemsContainer.innerHTML = ''
    setMealFormMode(false)
    ensureBaseMealRow()
    setDefaultMealDateTime()
    recomputeMealTotal()
  }

  const updateMealFormAvailability = () => {
    const hasFoods = cachedFoods.length > 0
    mealAddItemBtn.disabled = !hasFoods
    if(!hasFoods){
      mealItemsContainer.innerHTML = ''
      mealTotalEl.textContent = '0'
      mealTotalProteinEl.textContent = '0'
      mealTotalCarbsEl.textContent = '0'
      mealTotalFatEl.textContent = '0'
      setMealFeedback('Add at least one food item to log meals.', 'info')
    } else {
      if(getMealRows().length === 0){
        createMealRow()
      }
    }

    getMealRows().forEach(row => {
      const select = row.querySelector('select')
      if(!hasFoods && !select.value){
        select.disabled = true
      }
    })
  }

  const refreshFoodList = () => {
    renderFoodList(foodList, { onEdit: handleFoodEdit, onDelete: handleFoodDelete })
    cachedFoods = storage.loadFoods()
    refreshMealFoodOptions()
    updateMealFormAvailability()
    recomputeMealTotal()
    updateAllSummaries()
  }

  foodCancelBtn.addEventListener('click', () => {
    cancelFoodUndo()
    resetFoodForm()
    setFoodFeedback('Edit cancelled. Ready to add a new food.', 'info')
  })

  foodForm.addEventListener('submit', (event) => {
    event.preventDefault()
    cancelFoodUndo()
    const name = foodNameInput.value.trim()
    const unit = foodUnitInput.value.trim()
    const kcal = Number(foodKcalInput.value || 0)
    const protein = Number(foodProteinInput.value || 0)
    const carbs = Number(foodCarbsInput.value || 0)
    const fat = Number(foodFatInput.value || 0)
    if(!name || Number.isNaN(kcal) || kcal < 0){
      setFoodFeedback('Please provide a name and non-negative kcal value.', 'error')
      return
    }
    if([protein, carbs, fat].some(value => Number.isNaN(value) || value < 0)){
      setFoodFeedback('Protein, carbs, and fat must be zero or positive numbers.', 'error')
      return
    }
    const payload = {
      id: foodIdInput.value || undefined,
      name,
      unit,
      kcal: storage.roundKcal(kcal),
      protein: roundOne(protein),
      carbs: roundOne(carbs),
      fat: roundOne(fat)
    }
    try {
      const saved = storage.addOrUpdateFood(payload)
      refreshFoodList()
      resetFoodForm()
      const action = payload.id ? 'Updated' : 'Added'
      setFoodFeedback(`${action} ${saved.name}.`, 'success')
    } catch (error) {
      if(error?.message === 'food-duplicate-name'){
        setFoodFeedback('Food name already exists. Edit the existing entry instead.', 'error')
      } else if(error?.message === 'food-not-found'){
        setFoodFeedback('Could not locate the selected food. Please try again.', 'error')
        resetFoodForm()
      } else {
        setFoodFeedback('Unexpected error saving food. See console for details.', 'error')
        console.error(error)
      }
    }
  })

  mealAddItemBtn.addEventListener('click', () => {
    if(cachedFoods.length === 0){
      setMealFeedback('Add foods before logging meals.', 'error')
      return
    }
    createMealRow()
    setMealFeedback('Added a new meal item row.', 'info')
  })

  mealCancelBtn.addEventListener('click', () => {
    resetMealForm()
    setMealFeedback('Meal edit cancelled.', 'info')
  })

  mealForm.addEventListener('submit', (event) => {
    event.preventDefault()
    if(!cachedFoods.length){
      setMealFeedback('Add foods before logging meals.', 'error')
      return
    }
    const date = mealDateInput.value
    const time = mealTimeInput.value
    const { items, valid } = collectMealItems({ strict: true })
    if(!date || !time){
      setMealFeedback('Please choose a date and time for the meal.', 'error')
      return
    }
    if(!valid || items.length === 0){
      setMealFeedback('Add at least one food with a quantity greater than zero.', 'error')
      return
    }
    const totals = items.reduce((acc, item) => {
      acc.kcal += item.itemKcal
      acc.protein += item.itemProtein
      acc.carbs += item.itemCarbs
      acc.fat += item.itemFat
      return acc
    }, { kcal: 0, protein: 0, carbs: 0, fat: 0 })
    const totalKcal = storage.roundKcal(totals.kcal)
    const payload = {
      id: mealIdInput.value || undefined,
      date,
      time,
      items,
      totalKcal,
      totalProtein: roundOne(totals.protein),
      totalCarbs: roundOne(totals.carbs),
      totalFat: roundOne(totals.fat)
    }
    try {
      storage.upsertMeal(payload)
      refreshMealList()
      resetMealForm()
      setMealFeedback(`${payload.id ? 'Updated' : 'Logged'} meal for ${date}.`, 'success')
    } catch (error) {
      if(error?.message === 'meal-not-found'){
        setMealFeedback('Meal no longer exists. It may have been deleted in another tab.', 'error')
        resetMealForm()
      } else {
        console.error(error)
        setMealFeedback('Unexpected error saving meal. See console for details.', 'error')
      }
    }
  })

  goalForm.addEventListener('submit', (event) => {
    event.preventDefault()
    const kcal = Number(document.getElementById('goal-kcal').value || 0)
    if(Number.isNaN(kcal) || kcal < 0){
      goalStatus.textContent = 'Enter a non-negative goal value.'
      return
    }
    const today = new Date().toISOString().slice(0, 10)
    storage.setGoal(today, storage.roundKcal(kcal))
    goalStatus.textContent = `Saved goal ${kcal} kcal for ${today}`
    goalForm.reset()
    updateAllSummaries()
  })

  weeklyForm.addEventListener('submit', (event) => {
    event.preventDefault()
    const endDate = weeklyEndDateInput.value
    if(!endDate){
      setMealFeedback('Pick a week end date to view summary.', 'error')
      return
    }
    updateAllSummaries()
  })

  weeklyExportBtn.addEventListener('click', () => {
    const endDateISO = getSelectedWeekEnd()
    const summaries = storage.getWeeklySummary({ endDateISO, days: 7 })
    if(!summaries.length){
      setMealFeedback('No data to export yet.', 'info')
      return
    }
    const header = ['date', 'total_kcal', 'goal_kcal', 'difference', 'status', 'protein_g', 'carbs_g', 'fat_g']
    const rows = summaries.map(({ date, totalKcal, goalKcal, difference, status, totalProtein, totalCarbs, totalFat }) => [
      date,
      totalKcal,
      goalKcal ?? '',
      typeof difference === 'number' ? difference : '',
      status,
      totalProtein ?? '',
      totalCarbs ?? '',
      totalFat ?? ''
    ])
    const csvContent = [header, ...rows]
      .map(cells => cells.map(value => {
        const str = String(value ?? '')
        return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
      }).join(','))
      .join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const endLabel = endDateISO
    const link = document.createElement('a')
    link.href = url
    link.download = `weekly-summary-${endLabel}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    setMealFeedback(`Exported weekly summary ending ${endLabel}.`, 'info')
  })

  macroBreakdownToggle?.addEventListener('click', () => {
    if(macroModal){ toggleMacroModal(true) }
  })

  macroModalClose?.addEventListener('click', () => {
    toggleMacroModal(false)
  })

  macroModal?.addEventListener('keydown', (event) => {
    if(event.key === 'Escape'){ toggleMacroModal(false) }
  })

  macroModal?.addEventListener('click', (event) => {
    if(event.target === macroModal){ toggleMacroModal(false) }
  })

  // Initial bootstrap
  setFoodFormMode(false)
  setMealFormMode(false)
  setDefaultMealDateTime()
  refreshFoodList()
  refreshMealList()
  if(cachedFoods.length === 0){
    setFoodFeedback('Add a food item to begin.', 'info')
    setMealFeedback('Add foods before logging meals.', 'info')
  } else {
    setFoodFeedback('Add a food item to begin.', 'info')
    setMealFeedback('Start logging meals by choosing a food item.', 'info')
  }
  getSelectedWeekEnd()
  updateAllSummaries()
})
