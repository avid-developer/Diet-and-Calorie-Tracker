// storage.js — simple localStorage wrapper for Diet & Calorie Tracker
// TODO: migrate to IndexedDB for larger datasets if needed
const KEY_FOODS = 'dct_foods_v1'
const KEY_MEALS = 'dct_meals_v1'
const KEY_GOALS = 'dct_goals_v1'

function generateId(){
  if(typeof crypto !== 'undefined' && crypto.randomUUID){
    return crypto.randomUUID()
  }
  return `id_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`
}

function _load(key){
  const raw = localStorage.getItem(key)
  return raw ? JSON.parse(raw) : []
}
function _save(key, value){
  localStorage.setItem(key, JSON.stringify(value))
}

const toNumber = (value, fallback = 0) => {
  const num = Number(value)
  return Number.isFinite(num) && !Number.isNaN(num) ? num : fallback
}

const roundMacro = (value) => Math.round(toNumber(value, 0) * 10) / 10

function normalizeFoodMacros(food){
  return {
    ...food,
    protein: toNumber(food.protein, 0),
    carbs: toNumber(food.carbs, 0),
    fat: toNumber(food.fat, 0)
  }
}

function normalizeFoods(list){
  let changed = false
  const normalized = list.map(food => {
    let updated = food
    if(!food.id){
      changed = true
      updated = {...updated, id: generateId()}
    }
    updated = normalizeFoodMacros(updated)
    return updated
  })
  if(changed){ _save(KEY_FOODS, normalized) }
  return normalized
}

export function loadFoods(){
  return normalizeFoods(_load(KEY_FOODS)).sort((a,b)=>a.name.localeCompare(b.name))
}
export function saveFoods(list){
  _save(KEY_FOODS, list)
}
export function getFoodById(id){
  return loadFoods().find(f => f.id === id) || null
}
export function addOrUpdateFood(item){
  const list = loadFoods()
  const payload = {
    ...item,
    protein: toNumber(item.protein, 0),
    carbs: toNumber(item.carbs, 0),
    fat: toNumber(item.fat, 0)
  }
  if(item.id){
    const idx = list.findIndex(f => f.id === item.id)
    if(idx === -1){ throw new Error('food-not-found') }
    const duplicate = list.some(f => f.id !== item.id && f.name.toLowerCase() === item.name.toLowerCase())
    if(duplicate){ throw new Error('food-duplicate-name') }
    const updated = normalizeFoodMacros({...list[idx], ...payload})
    list[idx] = updated
    list.sort((a, b) => a.name.localeCompare(b.name))
    saveFoods(list)
    return updated
  }
  const duplicate = list.some(f => f.name.toLowerCase() === item.name.toLowerCase())
  if(duplicate){ throw new Error('food-duplicate-name') }
  const created = normalizeFoodMacros({...payload, id: generateId()})
  list.push(created)
  list.sort((a, b) => a.name.localeCompare(b.name))
  saveFoods(list)
  return created
}
export function deleteFood(id){
  const list = loadFoods().filter(f => f.id !== id)
  saveFoods(list)
}
export function clearFoods(){
  localStorage.removeItem(KEY_FOODS)
}

function normalizeMealItem(item){
  return {
    ...item,
    itemKcal: toNumber(item.itemKcal, toNumber(item.quantity, 0) * toNumber(item.kcalPerUnit, 0)),
    proteinPerUnit: toNumber(item.proteinPerUnit, 0),
    carbsPerUnit: toNumber(item.carbsPerUnit, 0),
    fatPerUnit: toNumber(item.fatPerUnit, 0),
    itemProtein: toNumber(item.itemProtein, toNumber(item.quantity, 0) * toNumber(item.proteinPerUnit, 0)),
    itemCarbs: toNumber(item.itemCarbs, toNumber(item.quantity, 0) * toNumber(item.carbsPerUnit, 0)),
    itemFat: toNumber(item.itemFat, toNumber(item.quantity, 0) * toNumber(item.fatPerUnit, 0))
  }
}

function normalizeMeals(list){
  let changed = false
  const normalized = list.map(meal => {
    let updated = meal
    if(!meal.id){
      changed = true
      updated = {...updated, id: generateId()}
    }
    const items = Array.isArray(updated.items) ? updated.items.map(normalizeMealItem) : []
    const totals = items.reduce((acc, item) => {
      acc.kcal += toNumber(item.itemKcal, 0)
      acc.protein += toNumber(item.itemProtein, 0)
      acc.carbs += toNumber(item.itemCarbs, 0)
      acc.fat += toNumber(item.itemFat, 0)
      return acc
    }, { kcal: 0, protein: 0, carbs: 0, fat: 0 })
    updated = {
      ...updated,
      items,
      totalKcal: toNumber(updated.totalKcal, totals.kcal),
      totalProtein: toNumber(updated.totalProtein, totals.protein),
      totalCarbs: toNumber(updated.totalCarbs, totals.carbs),
      totalFat: toNumber(updated.totalFat, totals.fat)
    }
    return updated
  })
  if(changed){ _save(KEY_MEALS, normalized) }
  return normalized
}

