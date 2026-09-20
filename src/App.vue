<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { darkTheme, NConfigProvider, NMessageProvider, NDialogProvider } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useAppStore } from './store/appStore'
import DownloaderForm from './components/DownloaderForm.vue'
import DownloadHistory from './components/DownloadHistory.vue'
import Settings from './components/Settings.vue'

const appStore = useAppStore()
const { locale, t } = useI18n()

// Toggle dark theme dynamically for Naive UI components
const naiveTheme = computed(() => {
  return appStore.themeMode === 'dark' ? darkTheme : null
})

// Custom Naive UI theme overrides for minimal styling
const themeOverrides = computed(() => {
  const isDark = appStore.themeMode === 'dark'
  const primaryColor = isDark ? '#ffffff' : '#09090b'
  const textColor = isDark ? '#f4f4f5' : '#09090b'
  
  return {
    common: {
      primaryColor,
      primaryColorHover: isDark ? '#e4e4e7' : '#27272a',
      primaryColorPressed: isDark ? '#d4d4d8' : '#3f3f46',
      textColorBase: textColor,
    },
    Dialog: {
      color: isDark ? '#121215' : '#ffffff',
      titleTextColor: textColor,
      contentTextColor: isDark ? '#a1a1aa' : '#52525b',
      border: 'none',
      borderRadius: '16px',
    },
    Message: {
      color: isDark ? '#18181b' : '#ffffff',
      textColor: textColor,
      borderRadius: '12px',
      boxShadow: '0 8px 30px rgba(0, 0, 0, 0.15)',
    }
  }
})

// Initialize theme class on document element and pull settings from DB
const initializeApp = async () => {
  try {
    const res = await fetch('/api/settings')
    if (res.ok) {
      const json = await res.json()
      if (json.status && json.data) {
        if (json.data.language) {
          appStore.currentLanguage = json.data.language
          locale.value = json.data.language
        }
        if (json.data.theme) {
          appStore.themeMode = json.data.theme
          applyThemeClass(json.data.theme)
        }
        if (json.data.autoPasteDownload) {
          appStore.autoPasteDownload = json.data.autoPasteDownload === 'true'
        }
      }
    }
  } catch (error) {
    console.error('Failed to initialize app settings:', error)
  } finally {
    // BUG-11: mark settings as loaded so Settings.vue won't double-fetch
    appStore.settingsLoaded = true
  }
}

const applyThemeClass = (theme: 'light' | 'dark') => {
  const root = document.documentElement
  if (theme === 'light') {
    root.classList.add('light')
  } else {
    root.classList.remove('light')
  }
}

onMounted(() => {
  initializeApp()
})
</script>

<template>
  <n-config-provider :theme="naiveTheme" :theme-overrides="themeOverrides">
    <n-message-provider>
      <n-dialog-provider>
        <div class="app-container">
          <!-- Main Content -->
          <main class="main-content">
            <Transition name="fade" mode="out-in">
              <DownloaderForm v-if="appStore.activeTab === 'downloader'" />
              <DownloadHistory v-else-if="appStore.activeTab === 'history'" />
              <Settings v-else-if="appStore.activeTab === 'settings'" />
            </Transition>
          </main>

          <!-- Bottom Navigation Bar -->
          <nav class="tab-navigation">
            <button
              class="tab-btn"
              :class="{ active: appStore.activeTab === 'downloader' }"
              @click="appStore.setTab('downloader')"
            >
              {{ t('home') }}
            </button>
            <button
              class="tab-btn"
              :class="{ active: appStore.activeTab === 'history' }"
              @click="appStore.setTab('history')"
            >
              {{ t('history') }}
            </button>
            <button
              class="tab-btn"
              :class="{ active: appStore.activeTab === 'settings' }"
              @click="appStore.setTab('settings')"
            >
              {{ t('settings') }}
            </button>
          </nav>
        </div>
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>

<style>
/* Custom transitions for router view/components */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.fade-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
