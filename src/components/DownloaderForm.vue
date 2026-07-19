<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { useI18n } from 'vue-i18n'
import { useMessage } from 'naive-ui'
import { useAppStore } from '../store/appStore'

const { t, locale } = useI18n()
const message = useMessage()
const appStore = useAppStore()

type Platform = 'spotify' | 'tiktok' | 'capcut' | 'youtube' | 'instagram' | 'facebook' | 'twitter' | ''

const currentStep = ref(1)
const inputUrl = ref('')
const selectedPlatform = ref<Platform>('')
const fetchTriggered = ref(false)

// Handle prefilled URL from store (e.g. from history page)
watch(() => appStore.activeTab, (newTab) => {
  if (newTab === 'downloader' && appStore.prefilledUrl) {
    inputUrl.value = appStore.prefilledUrl
    selectedPlatform.value = appStore.prefilledPlatform as any
    appStore.prefilledUrl = ''
    appStore.prefilledPlatform = ''
    setTimeout(() => { handleSearch() }, 50)
  }
}, { immediate: true })

// Auto-detect platform from URL
watch(inputUrl, (newUrl) => {
  const url = newUrl.toLowerCase().trim()
  if (url.includes('spotify.com')) selectedPlatform.value = 'spotify'
  else if (url.includes('tiktok.com')) selectedPlatform.value = 'tiktok'
  else if (url.includes('capcut.com') || url.includes('capcut.net')) selectedPlatform.value = 'capcut'
  else if (url.includes('youtube.com') || url.includes('youtu.be')) selectedPlatform.value = 'youtube'
  else if (url.includes('instagram.com')) selectedPlatform.value = 'instagram'
  else if (url.includes('facebook.com') || url.includes('fb.watch') || url.includes('fb.com')) selectedPlatform.value = 'facebook'
  else if (url.includes('twitter.com') || url.includes('x.com')) selectedPlatform.value = 'twitter'
  else selectedPlatform.value = ''
})

const isValidUrl = computed(() => {
  if (!inputUrl.value) return false
  const url = inputUrl.value.toLowerCase().trim()
  return (
    url.includes('spotify.com') ||
    url.includes('tiktok.com') ||
    url.includes('capcut.com') ||
    url.includes('capcut.net') ||
    url.includes('youtube.com') ||
    url.includes('youtu.be') ||
    url.includes('instagram.com') ||
    url.includes('facebook.com') ||
    url.includes('fb.watch') ||
    url.includes('fb.com') ||
    url.includes('twitter.com') ||
    url.includes('x.com')
  )
})

const fetchMedia = async () => {
  if (!selectedPlatform.value || !inputUrl.value) return null
  const response = await fetch(
    `/api/download/${selectedPlatform.value}?url=${encodeURIComponent(inputUrl.value.trim())}&lang=${locale.value}`
  )
  let data
  try { data = await response.json() } catch (e) { throw new Error(t('errorFetch')) }
  if (!response.ok || data.status === false) throw new Error(data.message || t('errorFetch'))
  return data.result || data
}

const { data: mediaData, error, isLoading, refetch } = useQuery({
  queryKey: computed(() => ['download', selectedPlatform.value, inputUrl.value]),
  queryFn: fetchMedia,
  enabled: fetchTriggered,
  retry: false
})

const handleSearch = () => {
  if (!isValidUrl.value) { message.error(t('invalidUrl')); return }
  currentStep.value = 2
  fetchTriggered.value = true
  refetch()
}

watch([isLoading, mediaData, error], ([loading, data, err]) => {
  if (fetchTriggered.value && !loading) {
    if (err) {
      message.error(err instanceof Error ? err.message : t('errorFetch'))
      currentStep.value = 1
      fetchTriggered.value = false
    } else if (data) {
      currentStep.value = 3
      message.success(t('downloadSuccess'))
      fetchTriggered.value = false
    }
  }
})

const activePhotoIndex = ref<number | null>(null)

const handlePhotoClick = (idx: string | number, imgUrl: string, filename: string) => {
  const numIdx = Number(idx)
  if (activePhotoIndex.value === numIdx) {
    proxyDownload(imgUrl, filename)
    activePhotoIndex.value = null
  } else {
    activePhotoIndex.value = numIdx
  }
}

const getProxyUrl = (url: string | undefined, inline = false) => {
  if (!url) return ''
  return `/api/proxy-download?url=${encodeURIComponent(url)}${inline ? '&inline=true' : ''}`
}

const isVideoPlaying = ref(false)

const handleReset = () => {
  inputUrl.value = ''
  selectedPlatform.value = ''
  currentStep.value = 1
  fetchTriggered.value = false
  activePhotoIndex.value = null
  isVideoPlaying.value = false
}

const formatDuration = (val: any) => {
  if (!val) return ''
  if (typeof val === 'number') {
    const min = Math.floor(val / 60)
    const sec = val % 60
    return `${min}:${sec.toString().padStart(2, '0')}`
  }
  return val
}

