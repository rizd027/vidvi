import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export const useAppStore = defineStore('app', () => {
  const activeTab = ref<'downloader' | 'history' | 'settings'>('downloader')
  const prefilledUrl = ref('')
  const prefilledPlatform = ref('')
  
  // Theme & Language defaults, synced to localStorage
  const savedLang = (typeof localStorage !== 'undefined' ? localStorage.getItem('vidvi_language') as 'id' | 'en' : null) || 'id'
  const savedTheme = (typeof localStorage !== 'undefined' ? localStorage.getItem('vidvi_theme') as 'light' | 'dark' : null) || 'dark'
  const savedAutoPaste = typeof localStorage !== 'undefined' && localStorage.getItem('vidvi_auto_paste') === 'true'

  const currentLanguage = ref<'id' | 'en'>(savedLang)
  const themeMode = ref<'light' | 'dark'>(savedTheme)
  const autoPasteDownload = ref(savedAutoPaste)

  // Watch and persist changes to localStorage
  watch(currentLanguage, (val) => {
    try { localStorage.setItem('vidvi_language', val) } catch {}
  })
  watch(themeMode, (val) => {
    try { localStorage.setItem('vidvi_theme', val) } catch {}
  })
  watch(autoPasteDownload, (val) => {
    try { localStorage.setItem('vidvi_auto_paste', String(val)) } catch {}
  })

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

