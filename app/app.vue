<!--
  app/app.vue — the whole single-page UI.

  It shows ONE of two screens:
    • Login  — username + password + a LANGUAGE toggle. Sign in posts to
      /api/login; on success we flip to the chat screen.
    • Chat   — the investor-panel analysis UI (multi-select lenses + streaming
      Markdown answers), now fully localized + with its own language switcher so
      anyone who forgot to pick a language at login can still change it.

  Language handling:
    • `lang` is the single source of truth, persisted to localStorage so a reload
      keeps your choice.
    • Every visible string comes from app/i18n.ts via t(lang, key) — never
      hard-coded — so switching `lang` re-renders the whole UI instantly.
    • `lang` is also sent in the body of every /api/chat request, so the AI
      answers in the chosen language too.
-->
<script setup lang="ts">
import { Chat } from '@ai-sdk/vue'
import { marked } from 'marked'
import { computed, onMounted, ref } from 'vue'
import { DEFAULT_EXPERT_ID, EXPERTS } from './experts'
import { asLang, DEFAULT_LANG, type Lang, LANGS, type MessageKey, t } from './i18n'

marked.use({ gfm: true, breaks: true })

// ——— language ———————————————————————————————————————————————————————————
const lang = ref<Lang>(DEFAULT_LANG)

// A tiny local helper so templates can write `tr('send')` instead of
// `t(lang.value, 'send')`. It's reactive because it reads lang.value.
function tr(key: MessageKey): string {
  return t(lang.value, key)
}

function setLang(next: Lang) {
  lang.value = next
  if (import.meta.client)
    localStorage.setItem('sa_lang', next)
}

// ——— auth / which screen to show ————————————————————————————————————————
const authed = ref(false)
const username = ref('')
const password = ref('')
const loginError = ref('')
const loggingIn = ref(false)

// Restore remembered language + signed-in flag on first mount (client only).
// The real gate is the httpOnly cookie checked by the server; this flag just
// decides which screen to render so a refresh doesn't bounce you to login.
onMounted(() => {
  lang.value = asLang(localStorage.getItem('sa_lang'))
  authed.value = localStorage.getItem('sa_authed') === '1'
})

async function onLogin() {
  loginError.value = ''
  loggingIn.value = true
  try {
    await $fetch('/api/login', {
      method: 'POST',
      body: { username: username.value, password: password.value },
    })
    authed.value = true
    if (import.meta.client)
      localStorage.setItem('sa_authed', '1')
    password.value = ''
  }
  catch (err: any) {
    loginError.value = err?.statusCode === 401 ? tr('wrongPassword') : tr('loginFailed')
  }
  finally {
    loggingIn.value = false
  }
}

async function onLogout() {
  try {
    await $fetch('/api/logout', { method: 'POST' })
  }
  finally {
    authed.value = false
    if (import.meta.client)
      localStorage.removeItem('sa_authed')
  }
}

// ——— chat ————————————————————————————————————————————————————————————————
const chat = new Chat({})
const input = ref('')

// Multi-select: which analyst lenses are active. Starts with the default one.
const selectedIds = ref<string[]>([DEFAULT_EXPERT_ID])

function toggle(id: string) {
  const i = selectedIds.value.indexOf(id)
  if (i === -1)
    selectedIds.value.push(id)
  else if (selectedIds.value.length > 1) // keep at least one selected
    selectedIds.value.splice(i, 1)
}

const busy = computed(() => chat.status === 'streaming' || chat.status === 'submitted')

function onSubmit() {
  const text = input.value.trim()
  if (!text)
    return
  // The second arg's `body` is merged into the POST to /api/chat, so the server
  // knows which analyst panel AND which language to use for THIS message.
  chat.sendMessage({ text }, { body: { expertIds: selectedIds.value, lang: lang.value } })
  input.value = ''
}

// Concatenate an assistant message's text parts and render them as Markdown.
function renderMarkdown(message: any): string {
  const text = message.parts
    .filter((p: any) => p.type === 'text')
    .map((p: any) => p.text)
    .join('')
  return marked.parse(text) as string
}

// Labels for any tool the agent invoked, shown above the answer (localized).
function toolLabels(message: any): string[] {
  return message.parts
    .filter((p: any) => typeof p?.type === 'string' && p.type.startsWith('tool-'))
    .map((p: any) => {
      const ticker = p.input?.ticker ?? p.args?.ticker
      return ticker ? `📊 ${tr('pulledFor')} ${ticker}` : `📊 ${tr('pulled')}`
    })
}
</script>