// Platform definitions
const platforms = [
  { id: 'youtube',   label: 'YouTube',   color: '#ff0000' },
  { id: 'instagram', label: 'Instagram', color: '#e1306c' },
  { id: 'facebook',  label: 'Facebook',  color: '#1877f2' },
  { id: 'twitter',   label: 'Twitter/X', color: '#1da1f2' },
  { id: 'tiktok',    label: 'TikTok',    color: '#ff0050' },
  { id: 'spotify',   label: 'Spotify',   color: '#1ed760' },
  { id: 'capcut',    label: 'CapCut',    color: '#00f2fe' },
]

// Computed results per platform
const spotifyResult = computed(() => {
  if (selectedPlatform.value !== 'spotify' || !mediaData.value) return null
  const res = mediaData.value
  return {
    title: res.title || 'Spotify Track',
    artist: res.artist || res.artists || 'Unknown Artist',
    album: res.album || '',
    thumbnail: res.thumbnail || res.cover_url || '',
    downloadUrl: res.downloadUrl || res.download_url || res.download || res.url || '',
    duration: res.duration || ''
  }
})

const tiktokResult = computed(() => {
  if (selectedPlatform.value !== 'tiktok' || !mediaData.value) return null
  const res = mediaData.value
  return {
    title: res.title || 'TikTok Video',
    author: res.author?.nickname || res.author?.unique_id || 'TikTok User',
    thumbnail: res.cover || res.dynamic_cover || '',
    videoNoWatermark: res.video || res.video_hd || '',
    videoWatermark: res.video_watermark || '',
    audioUrl: res.audio || '',
    duration: res.duration || '',
    images: res.images || []
  }
})

const capcutResult = computed(() => {
  if (selectedPlatform.value !== 'capcut' || !mediaData.value) return null
  const res = mediaData.value
  return {
    title: res.title || 'CapCut Template',
    thumbnail: res.cover || '',
    videoUrl: res.video || res.url || '',
    size: res.size || ''
  }
})

const youtubeResult = computed(() => {
  if (selectedPlatform.value !== 'youtube' || !mediaData.value) return null
  const res = mediaData.value
  return {
    title: res.title || 'YouTube Video',
    author: res.author || res.uploader || 'YouTube',
    thumbnail: res.thumbnail || '',
    videoUrl: res.videoUrl || res.url || '',
    audioUrl: res.audioUrl || '',
    audioExt: res.audioExt || 'm4a',
    duration: res.duration || 0,
    formats: res.formats || []
  }
})

const instagramResult = computed(() => {
  if (selectedPlatform.value !== 'instagram' || !mediaData.value) return null
  const res = mediaData.value
  return {
    title: res.title || 'Instagram Video',
    author: res.author || 'Instagram',
    thumbnail: res.thumbnail || '',
    videoUrl: res.videoUrl || res.url || '',
    picker: res.picker || null
  }
})

const facebookResult = computed(() => {
  if (selectedPlatform.value !== 'facebook' || !mediaData.value) return null
  const res = mediaData.value
  return {
    title: res.title || 'Facebook Video',
    author: res.author || 'Facebook',
    thumbnail: res.thumbnail || '',
    videoUrl: res.videoUrl || res.url || ''
  }
})

const twitterResult = computed(() => {
  if (selectedPlatform.value !== 'twitter' || !mediaData.value) return null
  const res = mediaData.value
  return {
    title: res.title || 'Twitter/X Video',
    author: res.author || 'Twitter User',
    thumbnail: res.thumbnail || '',
    videoUrl: res.videoUrl || res.url || ''
  }
})

const currentPlatformColor = computed(() => {
  const found = platforms.find(p => p.id === selectedPlatform.value)
  return found?.color || 'var(--accent-color)'
})

const currentPlatformLabel = computed(() => {
  const found = platforms.find(p => p.id === selectedPlatform.value)
  return found?.label || ''
})

// ── Clipboard & Auto-Paste Helpers ──
const pasteFromClipboard = async () => {
  try {
    const text = await navigator.clipboard.readText()
    if (text) {
      inputUrl.value = text.trim()
    } else {
      message.warning(t('clipboardError') || 'Papan klip kosong.')
    }
  } catch (err) {
    message.error(t('clipboardError') || 'Gagal membaca papan klip. Berikan izin akses papan klip.')
    console.error('Failed to read clipboard:', err)
  }
}

const pasteAndDownload = async () => {
  try {
    const text = await navigator.clipboard.readText()
    if (text) {
      const url = text.trim()
      inputUrl.value = url
      setTimeout(() => {
        handleSearch()
      }, 50)
    } else {
      message.warning(t('clipboardError') || 'Papan klip kosong.')
    }
  } catch (err) {
    message.error(t('clipboardError') || 'Gagal membaca papan klip. Berikan izin akses papan klip.')
    console.error('Failed to read clipboard:', err)
  }
}