function sortMeals(list){
  return [...list].sort((a, b) => {
    const aKey = `${a.date || ''}T${a.time || ''}`
    const bKey = `${b.date || ''}T${b.time || ''}`
    if(aKey === bKey){ return 0 }
    return aKey > bKey ? -1 : 1
  })
}

export function loadMeals(){
  return sortMeals(normalizeMeals(_load(KEY_MEALS)))
}
export function saveMeals(list){ _save(KEY_MEALS, list) }
export function getMealById(id){
  return loadMeals().find(m => m.id === id) || null
}
export function upsertMeal(entry){
  const list = loadMeals()
  const normalizedEntry = {
    ...entry,
    totalKcal: entry.totalKcal === undefined ? undefined : toNumber(entry.totalKcal, 0),
    totalProtein: entry.totalProtein === undefined ? undefined : toNumber(entry.totalProtein, 0),
    totalCarbs: entry.totalCarbs === undefined ? undefined : toNumber(entry.totalCarbs, 0),
    totalFat: entry.totalFat === undefined ? undefined : toNumber(entry.totalFat, 0),
    items: Array.isArray(entry.items) ? entry.items.map(normalizeMealItem) : []
  }
  if(entry.id){
    const idx = list.findIndex(m => m.id === entry.id)
    if(idx === -1){ throw new Error('meal-not-found') }
    const updated = normalizeMeals([{...list[idx], ...normalizedEntry}])[0]
    list[idx] = updated
    const sorted = sortMeals(list)
    saveMeals(sorted)
    return updated
  }
  const created = normalizeMeals([{...normalizedEntry, id: generateId()}])[0]
  const updated = [created, ...list]
  const sorted = sortMeals(updated)
  saveMeals(sorted)
  return created
}
export function deleteMeal(id){
  const filtered = loadMeals().filter(m => m.id !== id)
  saveMeals(filtered)
}
export function loadMealsByDate(dateISO){
  return loadMeals().filter(m => m.date === dateISO)
}
export function clearMeals(){
  localStorage.removeItem(KEY_MEALS)
}

export function setGoal(dateISO, kcal){
  const goals = _load(KEY_GOALS)
  const idx = goals.findIndex(g => g.date===dateISO)
  if(idx>=0) goals[idx].target = kcal
  else goals.push({date:dateISO, target:kcal})
  _save(KEY_GOALS, goals)
}
export function getGoal(dateISO){
  const goals = _load(KEY_GOALS)
  const g = goals.find(x=>x.date===dateISO)
  return g ? g.target : null
}
export function getGoals(){
  return _load(KEY_GOALS)
}

export function clearGoals(){
  localStorage.removeItem(KEY_GOALS)
}

export function getDailyTotals(dateISO){
  return loadMealsByDate(dateISO).reduce((acc, meal) => {
    acc.kcal += toNumber(meal.totalKcal, 0)
    acc.protein += toNumber(meal.totalProtein, 0)
    acc.carbs += toNumber(meal.totalCarbs, 0)
    acc.fat += toNumber(meal.totalFat, 0)
    return acc
  }, { kcal: 0, protein: 0, carbs: 0, fat: 0 })
}

export function getDailySummary(dateISO){
  const totals = getDailyTotals(dateISO)
  const totalKcal = roundKcal(totals.kcal)
  const goalKcal = getGoal(dateISO)
  const difference = typeof goalKcal === 'number' ? totalKcal - goalKcal : null
  const status = typeof goalKcal === 'number'
    ? (difference > 0 ? 'over' : difference < 0 ? 'under' : 'on')
    : 'no-goal'
  return {
    date: dateISO,
    totalKcal,
    goalKcal: goalKcal ?? null,
    difference,
    status,
    totalProtein: roundMacro(totals.protein),
    totalCarbs: roundMacro(totals.carbs),
    totalFat: roundMacro(totals.fat)
  }
}

export function getWeeklySummary({ endDateISO, days = 7 } = {}){
  const end = endDateISO ? new Date(endDateISO) : new Date()
  if(Number.isNaN(end.getTime())){
    throw new Error('invalid-end-date')
  }
  const summaries = []
  for(let i = days - 1; i >= 0; i -= 1){
    const date = new Date(end)
    date.setDate(end.getDate() - i)
    const iso = date.toISOString().slice(0, 10)
    summaries.push(getDailySummary(iso))
  }
  return summaries
}

// Utility
export function roundKcal(n){ return Math.round(n) }
export { roundMacro }