<template>
  <!-- ===================== LOGIN SCREEN ===================== -->
  <main v-if="!authed" class="login-page">
    <div class="login-card">
      <h1>{{ tr('appTitle') }}</h1>
      <p class="subtitle">
        {{ tr('loginSubtitle') }}
      </p>

      <!-- Language toggle — present right here on the login page. -->
      <div class="lang-row">
        <span class="lang-label">{{ tr('languageLabel') }}</span>
        <button
          v-for="l in LANGS"
          :key="l.id"
          type="button"
          class="lang-btn"
          :class="{ on: lang === l.id }"
          @click="setLang(l.id)"
        >
          {{ l.label }}
        </button>
      </div>

      <form @submit.prevent="onLogin">
        <label class="field">
          <span>{{ tr('usernameLabel') }}</span>
          <input v-model="username" :placeholder="tr('usernamePlaceholder')" autocomplete="username">
        </label>
        <label class="field">
          <span>{{ tr('passwordLabel') }}</span>
          <input v-model="password" type="password" :placeholder="tr('passwordPlaceholder')" autocomplete="current-password">
        </label>

        <p v-if="loginError" class="error">
          {{ loginError }}
        </p>

        <button type="submit" class="primary" :disabled="loggingIn">
          {{ loggingIn ? tr('loggingIn') : tr('loginButton') }}
        </button>
      </form>
    </div>
  </main>

  <!-- ===================== CHAT SCREEN ====================== -->
  <main v-else class="page">
    <header class="top">
      <h1>{{ tr('appTitle') }}</h1>
      <div class="top-right">
        <!-- Small language switcher for anyone who forgot to pick at login. -->
        <div class="lang-mini">
          <button
            v-for="l in LANGS"
            :key="l.id"
            type="button"
            class="lang-btn sm"
            :class="{ on: lang === l.id }"
            @click="setLang(l.id)"
          >
            {{ l.label }}
          </button>
        </div>
        <button type="button" class="logout" @click="onLogout">
          {{ tr('logout') }}
        </button>
      </div>
    </header>

    <div class="roster">
      <span class="roster-label">{{ tr('rosterLabel') }} ({{ selectedIds.length }}):</span>
      <button
        v-for="e in EXPERTS"
        :key="e.id"
        type="button"
        class="chip"
        :class="{ on: selectedIds.includes(e.id) }"
        :title="e.tagline"
        @click="toggle(e.id)"
      >
        {{ selectedIds.includes(e.id) ? '✓ ' : '' }}{{ e.name }}
      </button>
    </div>

    <div class="messages">
      <p v-if="chat.messages.length === 0" class="hint">
        {{ tr('emptyHint') }}
      </p>

      <div
        v-for="message in chat.messages"
        :key="message.id"
        class="msg"
        :class="message.role"
      >
        <strong>{{ message.role === 'user' ? tr('you') : tr('panel') }}</strong>

        <!-- User text: plain. Assistant: rendered Markdown (tables, bullets, etc.) -->
        <template v-if="message.role === 'user'">
          <template v-for="(part, i) in message.parts" :key="i">
            <span v-if="part.type === 'text'">{{ part.text }}</span>
          </template>
        </template>
        <template v-else>
          <span v-for="(label, i) in toolLabels(message)" :key="`t${i}`" class="tool">{{ label }}</span>
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div class="markdown" v-html="renderMarkdown(message)" />
        </template>
      </div>

      <p v-if="chat.status === 'submitted'" class="hint">
        {{ tr('analyzing') }}
      </p>
    </div>

    <form class="composer" @submit.prevent="onSubmit">
      <input
        v-model="input"
        :placeholder="tr('composerPlaceholder')"
        :disabled="busy"
      >
      <button type="submit">
        {{ tr('send') }}
      </button>
    </form>
  </main>
</template>