const checkAutoPaste = async () => {
  if (!appStore.autoPasteDownload) return
  if (currentStep.value !== 1) return
  if (inputUrl.value.trim() !== '') return

  try {
    const text = await navigator.clipboard.readText()
    if (text) {
      const url = text.trim()
      const isSupported = (
        url.includes('spotify.com') ||
        url.includes('tiktok.com') ||
        url.includes('capcut.com') ||
        url.includes('capcut.net') ||
        url.includes('youtube.com') ||
        url.includes('youtu.be') ||
        url.includes('instagram.com') ||
        url.includes('facebook.com') ||
        url.includes('fb.watch') ||
        url.includes('fb.com') ||
        url.includes('twitter.com') ||
        url.includes('x.com')
      )
      if (isSupported) {
        inputUrl.value = url
        message.info(t('autoPasted'))
        setTimeout(() => {
          handleSearch()
        }, 100)
      }
    }
  } catch (error) {
    console.warn('Auto paste failed:', error)
  }
}

onMounted(() => {
  checkAutoPaste()
  window.addEventListener('focus', checkAutoPaste)
})

onUnmounted(() => {
  window.removeEventListener('focus', checkAutoPaste)
})

// ── Proxy Download Helper ──
// Routes download through /api/proxy-download so the browser saves the file
// directly instead of opening a new tab.
function proxyDownload(rawUrl: string, filename = 'vidvi-download') {
  if (!rawUrl) return
  const proxyUrl = `/api/proxy-download?url=${encodeURIComponent(rawUrl)}&filename=${encodeURIComponent(filename)}`
  const a = document.createElement('a')
  a.href = proxyUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}
</script>

