<script setup lang="ts">
import { watch, ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMessage } from 'naive-ui'
import { useAppStore } from '../store/appStore'

const { locale, t } = useI18n()
const message = useMessage()
const appStore = useAppStore()

// Local settings sync
const languageOpt = ref<'id' | 'en'>(appStore.currentLanguage)
const themeOpt = ref<'light' | 'dark'>(appStore.themeMode)
const autoPasteOpt = ref<boolean>(appStore.autoPasteDownload)

// Fetch saved settings from DB on mount — only if App.vue has not already loaded them.
// If App.vue already populated appStore (settingsLoaded=true), we just read from the store.
const loadSettings = async () => {
  if (appStore.settingsLoaded) {
    // Sync local refs from already-loaded store values
    languageOpt.value = appStore.currentLanguage
    themeOpt.value = appStore.themeMode
    autoPasteOpt.value = appStore.autoPasteDownload
    applyTheme(appStore.themeMode)
    return
  }
  try {
    const res = await fetch('/api/settings')
    if (res.ok) {
      const json = await res.json()
      if (json.status && json.data) {
        if (json.data.language) {
          appStore.currentLanguage = json.data.language
          languageOpt.value = json.data.language
          locale.value = json.data.language
        }
        if (json.data.theme) {
          appStore.themeMode = json.data.theme
          themeOpt.value = json.data.theme
          applyTheme(json.data.theme)
        }
        if (json.data.autoPasteDownload) {
          const val = json.data.autoPasteDownload === 'true'
          appStore.autoPasteDownload = val
          autoPasteOpt.value = val
        }
      }
    }
  } catch (error) {
    console.error('Failed to load settings from DB:', error)
  }
}

// Save setting to DB helper
const saveSetting = async (key: string, value: string) => {
  try {
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value })
    })
  } catch (error) {
    console.error(`Failed to save setting ${key}:`, error)
  }
}

// Watchers to apply changes and save to backend
watch(languageOpt, (newLang) => {
  appStore.currentLanguage = newLang
  locale.value = newLang
  saveSetting('language', newLang)
  message.success(t('settingsSaved'))
})

watch(themeOpt, (newTheme) => {
  appStore.themeMode = newTheme
  applyTheme(newTheme)
  saveSetting('theme', newTheme)
  message.success(t('settingsSaved'))
})

watch(autoPasteOpt, (newVal) => {
  appStore.autoPasteDownload = newVal
  saveSetting('autoPasteDownload', String(newVal))
  message.success(t('settingsSaved'))
})

const applyTheme = (theme: 'light' | 'dark') => {
  const root = document.documentElement
  if (theme === 'light') {
    root.classList.add('light')
  } else {
    root.classList.remove('light')
  }
}

onMounted(() => {
  loadSettings()
})
</script>

