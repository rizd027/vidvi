import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface HistoryItem {
  id: number
  platform: string
  url: string
  title: string
  thumbnail: string
  duration: string
  download_url: string
  media_type: string
  size: string
  created_at: string
}

const STORAGE_KEY = 'vidvi_download_history'
const MAX_ITEMS = 50

function loadFromStorage(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveToStorage(items: HistoryItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch (e) {
    console.warn('Failed to save history to localStorage:', e)
  }
}

export const useHistoryStore = defineStore('history', () => {
  const items = ref<HistoryItem[]>(loadFromStorage())
  let nextId = items.value.length > 0 ? Math.max(...items.value.map(i => i.id)) + 1 : 1

  function addItem(entry: Omit<HistoryItem, 'id' | 'created_at'>) {
    const item: HistoryItem = {
      id: nextId++,
      created_at: new Date().toISOString(),
      ...entry,
    }
    items.value.unshift(item)
    // Keep only last MAX_ITEMS
    if (items.value.length > MAX_ITEMS) {
      items.value = items.value.slice(0, MAX_ITEMS)
    }
    saveToStorage(items.value)
  }

  function removeItem(id: number) {
    items.value = items.value.filter(i => i.id !== id)
    saveToStorage(items.value)
  }

  function clearAll() {
    items.value = []
    saveToStorage(items.value)
  }

  return { items, addItem, removeItem, clearAll }
})