<template>
  <div class="borderless-card">
    <!-- STEP 1: INPUT URL -->
    <div v-if="currentStep === 1" class="step-container">
      <div class="header-section text-center">
        <h1>Vidvi</h1>
        <p class="subtitle">{{ t('subtitle') }}</p>
      </div>

      <div class="form-container">
        <div class="custom-input-group">
          <div class="input-wrapper">
            <input
              v-model="inputUrl"
              type="text"
              class="custom-input"
              :placeholder="t('searchPlaceholder')"
              @keyup.enter="handleSearch"
              style="padding-right: 90px;"
            />
            <button
              v-if="!inputUrl"
              type="button"
              class="input-action-btn paste-btn"
              @click="pasteFromClipboard"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>
              <span>{{ t('paste') }}</span>
            </button>
            <button
              v-else
              type="button"
              class="input-action-btn clear-btn"
              @click="inputUrl = ''"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
          <button
            class="btn-primary"
            :disabled="!isValidUrl"
            @click="handleSearch"
          >
            {{ t('downloadBtn') }}
          </button>
          <button
            v-if="!inputUrl"
            type="button"
            class="btn-paste-download"
            @click="pasteAndDownload"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="8 17 12 21 16 17"></polyline><line x1="12" y1="12" x2="12" y2="21"></line><path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"></path></svg>
            {{ t('pasteAndDownload') }}
          </button>
        </div>

        <!-- Platform Grid -->
        <div class="platform-grid">
          <button
            v-for="p in platforms"
            :key="p.id"
            class="platform-badge"
            :class="{ active: selectedPlatform === p.id }"
            :style="selectedPlatform === p.id ? `--active-color: ${p.color}` : ''"
          >
            <span class="platform-icon">
              <!-- YouTube -->
              <svg v-if="p.id === 'youtube'" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
              <!-- Instagram -->
              <svg v-else-if="p.id === 'instagram'" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
              <!-- Facebook -->
              <svg v-else-if="p.id === 'facebook'" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              <!-- Twitter -->
              <svg v-else-if="p.id === 'twitter'" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              <!-- TikTok -->
              <svg v-else-if="p.id === 'tiktok'" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.28 6.28 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.89a8.18 8.18 0 004.78 1.52V6.97a4.85 4.85 0 01-1.02-.28z"/></svg>
              <!-- Spotify -->
              <svg v-else-if="p.id === 'spotify'" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
              <!-- CapCut -->
              <svg v-else-if="p.id === 'capcut'" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 100 20A10 10 0 0012 2zm0 18a8 8 0 110-16 8 8 0 010 16zm-1-13h2v6h-2zm0 8h2v2h-2z"/></svg>
            </span>
            <span class="platform-label">{{ p.label }}</span>
          </button>
        </div>

        <p class="supported-note">{{ t('supportedPlatforms') }}</p>
      </div>
    </div>

    <!-- STEP 2: PROCESSING -->
    <div v-else-if="currentStep === 2" class="step-container text-center processing-state">
      <div class="loader-wrapper">
        <div class="spinner-ring"></div>
      </div>
      <h3 class="pulse" style="margin-top: var(--spacing-md)">{{ t('downloading') }}</h3>
      <p style="margin-top: 8px">{{ t('detecting') }}</p>
      <button class="btn-secondary" style="margin-top: var(--spacing-lg)" @click="handleReset">
        {{ t('back') }}
      </button>
    </div>

    <!-- STEP 3: RESULT -->
    <div v-else-if="currentStep === 3" class="step-container">
      <div class="result-card">
        <!-- Platform header badge -->
        <div class="result-platform-badge" :style="`background: ${currentPlatformColor}1a; color: ${currentPlatformColor};`">
          {{ currentPlatformLabel }}
        </div>

        <!-- Spotify Result -->
        <div v-if="selectedPlatform === 'spotify' && spotifyResult" class="media-details">
          <div class="cover-wrapper" v-if="spotifyResult.thumbnail">
            <img :src="spotifyResult.thumbnail" alt="Cover" class="media-cover" referrerpolicy="no-referrer" />
          </div>
          <div class="meta-info">
            <h2>{{ spotifyResult.title }}</h2>
            <p class="artist-name">{{ spotifyResult.artist }}</p>
            <p v-if="spotifyResult.album" class="meta-row">{{ spotifyResult.album }}</p>
            <p v-if="spotifyResult.duration" class="meta-row">{{ t('duration') }}: {{ formatDuration(spotifyResult.duration) }}</p>
          </div>
          <div class="download-actions">
            <button v-if="spotifyResult.downloadUrl" class="btn-download" @click="proxyDownload(spotifyResult.downloadUrl, spotifyResult.title + '.mp3')">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="button-icon"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
              {{ t('audioOnly') }}
            </button>
            <span v-else class="no-link">{{ t('noDirectLink') }}</span>
            <div class="reset-wrapper text-center">
              <button class="btn-secondary" @click="handleReset">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="button-icon"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                {{ t('downloadAnother') }}
              </button>
            </div>
          </div>
        </div>

        <!-- TikTok Result -->
        <div v-if="selectedPlatform === 'tiktok' && tiktokResult" class="media-details">

          <!-- Slideshow / Photo mode -->
          <template v-if="tiktokResult.images.length > 0">
            <div class="slideshow-header">
              <div class="slideshow-meta">
                <span class="slideshow-badge">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="inline-icon"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                  Slideshow · {{ tiktokResult.images.length }} foto
                </span>
                <h2>{{ tiktokResult.title }}</h2>
                <p class="artist-name">@{{ tiktokResult.author }}</p>
              </div>
            </div>

            <!-- Preview frame box -->
            <div class="photo-preview-frame">
              <!-- Photo grid -->
              <div class="photo-grid">
                <div
                  v-for="(imgUrl, idx) in tiktokResult.images"
                  :key="idx"
                  class="photo-item"
                  :class="{ 'photo-active': activePhotoIndex === idx }"
                  @click="handlePhotoClick(idx, imgUrl, `${tiktokResult!.title}_foto${Number(idx) + 1}.jpg`)"
                >
                  <img :src="imgUrl" :alt="`Foto ${Number(idx) + 1}`" class="photo-thumb" referrerpolicy="no-referrer" />
                  <div class="photo-overlay">
                    <button
                      class="photo-center-dl-btn"
                      @click.stop="proxyDownload(imgUrl, `${tiktokResult!.title}_foto${Number(idx) + 1}.jpg`); activePhotoIndex = null"
                      :title="`Unduh foto ${Number(idx) + 1}`"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Download all photos -->
            <div class="download-actions">
              <button
                class="btn-download"
                @click="tiktokResult!.images.forEach((url: any, i: any) => proxyDownload(url, `${tiktokResult!.title}_foto${Number(i) + 1}.jpg`))"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="button-icon"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                {{ t('downloadAllPhotos') }} ({{ tiktokResult.images.length }})
              </button>
              <button v-if="tiktokResult.audioUrl" class="btn-download secondary" @click="proxyDownload(tiktokResult.audioUrl, tiktokResult.title + '.mp3')">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="button-icon"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
                {{ t('audioOnly') }}
              </button>
              <div class="reset-wrapper text-center">
                <button class="btn-secondary" @click="handleReset">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="button-icon"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                  {{ t('downloadAnother') }}
                </button>
              </div>
            </div>
          </template>

          <!-- Normal video mode -->
          <template v-else>
            <div class="cover-wrapper video-wrapper" v-if="tiktokResult.videoNoWatermark || tiktokResult.videoWatermark || tiktokResult.thumbnail">
              <template v-if="!isVideoPlaying && tiktokResult.thumbnail">
                <img :src="tiktokResult.thumbnail" alt="Cover" class="media-cover" referrerpolicy="no-referrer" />
                <button class="play-overlay-btn" @click="isVideoPlaying = true">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                </button>
              </template>
              <video 
                v-else
                :src="getProxyUrl(tiktokResult.videoNoWatermark || tiktokResult.videoWatermark, true)"
                controls
                autoplay
                playsinline
                class="media-video"
              ></video>
            </div>
            <div class="meta-info">
              <h2>{{ tiktokResult.title }}</h2>
              <p class="artist-name">@{{ tiktokResult.author }}</p>
              <p v-if="tiktokResult.duration" class="meta-row">{{ t('duration') }}: {{ formatDuration(tiktokResult.duration) }}</p>
            </div>
            <div class="download-actions">
              <button v-if="tiktokResult.videoNoWatermark" class="btn-download" @click="proxyDownload(tiktokResult.videoNoWatermark, tiktokResult.title + '.mp4')">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="button-icon"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                {{ t('videoNoWatermark') }}
              </button>
              <button v-if="tiktokResult.videoWatermark" class="btn-download secondary" @click="proxyDownload(tiktokResult.videoWatermark, tiktokResult.title + '_wm.mp4')">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="button-icon"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                {{ t('videoWatermark') }}
              </button>
              <button v-if="tiktokResult.audioUrl" class="btn-download secondary" @click="proxyDownload(tiktokResult.audioUrl, tiktokResult.title + '.mp3')">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="button-icon"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
                {{ t('audioOnly') }}
              </button>
              <div class="reset-wrapper text-center">
                <button class="btn-secondary" @click="handleReset">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="button-icon"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                  {{ t('downloadAnother') }}
                </button>
              </div>
            </div>
          </template>
        </div>

        <!-- CapCut Result -->
        <div v-if="selectedPlatform === 'capcut' && capcutResult" class="media-details">
          <div class="cover-wrapper video-wrapper" v-if="capcutResult.videoUrl || capcutResult.thumbnail">
            <template v-if="!isVideoPlaying && capcutResult.thumbnail">
              <img :src="capcutResult.thumbnail" alt="Cover" class="media-cover" referrerpolicy="no-referrer" />
              <button class="play-overlay-btn" @click="isVideoPlaying = true">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
              </button>
            </template>
            <video 
              v-else
              :src="getProxyUrl(capcutResult.videoUrl, true)"
              controls
              autoplay
              playsinline
              class="media-video"
            ></video>
          </div>
          <div class="meta-info">
            <h2>{{ capcutResult.title }}</h2>
            <p v-if="capcutResult.size" class="meta-row">{{ t('size') }}: {{ capcutResult.size }}</p>
          </div>
          <div class="download-actions">
            <button v-if="capcutResult.videoUrl" class="btn-download" @click="proxyDownload(capcutResult.videoUrl, capcutResult.title + '.mp4')">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="button-icon"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              {{ t('downloadVideo') }}
            </button>
            <span v-else class="no-link">{{ t('noDirectLink') }}</span>
            <div class="reset-wrapper text-center">
              <button class="btn-secondary" @click="handleReset">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="button-icon"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                {{ t('downloadAnother') }}
              </button>
            </div>
          </div>
        </div>

        <!-- YouTube Result -->
        <div v-if="selectedPlatform === 'youtube' && youtubeResult" class="media-details">
          <div class="cover-wrapper wide video-wrapper" v-if="youtubeResult.videoUrl || youtubeResult.thumbnail">
            <template v-if="!isVideoPlaying && youtubeResult.thumbnail">
              <img :src="youtubeResult.thumbnail" alt="Thumbnail" class="media-cover" referrerpolicy="no-referrer" />
              <button class="play-overlay-btn" @click="isVideoPlaying = true">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
              </button>
            </template>
            <video 
              v-else
              :src="getProxyUrl(youtubeResult.videoUrl, true)"
              controls
              autoplay
              playsinline
              class="media-video"
            ></video>
          </div>
          <div class="meta-info">
            <h2>{{ youtubeResult.title }}</h2>
            <p class="artist-name">{{ youtubeResult.author }}</p>
            <p v-if="youtubeResult.duration" class="meta-row">{{ t('duration') }}: {{ formatDuration(youtubeResult.duration) }}</p>
          </div>
          <div class="download-actions">
            <button v-if="youtubeResult.videoUrl" class="btn-download" @click="proxyDownload(youtubeResult.videoUrl, youtubeResult.title + '.mp4')">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="button-icon"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              {{ t('downloadVideo') }}
            </button>
            <button v-if="youtubeResult.audioUrl" class="btn-download secondary" @click="proxyDownload(youtubeResult.audioUrl, youtubeResult.title + '.' + youtubeResult.audioExt)">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="button-icon"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
              {{ t('audioOnly') }}
            </button>
            <div class="reset-wrapper text-center">
              <button class="btn-secondary" @click="handleReset">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="button-icon"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                {{ t('downloadAnother') }}
              </button>
            </div>
          </div>
        </div>

        <!-- Instagram Result -->
        <div v-if="selectedPlatform === 'instagram' && instagramResult" class="media-details">
          <div class="cover-wrapper video-wrapper" v-if="instagramResult.videoUrl || instagramResult.thumbnail">
            <template v-if="!isVideoPlaying && instagramResult.thumbnail">
              <img :src="instagramResult.thumbnail" alt="Thumbnail" class="media-cover" referrerpolicy="no-referrer" />
              <button class="play-overlay-btn" @click="isVideoPlaying = true">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
              </button>
            </template>
            <video 
              v-else
              :src="getProxyUrl(instagramResult.videoUrl, true)"
              controls
              autoplay
              playsinline
              class="media-video"
            ></video>
          </div>
          <div class="meta-info">
            <h2>{{ instagramResult.title }}</h2>
            <p class="artist-name">{{ instagramResult.author }}</p>
          </div>
          <div class="download-actions">
            <template v-if="instagramResult.picker && instagramResult.picker.length > 0">
              <button
                v-for="(item, i) in instagramResult.picker"
                :key="i"
                class="btn-download"
                @click="proxyDownload(item.url, 'instagram_' + (Number(i)+1) + '.mp4')"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="button-icon"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                {{ t('downloadVideo') }} {{ instagramResult.picker.length > 1 ? `#${Number(i)+1}` : '' }}
              </button>
            </template>
            <button v-else-if="instagramResult.videoUrl" class="btn-download" @click="proxyDownload(instagramResult.videoUrl, 'instagram.mp4')">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="button-icon"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              {{ t('downloadVideo') }}
            </button>
            <span v-else class="no-link">{{ t('noDirectLink') }}</span>
            <div class="reset-wrapper text-center">
              <button class="btn-secondary" @click="handleReset">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="button-icon"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                {{ t('downloadAnother') }}
              </button>
            </div>
          </div>
        </div>

        <!-- Facebook Result -->
        <div v-if="selectedPlatform === 'facebook' && facebookResult" class="media-details">
          <div class="cover-wrapper video-wrapper" v-if="facebookResult.videoUrl || facebookResult.thumbnail">
            <template v-if="!isVideoPlaying && facebookResult.thumbnail">
              <img :src="facebookResult.thumbnail" alt="Thumbnail" class="media-cover" referrerpolicy="no-referrer" />
              <button class="play-overlay-btn" @click="isVideoPlaying = true">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
              </button>
            </template>
            <video 
              v-else
              :src="getProxyUrl(facebookResult.videoUrl, true)"
              controls
              autoplay
              playsinline
              class="media-video"
            ></video>
          </div>
          <div class="meta-info">
            <h2>{{ facebookResult.title }}</h2>
            <p class="artist-name">{{ facebookResult.author }}</p>
          </div>
          <div class="download-actions">
            <button v-if="facebookResult.videoUrl" class="btn-download" @click="proxyDownload(facebookResult.videoUrl, 'facebook.mp4')">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="button-icon"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              {{ t('downloadVideo') }}
            </button>
            <span v-else class="no-link">{{ t('noDirectLink') }}</span>
            <div class="reset-wrapper text-center">
              <button class="btn-secondary" @click="handleReset">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="button-icon"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                {{ t('downloadAnother') }}
              </button>
            </div>
          </div>
        </div>

        <!-- Twitter/X Result -->
        <div v-if="selectedPlatform === 'twitter' && twitterResult" class="media-details">
          <div class="cover-wrapper video-wrapper" v-if="twitterResult.videoUrl || twitterResult.thumbnail">
            <template v-if="!isVideoPlaying && twitterResult.thumbnail">
              <img :src="twitterResult.thumbnail" alt="Thumbnail" class="media-cover" referrerpolicy="no-referrer" />
              <button class="play-overlay-btn" @click="isVideoPlaying = true">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
              </button>
            </template>
            <video 
              v-else
              :src="getProxyUrl(twitterResult.videoUrl, true)"
              controls
              autoplay
              playsinline
              class="media-video"
            ></video>
          </div>
          <div class="meta-info">
            <h2>{{ twitterResult.title }}</h2>
            <p class="artist-name">{{ twitterResult.author }}</p>
          </div>
          <div class="download-actions">
            <button v-if="twitterResult.videoUrl" class="btn-download" @click="proxyDownload(twitterResult.videoUrl, 'twitter.mp4')">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="button-icon"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              {{ t('downloadVideo') }}
            </button>
            <span v-else class="no-link">{{ t('noDirectLink') }}</span>
            <div class="reset-wrapper text-center">
              <button class="btn-secondary" @click="handleReset">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="button-icon"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                {{ t('downloadAnother') }}
              </button>
            </div>
          </div>
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
  min-height: 0;
  flex-grow: 1;
}

