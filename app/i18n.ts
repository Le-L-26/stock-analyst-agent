// app/i18n.ts
//
// All the UI text, in every language we support. ONE place to translate.
//
// How it works: every visible string has a key (e.g. `loginButton`). For each
// language we provide the translated value. The components ask for a string by
// key + current language instead of hard-coding English, so switching language
// is just switching which column of this table we read from.
//
// This file is imported by BOTH the browser (to render the UI) and the server
// (to keep the AI's disclaimer line in the right language), so — like
// experts.ts — it must stay free of secrets and server-only imports.

// The languages we offer. `id` is what we store/send around; `label` is shown
// on the language button (each written in its OWN language, the usual convention
// so a speaker can always recognise their own option).
export type Lang = 'en' | 'zh'

export const LANGS: { id: Lang, label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'zh', label: '简体中文' },
]

export const DEFAULT_LANG: Lang = 'en'

// The translation table. Same set of keys under every language.
//   en = English, zh = 简体中文 (Simplified Chinese)
export const MESSAGES = {
  en: {
    // — login screen —
    appTitle: '📈 Stock Analyst Agent',
    loginSubtitle: 'Sign in to analyze stocks with a panel of legendary investors.',
    languageLabel: 'Language',
    usernameLabel: 'Username',
    usernamePlaceholder: 'Anything you like',
    passwordLabel: 'Password',
    passwordPlaceholder: 'Site password',
    loginButton: 'Sign in',
    loggingIn: 'Signing in…',
    wrongPassword: 'Wrong password. Please try again.',
    loginFailed: 'Could not sign in. Please try again.',

    // — chat screen —
    rosterLabel: 'Analyze with',
    logout: 'Sign out',
    emptyHint: 'Pick one or more analysts, then ask about a stock — e.g. “What do you think of NVDA?” or “Analyze 600519”.',
    you: 'You',
    panel: 'Analyst panel',
    analyzing: 'Panel is analyzing…',
    composerPlaceholder: 'Name a stock or ticker…',
    send: 'Send',
    pulledFor: 'Pulled financials for', // followed by the ticker
    pulled: 'Pulled financials',
  },
  zh: {
    // — 登录页 —
    appTitle: '📈 股票分析智能体',
    loginSubtitle: '登录后，可让一组传奇投资人组成的“专家面板”为你分析股票。',
    languageLabel: '语言',
    usernameLabel: '用户名',
    usernamePlaceholder: '任意填写',
    passwordLabel: '密码',
    passwordPlaceholder: '站点密码',
    loginButton: '登录',
    loggingIn: '正在登录…',
    wrongPassword: '密码错误，请重试。',
    loginFailed: '登录失败，请重试。',

    // — 对话页 —
    rosterLabel: '分析视角',
    logout: '退出登录',
    emptyHint: '先选择一位或多位分析师，然后询问某只股票——例如“你怎么看 NVDA？”或“分析一下 600519”。',
    you: '你',
    panel: '专家面板',
    analyzing: '面板正在分析…',
    composerPlaceholder: '输入公司名称或股票代码…',
    send: '发送',
    pulledFor: '已获取财务数据：', // 后面接股票代码
    pulled: '已获取财务数据',
  },
} as const

// Keys you can ask for — derived from the English table so TypeScript catches typos.
export type MessageKey = keyof typeof MESSAGES['en']

/** Look up one UI string in the given language (falls back to English). */
export function t(lang: Lang, key: MessageKey): string {
  return MESSAGES[lang]?.[key] ?? MESSAGES.en[key]
}

/** Narrow an untrusted value (cookie, request body, localStorage) to a Lang. */
export function asLang(value: unknown): Lang {
  return value === 'zh' ? 'zh' : 'en'
}
