import type { ProviderDefinition } from "./types.js";

export const DEFAULT_PROVIDERS: readonly ProviderDefinition[] = [
  {
    id: "openai",
    name: "OpenAI",
    envVars: ["OPENAI_API_KEY"],
    authMethods: ["api-key", "env", "oauth-external"],
    docsUrl: "https://platform.openai.com/api-keys",
    notes: "API key is stable today. ChatGPT/Codex OAuth can be wired through pi-ai or an external CLI adapter.",
    models: [
      { id: "gpt-5.1", name: "GPT-5.1", tags: ["reasoning", "general"] },
      { id: "gpt-5-mini", name: "GPT-5 Mini", tags: ["fast", "general"] },
      { id: "gpt-5-nano", name: "GPT-5 Nano", tags: ["cheap", "fast"] }
    ]
  },
  {
    id: "anthropic",
    name: "Anthropic",
    envVars: ["ANTHROPIC_API_KEY"],
    authMethods: ["api-key", "env", "oauth-external"],
    docsUrl: "https://console.anthropic.com/settings/keys",
    notes: "Claude Pro/Max OAuth should be implemented by an adapter; API key works directly.",
    models: [
      { id: "claude-opus-4.5", name: "Claude Opus 4.5", tags: ["reasoning"] },
      { id: "claude-sonnet-4.5", name: "Claude Sonnet 4.5", tags: ["balanced"] },
      { id: "claude-haiku-4.5", name: "Claude Haiku 4.5", tags: ["fast"] }
    ]
  },
  {
    id: "google",
    name: "Google Gemini",
    envVars: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
    authMethods: ["api-key", "env", "oauth-external"],
    docsUrl: "https://aistudio.google.com/app/apikey",
    notes: "Gemini CLI OAuth can be wired through pi-ai or a dedicated adapter.",
    models: [
      { id: "gemini-3-pro", name: "Gemini 3 Pro", tags: ["reasoning"] },
      { id: "gemini-3-flash", name: "Gemini 3 Flash", tags: ["fast"] },
      { id: "gemini-2.5-flash-lite", name: "Gemini 2.5 Flash Lite", tags: ["cheap", "fast"] }
    ]
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    envVars: ["OPENROUTER_API_KEY"],
    authMethods: ["api-key", "env"],
    docsUrl: "https://openrouter.ai/keys",
    notes: "Best single-key router path for broad model choice.",
    models: [
      { id: "openai/gpt-5.1", name: "OpenAI GPT-5.1" },
      { id: "anthropic/claude-sonnet-4.5", name: "Claude Sonnet 4.5" },
      { id: "google/gemini-3-pro", name: "Gemini 3 Pro" }
    ]
  },
  {
    id: "github-copilot",
    name: "GitHub Copilot",
    envVars: ["COPILOT_GITHUB_TOKEN", "GITHUB_TOKEN", "GH_TOKEN"],
    authMethods: ["env", "oauth-external"],
    docsUrl: "https://github.com/features/copilot",
    notes: "Device OAuth should be delegated to pi-ai or a Copilot CLI adapter.",
    models: [
      { id: "gpt-5-mini", name: "GPT-5 Mini" },
      { id: "claude-sonnet-4.5", name: "Claude Sonnet 4.5" }
    ]
  },
  {
    id: "ollama",
    name: "Ollama",
    envVars: ["OLLAMA_API_KEY"],
    authMethods: ["none", "env"],
    docsUrl: "https://ollama.com",
    notes: "Local OpenAI-compatible runtime; usually no auth needed.",
    models: [
      { id: "llama3.2", name: "Llama 3.2" },
      { id: "qwen2.5-coder", name: "Qwen 2.5 Coder" }
    ]
  }
];