.step-container {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  animation: slideUp var(--transition-smooth);
}

.text-center { text-align: center; }

.subtitle {
  margin-top: 8px;
  color: var(--text-secondary);
}

.form-container {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  margin-top: var(--spacing-sm);
}

.input-wrapper {
  position: relative;
  width: 100%;
}

.input-action-btn {
  position: absolute;
  top: 50%;
  right: 8px;
  transform: translateY(-50%);
  background: var(--bg-tertiary);
  border: none;
  border-radius: 8px;
  color: var(--text-primary);
  padding: 6px 12px;
  font-size: 0.8rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.input-action-btn:hover {
  background: var(--accent-color);
  color: var(--bg-primary);
}

.input-action-btn.clear-btn {
  padding: 8px;
  border-radius: 50%;
  background: transparent;
  color: var(--text-secondary);
}

.input-action-btn.clear-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.btn-paste-download {
  min-height: 56px;
  padding: 0 var(--spacing-lg);
  border-radius: var(--border-radius);
  border: 1.5px dashed color-mix(in srgb, var(--text-secondary) 30%, transparent);
  background-color: transparent;
  color: var(--text-primary);
  font-weight: 600;
  font-family: inherit;
  font-size: 1rem;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  transition: all var(--transition-fast);
}

.btn-paste-download:hover {
  background-color: rgba(var(--accent-rgb), 0.04);
  border-color: var(--accent-color);
  transform: translateY(-1px);
}

.btn-paste-download:active {
  transform: scale(0.98);
}

/* ── Platform Grid ── */
.platform-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

@media (max-width: 480px) {
  .platform-grid {
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
  }
}

.platform-badge {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 10px 6px;
  border-radius: 12px;
  background: var(--bg-secondary);
  border: 1.5px solid transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: all var(--transition-fast);
  font-family: inherit;
}

.platform-badge:hover {
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  transform: translateY(-1px);
}

.platform-badge.active {
  background: color-mix(in srgb, var(--active-color) 12%, transparent);
  border-color: color-mix(in srgb, var(--active-color) 40%, transparent);
  color: var(--active-color);
  transform: translateY(-1px);
  box-shadow: 0 4px 16px color-mix(in srgb, var(--active-color) 15%, transparent);
}

.platform-icon {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.platform-icon svg {
  width: 18px;
  height: 18px;
}

.platform-label {
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  white-space: nowrap;
}

.supported-note {
  text-align: center;
  font-size: 0.75rem;
  color: var(--text-tertiary);
  margin-top: -8px;
}

/* ── Processing State ── */
.processing-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex-grow: 1;
  height: 100%;
  gap: 16px;
}

.loader-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: var(--spacing-md);
}

