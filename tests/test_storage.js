// Minimal Node-based smoke tests for storage layer

const memoryStore = new Map()
global.localStorage = {
	getItem(key){ return memoryStore.has(key) ? memoryStore.get(key) : null },
	setItem(key, value){ memoryStore.set(key, String(value)) },
	removeItem(key){ memoryStore.delete(key) },
	clear(){ memoryStore.clear() }
}

const storage = await import('../src/js/storage.js')

const {
	addOrUpdateFood,
	loadFoods,
	deleteFood,
	clearFoods,
	upsertMeal,
	loadMeals,
	loadMealsByDate,
	deleteMeal,
	clearMeals,
	roundKcal,
	setGoal,
	clearGoals,
	getDailySummary,
	getWeeklySummary
} = storage

function assert(condition, message){
	if(!condition){
		throw new Error(message)
	}
}

const roundOne = (value) => Math.round((Number(value) || 0) * 10) / 10

function buildItem(food, quantity){
	return {
		foodId: food.id,
		quantity,
		foodName: food.name,
		unit: food.unit,
		kcalPerUnit: food.kcal,
		proteinPerUnit: food.protein ?? 0,
		carbsPerUnit: food.carbs ?? 0,
		fatPerUnit: food.fat ?? 0,
		itemKcal: roundKcal(quantity * food.kcal),
		itemProtein: roundOne(quantity * (food.protein ?? 0)),
		itemCarbs: roundOne(quantity * (food.carbs ?? 0)),
		itemFat: roundOne(quantity * (food.fat ?? 0))
	}
}

function testFoodLifecycle(){
	clearFoods()
	const apple = addOrUpdateFood({ name: 'Apple', unit: '1 medium', kcal: 95, protein: 0.5, carbs: 25, fat: 0.3 })
	assert(apple.id, 'add assigns an id')

	const foods = loadFoods()
	assert(foods.length === 1, 'load returns added item')
	assert(foods[0].name === 'Apple', 'item name persisted')
	assert(foods[0].protein === 0.5, 'protein persisted')

	const updated = addOrUpdateFood({ id: apple.id, name: 'Apple', unit: '1 medium', kcal: 90, protein: 0.4, carbs: 24, fat: 0.2 })
	assert(updated.kcal === 90, 'update adjusts kcal')
	const reloaded = loadFoods()[0]
	assert(reloaded.kcal === 90, 'load reflects kcal update')
	assert(reloaded.protein === 0.4 && reloaded.carbs === 24 && reloaded.fat === 0.2, 'load reflects macro update')

	let duplicateError = false
	try {
		addOrUpdateFood({ name: 'Apple', unit: 'duplicate', kcal: 10 })
	} catch (err) {
		duplicateError = err?.message === 'food-duplicate-name'
	}
	assert(duplicateError, 'duplicate names rejected')

	const banana = addOrUpdateFood({ name: 'Banana', unit: '100 g', kcal: 89, protein: 1.1, carbs: 23, fat: 0.3 })
	const sorted = loadFoods()
	assert(sorted[0].name === 'Apple' && sorted[1].name === 'Banana', 'foods sorted alphabetically')

	deleteFood(apple.id)
	const afterDelete = loadFoods()
	assert(afterDelete.length === 1 && afterDelete[0].id === banana.id, 'delete removes target food')

	clearFoods()
	assert(loadFoods().length === 0, 'clear removes all foods')
}