<style>
body { margin: 0; font-family: system-ui, sans-serif; background: #0f172a; color: #e2e8f0; }
.page { max-width: 760px; margin: 0 auto; padding: 1.5rem; display: flex; flex-direction: column; height: 100vh; box-sizing: border-box; }
.top { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.top-right { display: flex; align-items: center; gap: 0.6rem; }
h1 { font-size: 1.3rem; margin: 0; }

/* Language buttons (shared by login + mini switcher). */
.lang-btn { font-size: 0.8rem; padding: 0.3rem 0.7rem; border-radius: 999px; border: 1px solid #334155; background: #1e293b; color: #cbd5e1; cursor: pointer; transition: all 0.12s; }
.lang-btn:hover { border-color: #475569; }
.lang-btn.on { background: #1d4ed8; border-color: #3b82f6; color: white; font-weight: 600; }
.lang-btn.sm { font-size: 0.72rem; padding: 0.22rem 0.55rem; }
.lang-mini { display: flex; gap: 0.3rem; }
.logout { font-size: 0.78rem; padding: 0.3rem 0.7rem; border-radius: 0.5rem; border: 1px solid #334155; background: transparent; color: #cbd5e1; cursor: pointer; }
.logout:hover { border-color: #ef4444; color: #fca5a5; }

/* — login screen — */
.login-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 1.5rem; box-sizing: border-box; }
.login-card { width: 100%; max-width: 380px; background: #1e293b; border: 1px solid #334155; border-radius: 0.9rem; padding: 1.6rem; }
.login-card h1 { font-size: 1.25rem; margin: 0 0 0.4rem; }
.subtitle { opacity: 0.7; font-size: 0.88rem; margin: 0 0 1.1rem; line-height: 1.4; }
.lang-row { display: flex; align-items: center; gap: 0.4rem; margin-bottom: 1.1rem; flex-wrap: wrap; }
.lang-label { font-size: 0.8rem; opacity: 0.7; margin-right: 0.2rem; }
.field { display: block; margin-bottom: 0.8rem; }
.field span { display: block; font-size: 0.8rem; opacity: 0.8; margin-bottom: 0.3rem; }
.field input { width: 100%; box-sizing: border-box; padding: 0.6rem 0.7rem; border-radius: 0.5rem; border: 1px solid #334155; background: #0f172a; color: inherit; }
.field input:focus { outline: none; border-color: #3b82f6; }
.error { color: #fca5a5; font-size: 0.82rem; margin: 0.2rem 0 0.6rem; }
.primary { width: 100%; padding: 0.7rem; border: none; border-radius: 0.5rem; background: #3b82f6; color: white; font-weight: 600; cursor: pointer; }
.primary:hover { background: #2563eb; }
.primary:disabled { opacity: 0.6; cursor: default; }

.roster { display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: center; margin: 0.5rem 0 0.75rem; }
.roster-label { font-size: 0.8rem; opacity: 0.7; margin-right: 0.25rem; }
.chip { font-size: 0.8rem; padding: 0.3rem 0.6rem; border-radius: 999px; border: 1px solid #334155; background: #1e293b; color: #cbd5e1; cursor: pointer; transition: all 0.12s; }
.chip:hover { border-color: #475569; }
.chip.on { background: #1d4ed8; border-color: #3b82f6; color: white; font-weight: 600; }

.messages { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 0.75rem; padding: 0.5rem 0; }
.msg { padding: 0.7rem 0.9rem; border-radius: 0.6rem; line-height: 1.5; }
.msg.user { background: #1e3a8a; align-self: flex-end; white-space: pre-wrap; }
.msg.assistant { background: #1e293b; align-self: flex-start; width: 100%; box-sizing: border-box; }
.msg strong { display: block; font-size: 0.75rem; opacity: 0.7; margin-bottom: 0.3rem; }
.tool { display: block; font-size: 0.8rem; opacity: 0.6; font-style: italic; margin: 0.1rem 0; }
.hint { opacity: 0.6; font-style: italic; }

/* Markdown styling — tables, headings, bullets, the bottom-line callout. */
.markdown h2 { font-size: 1.02rem; margin: 0.9rem 0 0.4rem; color: #f1f5f9; }
.markdown h3 { font-size: 0.92rem; margin: 0.7rem 0 0.3rem; color: #e2e8f0; }
.markdown p { margin: 0.4rem 0; }
.markdown ul { margin: 0.3rem 0; padding-left: 1.2rem; }
.markdown li { margin: 0.15rem 0; }
.markdown table { border-collapse: collapse; width: 100%; margin: 0.5rem 0; font-size: 0.85rem; }
.markdown th, .markdown td { border: 1px solid #334155; padding: 0.35rem 0.55rem; text-align: left; }
.markdown th { background: #0f172a; font-weight: 600; }
.markdown tr:nth-child(even) td { background: #172033; }
.markdown strong { color: #f8fafc; }
.markdown hr { border: none; border-top: 1px solid #334155; margin: 0.6rem 0; }
.markdown em { color: #94a3b8; }

.composer { display: flex; gap: 0.5rem; padding-top: 0.5rem; }
.composer input { flex: 1; padding: 0.7rem; border-radius: 0.5rem; border: 1px solid #334155; background: #1e293b; color: inherit; }
.composer button { padding: 0.7rem 1.2rem; border: none; border-radius: 0.5rem; background: #3b82f6; color: white; font-weight: 600; cursor: pointer; }
.composer button:hover { background: #2563eb; }
</style>