.spinner-ring {
  width: 48px;
  height: 48px;
  border: 3px solid rgba(var(--accent-rgb), 0.08);
  border-top-color: var(--accent-color);
  border-radius: 50%;
  animation: spin 0.9s ease-in-out infinite;
}

/* ── Result Card ── */
.result-card {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.result-platform-badge {
  display: inline-block;
  align-self: flex-start;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding: 4px 12px;
  border-radius: 20px;
}

.media-details {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  align-items: center;
}

.media-details h2 {
  font-size: 1.25rem;
  line-height: 1.4;
  font-weight: 600;
  margin: 0;
  word-break: break-word;
}

.cover-wrapper {
  position: relative;
  width: 100%;
  max-width: 200px;
  aspect-ratio: 1;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
  background: var(--bg-secondary);
}

.cover-wrapper.wide {
  max-width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: 12px;
}

/* Responsive aspect-ratio video wrapper */
.cover-wrapper.video-wrapper {
  aspect-ratio: auto !important;
  width: auto !important;
  max-width: 100% !important;
  height: 200px; /* fixed height on mobile */
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cover-wrapper.video-wrapper.wide {
  max-width: 320px !important;
  aspect-ratio: 16 / 9 !important;
  height: auto !important;
  width: 100% !important;
}

.media-cover, .media-video {
  width: 100%;
  height: 100%;
  display: block;
}

.media-cover {
  object-fit: cover;
}

.media-video {
  width: auto;
  max-width: 100%;
  height: 100%;
  object-fit: contain;
  background: transparent;
}

@media (min-width: 768px) {
  .cover-wrapper.video-wrapper {
    height: 240px; /* larger height on desktop */
  }
}

.meta-info {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  width: 100%;
}

.artist-name {
  font-size: 1rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.meta-row {
  font-size: 0.82rem;
  color: var(--text-tertiary);
}

/* ── Download Buttons ── */
.download-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  max-width: 340px;
}

.btn-download {
  min-height: 52px;
  padding: 0 var(--spacing-md);
  border-radius: 14px;
  border: none;
  background: var(--accent-color);
  color: var(--bg-primary);
  font-weight: 600;
  font-family: inherit;
  font-size: 0.95rem;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  text-decoration: none;
  transition: all var(--transition-fast);
}

.btn-download:hover {
  background: var(--accent-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(var(--accent-rgb), 0.2);
}

.btn-download:active { transform: scale(0.98); }

.btn-download.secondary {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.btn-download.secondary:hover {
  background: var(--bg-tertiary);
  box-shadow: none;
}

.dl-icon {
  font-size: 1.1rem;
  font-weight: 700;
}

.no-link {
  color: var(--text-tertiary);
  font-size: 0.9rem;
  text-align: center;
  padding: var(--spacing-sm);
}

.reset-wrapper {
  margin-top: var(--spacing-sm);
  display: flex;
  justify-content: center;
  width: 100%;
}

.reset-wrapper .btn-secondary {
  width: 100%;
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ── Slideshow / Photo Grid ── */
.slideshow-header {
  width: 100%;
  text-align: center;
}

.slideshow-meta {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.slideshow-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 0, 80, 0.12);
  color: var(--tiktok-color);
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  padding: 4px 12px;
  margin-bottom: 4px;
}

.photo-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  width: 100%;
  max-width: 500px;
  margin: 0 auto;
}

@media (max-width: 360px) {
  .photo-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

.photo-item {
  position: relative;
  aspect-ratio: 2 / 3;
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  background: var(--bg-secondary);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.photo-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.25);
}

.photo-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: filter 0.3s ease, transform 0.3s ease;
}

/* Photo Overlay */
.photo-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.3);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s ease;
}