<template>
  <div class="settings-container">
    <div class="settings-header">
      <h2>{{ t('settings') }}</h2>
    </div>

    <div class="settings-list">
      <!-- Theme Selection -->
      <div class="settings-card">
        <div class="settings-item">
          <div class="item-info">
            <div class="item-title-row">
              <span class="item-icon theme-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 14.7255 3.09032 17.1962 4.85857 19C5.03345 19.1749 5.0999 19.4318 5.02452 19.6644L4.85194 20.1979C4.65431 20.8077 5.15529 21.3993 5.78768 21.2891L7.15174 21.051C7.38202 21.0108 7.62125 21.0833 7.78453 21.2466C8.98064 22.4427 10.4282 22.9555 12 22Z"></path><circle cx="7.5" cy="10.5" r="1.5" fill="currentColor"></circle><circle cx="11.5" cy="7.5" r="1.5" fill="currentColor"></circle><circle cx="16.5" cy="9.5" r="1.5" fill="currentColor"></circle><circle cx="15.5" cy="14.5" r="1.5" fill="currentColor"></circle></svg>
              </span>
              <h4>{{ t('themeMode') }}</h4>
            </div>
            <p>{{ t('theme') }}</p>
          </div>
          <div class="item-control">
            <div class="toggle-group">
              <button 
                class="toggle-btn"
                :class="{ active: themeOpt === 'light' }"
                @click="themeOpt = 'light'"
              >
                {{ t('lightMode') }}
              </button>
              <button 
                class="toggle-btn"
                :class="{ active: themeOpt === 'dark' }"
                @click="themeOpt = 'dark'"
              >
                {{ t('darkMode') }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Language Selection -->
      <div class="settings-card">
        <div class="settings-item">
          <div class="item-info">
            <div class="item-title-row">
              <span class="item-icon lang-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
              </span>
              <h4>{{ t('appLanguage') }}</h4>
            </div>
            <p>{{ t('language') }}</p>
          </div>
          <div class="item-control">
            <div class="toggle-group">
              <button 
                class="toggle-btn"
                :class="{ active: languageOpt === 'id' }"
                @click="languageOpt = 'id'"
              >
                Bahasa
              </button>
              <button 
                class="toggle-btn"
                :class="{ active: languageOpt === 'en' }"
                @click="languageOpt = 'en'"
              >
                English
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Auto Paste & Download Selection -->
      <div class="settings-card">
        <div class="settings-item">
          <div class="item-info">
            <div class="item-title-row">
              <span class="item-icon paste-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>
              </span>
              <h4>{{ t('autoPasteDownloadSetting') }}</h4>
            </div>
            <p>{{ t('autoPasteDownloadDesc') }}</p>
          </div>
          <div class="item-control">
            <div class="toggle-group">
              <button 
                class="toggle-btn"
                :class="{ active: autoPasteOpt === true }"
                @click="autoPasteOpt = true"
              >
                {{ t('on') }}
              </button>
              <button 
                class="toggle-btn"
                :class="{ active: autoPasteOpt === false }"
                @click="autoPasteOpt = false"
              >
                {{ t('off') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-container {
  padding: 4px 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.settings-header {
  margin-bottom: 4px;
}

.settings-header h2 {
  font-size: 1.35rem;
  font-weight: 700;
  margin: 0;
  color: var(--text-primary);
}

.settings-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.settings-card {
  background: var(--bg-secondary);
  border: 1.5px solid var(--bg-tertiary);
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  transition: transform 0.2s ease, border-color 0.2s;
}

.settings-card:hover {
  border-color: color-mix(in srgb, var(--accent-color) 20%, var(--bg-tertiary));
}

.settings-item {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.item-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 4px;
}

.item-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: rgba(var(--accent-rgb), 0.1);
  color: var(--accent-color);
  flex-shrink: 0;
}

.item-info h4 {
  font-size: 0.95rem;
  font-weight: 600;
  margin: 0;
  color: var(--text-primary);
}

.item-info p {
  font-size: 0.75rem;
  color: var(--text-tertiary);
  margin: 0;
  line-height: 1.45;
}

.item-control {
  width: 100%;
}

.toggle-group {
  display: flex;
  background-color: var(--bg-primary);
  border: 1px solid var(--bg-tertiary);
  padding: 3px;
  border-radius: 10px;
  width: 100%;
}

.toggle-btn {
  flex: 1;
  padding: 8px 12px;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  font-family: inherit;
  font-size: 0.8rem;
  font-weight: 600;
  border-radius: 7px;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: center;
}

.toggle-btn.active {
  background-color: var(--accent-color);
  color: var(--bg-primary);
  box-shadow: 0 4px 12px rgba(var(--accent-rgb), 0.25);
}

/* Desktop styles */
@media (min-width: 768px) {
  .settings-container {
    max-width: 700px;
    margin: 0 auto;
    width: 100%;
  }

  .settings-item {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    gap: 24px;
  }

  .item-control {
    width: 200px;
    flex-shrink: 0;
  }
}
</style>
