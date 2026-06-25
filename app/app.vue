<!--
  app/app.vue — the CHAT UI (runs in the browser).

  The `Chat` object from @ai-sdk/vue manages the conversation and streaming.
  Two features here:
    1. A multi-select roster of investor "lenses" — pick one or several. The
       chosen ids ride along in the request body to /api/chat.
    2. Markdown rendering (via `marked`) so the agent's tables, bullet points and
       bold conclusions display properly instead of as raw text.
-->
<script setup lang="ts">
import { Chat } from '@ai-sdk/vue'
import { marked } from 'marked'
import { ref } from 'vue'
import { DEFAULT_EXPERT_ID, EXPERTS } from './experts'

marked.use({ gfm: true, breaks: true })

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

function onSubmit() {
  const text = input.value.trim()
  if (!text)
    return
  // The second arg's `body` is merged into the POST to /api/chat, so the server
  // knows which analyst panel to use for THIS message.
  chat.sendMessage({ text }, { body: { expertIds: selectedIds.value } })
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

// Labels for any tool the agent invoked, shown above the answer.
function toolLabels(message: any): string[] {
  return message.parts
    .filter((p: any) => typeof p?.type === 'string' && p.type.startsWith('tool-'))
    .map((p: any) => {
      const ticker = p.input?.ticker ?? p.args?.ticker
      return ticker ? `📊 Pulled financials for ${ticker}` : '📊 Pulled financials'
    })
}
</script>

<template>
  <main class="page">
    <header class="top">
      <h1>📈 Stock Analyst Agent</h1>
    </header>

    <div class="roster">
      <span class="roster-label">Analyze with ({{ selectedIds.length }}):</span>
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
        Pick one or more analysts, then ask about a stock — e.g. “What do you think of NVDA?” or “Analyze 600519”.
      </p>

      <div
        v-for="message in chat.messages"
        :key="message.id"
        class="msg"
        :class="message.role"
      >
        <strong>{{ message.role === 'user' ? 'You' : 'Analyst panel' }}</strong>

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
        Panel is analyzing…
      </p>
    </div>

    <form class="composer" @submit.prevent="onSubmit">
      <input
        v-model="input"
        placeholder="Name a stock or ticker…"
        :disabled="chat.status === 'streaming' || chat.status === 'submitted'"
      >
      <button type="submit">
        Send
      </button>
    </form>
  </main>
</template>

<style>
body { margin: 0; font-family: system-ui, sans-serif; background: #0f172a; color: #e2e8f0; }
.page { max-width: 760px; margin: 0 auto; padding: 1.5rem; display: flex; flex-direction: column; height: 100vh; box-sizing: border-box; }
.top { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
h1 { font-size: 1.3rem; margin: 0; }

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
