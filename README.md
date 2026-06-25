# Stock Analyst Agent

An AI stock-analysis agent that reasons in the voice of legendary investors
(Buffett, Graham, Munger, Wood, Burry, Lynch, Fisher, Damodaran). Pick one or
several "analysts", name a ticker, and the agent pulls **real** fundamentals and
returns a metric-cited verdict — solo or as a panel.

> Educational analysis, not investment advice.

## How it works

Two services:

1. **This app** (Nuxt 4 + Vercel AI SDK + Claude) — the UI and the agent brain.
   `server/api/chat.post.ts` streams from Claude and exposes a `getStockFinancials`
   tool. When you name a company, the model calls the tool, reads the real numbers,
   and reasons over them in one streamed turn.
2. **Data bridge** (Python/FastAPI, in the sibling `ai-hedge-fund` repo,
   `scripts/agent_bridge.py`) — fetches fundamentals from
   [financialdatasets.ai](https://financialdatasets.ai) for US/foreign tickers and
   from akshare for Chinese A-shares (6-digit codes like `600519`).

The agent never invents numbers; everything cited comes from the bridge.

## Local development

You need **both** services running.

```bash
# 1. Data bridge (in ../ai-hedge-fund, uses its Poetry env)
poetry run python scripts/agent_bridge.py        # serves http://127.0.0.1:8077

# 2. This app
cp .env.example .env        # then paste your ANTHROPIC_API_KEY
pnpm install
pnpm dev                    # http://localhost:2000
```

## Configuration

See [`.env.example`](.env.example). Summary:

| Var | Where | Purpose |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | this app | Claude API key (required) |
| `DATA_BRIDGE_URL` | this app | Bridge URL; defaults to `http://127.0.0.1:8077` |
| `BRIDGE_TOKEN` | both | Shared secret; must match on app and bridge |
| `SITE_PASSWORD` | this app | When set, locks the whole site behind HTTP Basic Auth |
| `FINANCIAL_DATASETS_API_KEY` | bridge | Data source for US/foreign fundamentals |

## Deploying (Render)

Each service has a Render Blueprint (`render.yaml`):

- **This repo** → a Node web service (build `pnpm build`, start `node .output/server/index.mjs`).
- **`ai-hedge-fund` repo** → a Docker web service running the bridge.

Push both repos to GitHub, then in Render: **New → Blueprint** for each. Fill the
`sync: false` secrets in the dashboard. Set the app's `DATA_BRIDGE_URL` to the
bridge's public URL and use the **same** `BRIDGE_TOKEN` on both. Set `SITE_PASSWORD`
so the public URL doesn't run up your API bill.

## Stack

Nuxt 4 · Vercel AI SDK (`ai`, `@ai-sdk/vue`, `@ai-sdk/anthropic`) · Claude · `zod` · `marked` · pnpm
