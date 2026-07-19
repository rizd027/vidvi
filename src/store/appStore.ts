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
    setTab,
    prefillDownload
  }
})
