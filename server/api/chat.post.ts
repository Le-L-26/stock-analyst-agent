// server/api/chat.post.ts
//
// This is the AGENT'S BRAIN. It runs ONLY on the server (Nitro), never in the
// browser — that's where the secret ANTHROPIC_API_KEY lives.
//
//   server/api/chat.post.ts  ->  POST /api/chat
//
// What makes this an *agent* and not just a chatbot: the `tools` block below.
// We hand the model a `getStockFinancials` capability. When the user asks about a
// stock, the model decides on its own to CALL that tool, we run it (fetching real
// numbers from the Python data bridge), feed the result back, and the model then
// reasons over the real data — all in one streamed turn thanks to `stopWhen`.

import { anthropic } from '@ai-sdk/anthropic'
import { convertToModelMessages, stepCountIs, streamText, tool, type UIMessage } from 'ai'
import { z } from 'zod'
import { getExperts } from '../../app/experts'

// Where the Python data bridge (scripts/agent_bridge.py) is listening. Override
// with DATA_BRIDGE_URL in .env if you run it on another port/host.
const DATA_BRIDGE_URL = process.env.DATA_BRIDGE_URL || 'http://127.0.0.1:8077'

// Shared secret proving to the bridge that this request comes from us (the Nuxt
// app), not a random caller who found the bridge's public URL. Must match the
// BRIDGE_TOKEN set on the Python bridge. Empty in local dev = no header sent,
// which is fine because the local bridge also has no token configured.
const BRIDGE_TOKEN = process.env.BRIDGE_TOKEN || ''

// Build the system prompt for one OR several analysts. The output-format rules
// are the same either way; only the "panel vs solo" framing changes.
function buildSystemPrompt(experts: { name: string, philosophy: string }[]): string {
  const multi = experts.length > 1
  const roster = experts
    .map(e => `### ${e.name}\n${e.philosophy}`)
    .join('\n\n')

  return [
    multi
      ? `You are a panel of ${experts.length} legendary investors analyzing a stock. Each member `
        + 'reasons strictly in their own style. The panelists are:'
      : 'You are a stock-analysis agent reasoning in the style of this investor:',
    '',
    roster,
    '',
    '## How to work',
    '- When the user names a company or ticker, FIRST call the getStockFinancials tool to pull '
    + 'real fundamentals. Never invent numbers. US/foreign stocks use their symbol (AAPL, MSFT); '
    + 'Chinese A-shares use the 6-digit code (e.g. 600519 for Kweichow Moutai).',
    '- Call the tool once per distinct ticker (the same data serves every analyst).',
    '- Map signals to emoji: 🟢 bullish, 🔴 bearish, 🟡 neutral.',
    '',
    '## Output format — follow EXACTLY. Be concise; use tables and bullets, NOT long paragraphs.',
    '',
    '**1. Key financials** — a compact Markdown table of the metrics that matter '
    + '(valuation, margins, returns, growth, balance sheet). State the reporting currency in the heading.',
    '',
    multi
      ? '**2. Panel verdict** — a Markdown table with columns: `Analyst | Signal | Confidence (0-100) | '
        + 'One-line reason`. One row per analyst.'
      : '**2. Verdict** — a one-line table: `Signal | Confidence (0-100) | One-line reason`.',
    '',
    multi
      ? '**3. Per-analyst notes** — for EACH analyst, a short bolded header `**Name — 🟢/🔴/🟡 Signal '
        + '(confidence)**` followed by 2-4 tight bullet points citing specific metrics. No paragraphs.'
      : '**3. Reasoning** — 3-5 tight bullet points citing the specific metrics that drove the call. '
        + 'No paragraphs.',
    '',
    multi
      ? '**4. ✅ Bottom line** — a clear, bolded conclusion: where the panel agrees, where it splits, '
        + 'and the overall lean. Make it impossible to miss.'
      : '**4. ✅ Bottom line** — one or two bolded sentences with the clear takeaway.',
    '',
    'End with a single italic line: *Educational analysis, not investment advice.*',
  ].join('\n')
}

export default defineEventHandler(async (event) => {
  // The browser sends the full conversation plus which expert lens(es) to use.
  // `expertIds` is the new multi-select field; `expertId` kept for backwards compat.
  const { messages, expertIds, expertId } = await readBody<{
    messages: UIMessage[]
    expertIds?: string[]
    expertId?: string
  }>(event)

  const experts = getExperts(expertIds ?? (expertId ? [expertId] : []))

  const result = streamText({
    model: anthropic('claude-opus-4-8'),
    system: buildSystemPrompt(experts),
    messages: await convertToModelMessages(messages),

    // Let the model run a multi-step loop: call the tool, read the result, then
    // answer. Without this it would stop after emitting the tool call.
    stopWhen: stepCountIs(5),

    tools: {
      getStockFinancials: tool({
        description:
          'Fetch real, up-to-date financial fundamentals for a public company: valuation '
          + 'ratios, margins, returns, growth, balance-sheet health, market cap, and recent news. '
          + 'Works for US/foreign tickers and Chinese A-shares (6-digit codes).',
        inputSchema: z.object({
          ticker: z
            .string()
            .describe('Ticker symbol. US/foreign: AAPL, MSFT, NVDA. A-share: 600519, 000001.'),
        }),
        async execute({ ticker }) {
          const url = `${DATA_BRIDGE_URL}/financials?ticker=${encodeURIComponent(ticker)}`
          try {
            const res = await $fetch(url, {
              timeout: 30_000,
              headers: BRIDGE_TOKEN ? { 'X-Bridge-Token': BRIDGE_TOKEN } : {},
            })
            return res
          }
          catch (err: any) {
            // Hand the model a structured error so it can tell the user gracefully
            // instead of the whole turn crashing.
            return {
              error: true,
              message:
                `Could not fetch data for "${ticker}". Is the data bridge running on `
                + `${DATA_BRIDGE_URL}? (${err?.message ?? err})`,
            }
          }
        },
      }),
    },
  })

  return result.toUIMessageStreamResponse({
    // Surface the real error text (the SDK hides it as "An error occurred" by default).
    onError(error) {
      console.error('[chat] streamText error:', error)
      return error instanceof Error ? error.message : String(error)
    },
  })
})
