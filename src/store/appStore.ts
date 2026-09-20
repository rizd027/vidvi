import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAppStore = defineStore('app', () => {
  const activeTab = ref<'downloader' | 'history' | 'settings'>('downloader')
  const prefilledUrl = ref('')
  const prefilledPlatform = ref('')
  
  // Theme & Language defaults, synced to localStorage or set dynamically
  const currentLanguage = ref<'id' | 'en'>('id')
  const themeMode = ref<'light' | 'dark'>('dark')
  const autoPasteDownload = ref(false)

  // BUG-11: Track whether settings have been loaded from the server to avoid double-fetch.
  // App.vue loads settings once on startup; Settings.vue reads from store, not from server.
  const settingsLoaded = ref(false)

  const setTab = (tab: 'downloader' | 'history' | 'settings') => {
    activeTab.value = tab
  }

  const prefillDownload = (url: string, platform: string) => {
    prefilledUrl.value = url
    prefilledPlatform.value = platform
    activeTab.value = 'downloader'
  }

  return {
    activeTab,
    prefilledUrl,
    prefilledPlatform,
    currentLanguage,
    themeMode,
    autoPasteDownload,
    settingsLoaded,
    setTab,
    prefillDownload
  }
})