function testMealLifecycle(){
	clearFoods()
	clearMeals()
	clearGoals()

	const oats = addOrUpdateFood({ name: 'Oats', unit: '50 g', kcal: 190, protein: 6.7, carbs: 32, fat: 3.3 })
	const milk = addOrUpdateFood({ name: 'Milk', unit: '200 ml', kcal: 130, protein: 6.6, carbs: 10, fat: 4.6 })

	const breakfastDate = '2025-10-25'
	const breakfastTime = '08:00'
	const breakfastItems = [buildItem(oats, 1), buildItem(milk, 1)]
	const breakfastTotal = breakfastItems.reduce((sum, item) => sum + item.itemKcal, 0)

	const breakfast = upsertMeal({
		date: breakfastDate,
		time: breakfastTime,
		items: breakfastItems,
		totalKcal: breakfastTotal
	})
	assert(breakfast.id, 'meal insert assigns id')

	const mealsAfterCreate = loadMeals()
	assert(mealsAfterCreate.length === 1, 'meal persisted')
	assert(mealsAfterCreate[0].totalKcal === breakfastTotal, 'total stored')

	const lunchItems = [buildItem(oats, 0.5), buildItem(milk, 1.5)]
	const lunchTotal = lunchItems.reduce((sum, item) => sum + item.itemKcal, 0)
	const lunch = upsertMeal({
		date: '2025-10-25',
		time: '13:15',
		items: lunchItems,
		totalKcal: lunchTotal
	})

	const sortedMeals = loadMeals()
	assert(sortedMeals[0].id === lunch.id, 'meals sorted by newest first')

	const updatedBreakfastTotal = breakfastTotal + 50
	const updatedBreakfast = upsertMeal({
		id: breakfast.id,
		date: breakfastDate,
		time: '08:30',
		items: breakfastItems,
		totalKcal: updatedBreakfastTotal
	})
	assert(updatedBreakfast.totalKcal === updatedBreakfastTotal, 'meal update persists changes')
	const expectedProtein = roundOne(breakfastItems.reduce((sum, item) => sum + item.itemProtein, 0))
	const expectedCarbs = roundOne(breakfastItems.reduce((sum, item) => sum + item.itemCarbs, 0))
	const expectedFat = roundOne(breakfastItems.reduce((sum, item) => sum + item.itemFat, 0))
	assert(roundOne(updatedBreakfast.totalProtein) === expectedProtein, 'meal tracks protein totals')
	assert(roundOne(updatedBreakfast.totalCarbs) === expectedCarbs, 'meal tracks carb totals')
	assert(roundOne(updatedBreakfast.totalFat) === expectedFat, 'meal tracks fat totals')

	const mealsForDate = loadMealsByDate('2025-10-25')
	assert(mealsForDate.length === 2, 'loadMealsByDate returns meals for date')

	deleteMeal(lunch.id)
	const afterDelete = loadMeals()
	assert(afterDelete.length === 1 && afterDelete[0].id === updatedBreakfast.id, 'deleteMeal removes entry')

	setGoal('2025-10-25', 350)
	const daily = getDailySummary('2025-10-25')
	assert(daily.totalKcal === updatedBreakfastTotal, 'daily summary total matches meals')
	assert(daily.goalKcal === 350, 'daily summary returns goal')
	assert(daily.status === 'over', 'daily summary status over goal')
	assert(daily.totalProtein === expectedProtein, 'daily summary exposes protein total')
	assert(daily.totalCarbs === expectedCarbs, 'daily summary exposes carb total')
	assert(daily.totalFat === expectedFat, 'daily summary exposes fat total')

	const weekly = getWeeklySummary({ endDateISO: '2025-10-25', days: 7 })
	assert(Array.isArray(weekly) && weekly.length === 7, 'weekly summary returns requested days')
	const lastDay = weekly[weekly.length - 1]
	assert(lastDay.date === '2025-10-25', 'weekly summary includes end date')
	assert(lastDay.totalKcal === updatedBreakfastTotal, 'weekly summary reflects totals')
	assert(lastDay.totalProtein === expectedProtein, 'weekly summary carries protein total')
	assert(lastDay.totalCarbs === expectedCarbs, 'weekly summary carries carb total')
	assert(lastDay.totalFat === expectedFat, 'weekly summary carries fat total')

	clearMeals()
	clearFoods()
	clearGoals()
	assert(loadMeals().length === 0, 'clearMeals empties storage')
}

testFoodLifecycle()
testMealLifecycle()

console.log('✓ storage.js food & meal lifecycle tests passed')
