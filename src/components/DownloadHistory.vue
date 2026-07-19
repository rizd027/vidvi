<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMessage, useDialog } from 'naive-ui'
import { useAppStore } from '../store/appStore'
import { useHistoryStore, type HistoryItem } from '../store/historyStore'

const { t } = useI18n()
const message = useMessage()
const dialog = useDialog()
const appStore = useAppStore()
const historyStore = useHistoryStore()

// Filter options
const activeFilter = ref<'all' | 'spotify' | 'tiktok' | 'capcut' | 'youtube' | 'instagram' | 'facebook' | 'twitter'>('all')
const searchQuery = ref('')

// Filtered and searched list
const filteredHistory = computed(() => {
  return historyStore.items.filter((item: HistoryItem) => {
    const matchesPlatform = activeFilter.value === 'all' || item.platform === activeFilter.value
    const titleText = (item.title || '').toLowerCase()
    const urlText = (item.url || '').toLowerCase()
    const query = searchQuery.value.toLowerCase().trim()
    const matchesSearch = !query || titleText.includes(query) || urlText.includes(query)
    return matchesPlatform && matchesSearch
  })
})

const handleClearAll = () => {
  dialog.warning({
    title: t('clearHistory'),
    content: t('confirmClear'),
    positiveText: t('next'),
    negativeText: t('back'),
    onPositiveClick: () => {
      historyStore.clearAll()
      message.success(t('clearSuccess'))
    }
  })
}

const handleDelete = (id: number) => {
  historyStore.removeItem(id)
  message.success(t('deleteSuccess'))
}

const triggerRedownload = (item: HistoryItem) => {
  appStore.prefillDownload(item.url, item.platform)
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="borderless-card">
    <div class="history-header">
      <div class="title-row">
        <h2>{{ t('downloadHistory') }}</h2>
        <button 
          v-if="historyStore.items.length > 0" 
          class="btn-clear-all" 
          @click="handleClearAll"
        >
          {{ t('clearHistory') }}
        </button>
      </div>

      <!-- Search & Filters -->
      <div class="filter-controls" v-if="historyStore.items.length > 0">
        <input 
          v-model="searchQuery" 
          type="text" 
          class="search-input" 
          placeholder="Cari riwayat..."
        />
        
        <div class="filter-tabs">
          <button 
            v-for="filter in ['all', 'tiktok', 'youtube', 'instagram', 'spotify', 'capcut', 'facebook', 'twitter'] as const" 
            :key="filter"
            class="filter-tab"
            :class="{ active: activeFilter === filter }"
            @click="activeFilter = filter"
          >
            {{ filter === 'all' ? 'Semua' : filter.charAt(0).toUpperCase() + filter.slice(1) }}
          </button>
        </div>
      </div>
    </div>

    <!-- History List -->
    <div v-if="filteredHistory.length === 0" class="empty-state text-center">
      <p>{{ t('emptyHistory') }}</p>
    </div>

    <div v-else class="history-list">
      <div 
        v-for="item in filteredHistory" 
        :key="item.id" 
        class="history-item"
      >
        <div class="item-media">
          <img v-if="item.thumbnail" :src="item.thumbnail" class="item-thumb" alt="Thumb" referrerpolicy="no-referrer" />
          <div v-else class="item-thumb-placeholder" :class="item.platform">
            {{ item.platform[0].toUpperCase() }}
          </div>
        </div>

        <div class="item-details">
          <div class="item-platform-row">
            <span class="item-platform" :class="item.platform">{{ item.platform }}</span>
            <span class="item-time">{{ formatDate(item.created_at) }}</span>
          </div>
          <h4 class="item-title" :title="item.title">{{ item.title || 'Untitled' }}</h4>
          <p class="item-url">{{ item.url }}</p>
        </div>

        <div class="item-actions">
          <button class="action-btn download" :title="t('quickDownload')" @click="triggerRedownload(item)">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
          </button>
          <button class="action-btn delete" :title="t('clearHistory')" @click="handleDelete(item.id)">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.borderless-card {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-height: 100%;
  overflow: hidden;
}

.history-header {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-md);
}

.title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.btn-clear-all {
  background: transparent;
  border: none;
  color: var(--text-tertiary);
  font-size: 0.85rem;
  cursor: pointer;
  padding: 8px 12px;
  border-radius: 8px;
  transition: color var(--transition-fast), background-color var(--transition-fast);
}

.btn-clear-all:hover {
  color: var(--tiktok-color);
  background-color: rgba(255, 0, 80, 0.05);
}

.filter-controls {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.search-input {
  width: 100%;
  min-height: 44px;
  background-color: var(--bg-secondary);
  border: none;
  outline: none;
  border-radius: 12px;
  padding: 0 var(--spacing-sm);
  color: var(--text-primary);
  font-size: 0.9rem;
  box-sizing: border-box;
}

.filter-tabs {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
  scrollbar-width: none; /* Firefox */
}

.filter-tabs::-webkit-scrollbar {
  display: none; /* Safari and Chrome */
}

.filter-tab {
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 600;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  border: none;
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;
}

.filter-tab.active {
  background: var(--accent-color);
  color: var(--bg-primary);
}

.loading-state, .empty-state {
  padding: var(--spacing-xl) 0;
  color: var(--text-secondary);
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  flex-grow: 1;
  overflow-y: auto;
  padding-bottom: 12px;
  scrollbar-width: none;
}

.history-list::-webkit-scrollbar {
  display: none;
}

.history-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm);
  background-color: var(--bg-secondary);
  border-radius: var(--border-radius);
  transition: background-color var(--transition-fast);
}

.history-item:hover {
  background-color: var(--bg-tertiary);
}

.item-media {
  flex-shrink: 0;
}

.item-thumb {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  object-fit: cover;
}

.item-thumb-placeholder {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 1.2rem;
}

.item-thumb-placeholder.spotify {
  background-color: rgba(30, 215, 96, 0.1);
  color: var(--spotify-color);
}
.item-thumb-placeholder.tiktok {
  background-color: rgba(255, 0, 80, 0.1);
  color: var(--tiktok-color);
}
.item-thumb-placeholder.capcut {
  background-color: rgba(0, 242, 254, 0.1);
  color: var(--capcut-color);
}

.item-details {
  flex-grow: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.item-platform-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.item-platform {
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.item-platform.spotify { color: var(--spotify-color); }
.item-platform.tiktok { color: var(--tiktok-color); }
.item-platform.capcut { color: var(--capcut-color); }

.item-time {
  font-size: 0.7rem;
  color: var(--text-tertiary);
}

.item-title {
  font-size: 0.95rem;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin: 0;
}

.item-url {
  font-size: 0.75rem;
  color: var(--text-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin: 0;
}

.item-actions {
  display: flex;
  gap: 6px;
}

.action-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
}

.action-btn:hover {
  background-color: var(--bg-secondary);
  color: var(--text-primary);
}

.action-btn.delete:hover {
  color: var(--tiktok-color);
  background-color: rgba(255, 0, 80, 0.05);
}

.action-btn.download:hover {
  color: var(--spotify-color);
  background-color: rgba(30, 215, 96, 0.05);
}
</style>
