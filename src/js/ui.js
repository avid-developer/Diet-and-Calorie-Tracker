// ui.js — DOM rendering helpers
import * as storage from './storage.js'

export function renderFoodList(container, { onEdit, onDelete } = {}){
  const foods = storage.loadFoods()
  container.innerHTML = ''
  if(foods.length === 0){
    container.innerHTML = '<small>No foods yet</small>'
    return
  }
  foods.forEach(food => {
    const el = document.createElement('div')
    el.className = 'food-item'

    const details = document.createElement('div')
    const unit = food.unit ? ` <small>(${escapeHtml(food.unit)})</small>` : ''
    const macros = [
      food.protein ? `${food.protein}g P` : null,
      food.carbs ? `${food.carbs}g C` : null,
      food.fat ? `${food.fat}g F` : null
    ].filter(Boolean).join(' · ')
    details.innerHTML = `
      <strong>${escapeHtml(food.name)}</strong>${unit}<br/>
      <small>${food.kcal} kcal/unit${macros ? ` · ${escapeHtml(macros)}` : ''}</small>
    `
    el.appendChild(details)

  const actions = document.createElement('div')
  actions.style.display = 'flex'
  actions.style.gap = '0.25rem'

    if(typeof onEdit === 'function'){
      const editBtn = document.createElement('button')
      editBtn.type = 'button'
      editBtn.textContent = 'Edit'
      editBtn.className = 'secondary'
      editBtn.addEventListener('click', () => onEdit(food))
      actions.appendChild(editBtn)
    }

    const deleteBtn = document.createElement('button')
    deleteBtn.type = 'button'
    deleteBtn.textContent = 'Delete'
    deleteBtn.className = 'danger'
    deleteBtn.addEventListener('click', () => {
      if(typeof onDelete === 'function'){
        onDelete(food)
        return
      }
      if(confirm(`Delete ${food.name}?`)){
        storage.deleteFood(food.id)
        renderFoodList(container, { onEdit, onDelete })
      }
    })
    actions.appendChild(deleteBtn)

    el.appendChild(actions)
    container.appendChild(el)
  })
}

function escapeHtml(str){
  return String(str).replace(/[&<>\"]/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;'
  })[char])
}

export function renderMealList(container, { onEdit, onDelete } = {}){
  const meals = storage.loadMeals()
  container.innerHTML = ''
  if(meals.length === 0){
    container.innerHTML = '<small>No meals logged yet</small>'
    return
  }

  meals.forEach(meal => {
    const card = document.createElement('article')
    card.className = 'meal-entry'

    const header = document.createElement('header')
    const title = document.createElement('div')
    const dateLabel = meal.date || 'Unknown date'
    const timeLabel = meal.time || '--:--'
    title.innerHTML = `<strong>${escapeHtml(dateLabel)}</strong> <small>${escapeHtml(timeLabel)}</small>`

    const total = document.createElement('strong')
    total.textContent = `${meal.totalKcal ?? 0} kcal`

    header.appendChild(title)
    header.appendChild(total)
    card.appendChild(header)

    if(Array.isArray(meal.items) && meal.items.length){
      const list = document.createElement('ul')
      meal.items.forEach(item => {
        const li = document.createElement('li')
        const label = item.foodName || 'Unknown food'
        const unitText = item.unit ? ` (${item.unit})` : ''
        const qtyText = `${item.quantity} × ${item.kcalPerUnit} kcal`
        const itemTotal = typeof item.itemKcal === 'number' ? item.itemKcal : item.quantity * item.kcalPerUnit
        const macros = [
          item.itemProtein ? `${roundOne(item.itemProtein)}g P` : null,
          item.itemCarbs ? `${roundOne(item.itemCarbs)}g C` : null,
          item.itemFat ? `${roundOne(item.itemFat)}g F` : null
        ].filter(Boolean).join(' · ')
        li.innerHTML = `
          <strong>${escapeHtml(label)}</strong>${escapeHtml(unitText)} — ${escapeHtml(qtyText)} = <span>${itemTotal} kcal</span>
          ${macros ? `<br/><small>${escapeHtml(macros)}</small>` : ''}
        `
        list.appendChild(li)
      })
      card.appendChild(list)
    }

    const footer = document.createElement('footer')
    const macrosSummary = [
      meal.totalProtein ? `${roundOne(meal.totalProtein)}g P` : null,
      meal.totalCarbs ? `${roundOne(meal.totalCarbs)}g C` : null,
      meal.totalFat ? `${roundOne(meal.totalFat)}g F` : null
    ].filter(Boolean).join(' · ')

    const left = document.createElement('span')
    left.textContent = `${meal.items?.length || 0} items${macrosSummary ? ` · ${macrosSummary}` : ''}`
    footer.appendChild(left)

    const controls = document.createElement('div')
    controls.style.display = 'flex'
    controls.style.gap = '0.25rem'

    if(typeof onEdit === 'function'){
      const editBtn = document.createElement('button')
      editBtn.type = 'button'
      editBtn.textContent = 'Edit'
      editBtn.className = 'secondary'
      editBtn.addEventListener('click', () => onEdit(meal))
      controls.appendChild(editBtn)
    }

    if(typeof onDelete === 'function'){
      const delBtn = document.createElement('button')
      delBtn.type = 'button'
      delBtn.textContent = 'Delete'
      delBtn.className = 'danger'
      delBtn.addEventListener('click', () => onDelete(meal))
      controls.appendChild(delBtn)
    }

    footer.appendChild(controls)
    card.appendChild(footer)

    container.appendChild(card)
  })
}

function roundOne(value){
  return Math.round(Number(value ?? 0) * 10) / 10
}