/* Show overlay on hover or active click */
.photo-item:hover .photo-overlay,
.photo-item.photo-active .photo-overlay {
  opacity: 1;
  pointer-events: auto;
}

/* Blur and dim thumbnail on hover or active */
.photo-item:hover .photo-thumb,
.photo-item.photo-active .photo-thumb {
  filter: blur(4px) brightness(0.65);
}

/* Center Download Button */
.photo-center-dl-btn {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: none;
  background: var(--accent-color);
  color: var(--bg-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  transform: scale(0.8);
  transition: transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275), background-color 0.2s;
}

.photo-item:hover .photo-center-dl-btn,
.photo-item.photo-active .photo-center-dl-btn {
  transform: scale(1);
}

.photo-center-dl-btn:hover {
  background: #ffffff !important;
  color: #000000 !important;
  transform: scale(1.1) !important;
}

@media (min-width: 768px) {
  /* Reduce gap in step-container on desktop */
  .step-container {
    gap: 16px !important;
  }

  /* Center & limit input form container width on desktop */
  .form-container {
    max-width: 800px;
    margin: 0 auto;
    width: 100%;
    gap: 16px !important;
  }

  /* Hide redundant supported text below platform badges */
  .supported-note {
    display: none !important;
  }

  /* Stretch platforms horizontally to one line */
  .platform-grid {
    grid-template-columns: repeat(7, 1fr) !important;
    gap: 12px;
  }

  /* Two column result card layout */
  .media-details {
    display: grid !important;
    grid-template-columns: 320px 1fr;
    grid-template-rows: auto auto;
    gap: var(--spacing-lg);
    align-items: start;
    text-align: left;
    width: 100%;
  }

  .media-details .cover-wrapper {
    grid-column: 1;
    grid-row: 1;
    max-width: 100%;
  }

  .media-details .meta-info {
    grid-column: 1;
    grid-row: 2;
    text-align: left;
    align-items: flex-start;
  }

  .media-details .download-actions {
    grid-column: 2;
    grid-row: 1 / span 2;
    max-width: 100%;
  }

  /* Special handling for TikTok Slideshow mode (preview frame + buttons) */
  .media-details:has(.photo-preview-frame) {
    grid-template-columns: 350px 1fr !important;
    grid-template-rows: auto 1fr !important;
  }

  .media-details:has(.photo-preview-frame) .slideshow-header {
    grid-column: 1;
    grid-row: 1;
    text-align: left;
  }

  .media-details:has(.photo-preview-frame) .download-actions {
    grid-column: 1;
    grid-row: 2;
    max-width: 100%;
    align-self: start;
  }

  .media-details:has(.photo-preview-frame) .photo-preview-frame {
    grid-column: 2;
    grid-row: 1 / span 2;
    max-width: 100% !important;
  }
}

/* Global photo preview frame box style */
.photo-preview-frame {
  width: 100%;
  box-sizing: border-box;
  scroll-behavior: smooth;
  -webkit-overflow-scrolling: touch;
  
  /* Mobile default styles - dynamic height */
  height: calc(100vh - 350px);
  min-height: 280px;
  max-height: 420px;
  overflow-y: auto;
  background: var(--bg-secondary);
  border: 1px solid var(--bg-tertiary);
  border-radius: var(--border-radius);
  padding: 12px;
  box-shadow: inset 0 4px 10px rgba(0, 0, 0, 0.25);
  /* Hide Firefox scrollbar */
  scrollbar-width: none;
}

/* Hide Chrome/Safari scrollbar globally */
.photo-preview-frame::-webkit-scrollbar {
  display: none;
}

@media (min-width: 768px) {
  .photo-preview-frame {
    height: calc(100vh - 280px);
    min-height: 380px;
    max-height: 520px;
    border-width: 1.5px;
    padding: 16px;
  }

  .photo-preview-frame .photo-grid {
    grid-template-columns: repeat(5, 1fr) !important;
    max-width: 100% !important;
  }
}

@media (min-width: 1024px) {
  .photo-preview-frame .photo-grid {
    grid-template-columns: repeat(6, 1fr) !important;
  }
}

/* Play button overlay premium styling */
.video-wrapper {
  position: relative;
  cursor: pointer;
}

.play-overlay-btn {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 50px;
  height: 50px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.25);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
  transition: all 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.play-overlay-btn svg {
  margin-left: 2px;
  width: 22px;
  height: 22px;
  transition: transform 0.2s ease;
}

.play-overlay-btn:hover {
  background: var(--accent-color) !important;
  color: var(--bg-primary) !important;
  transform: translate(-50%, -50%) scale(1.1) !important;
  box-shadow: 0 8px 24px rgba(var(--accent-rgb), 0.4) !important;
}
</style>
