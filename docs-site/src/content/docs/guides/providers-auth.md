---
title: Providers and authentication
description: Understand provider-specific API key, environment, account OAuth, and no-auth choices.
---

Models.dev supplies provider and model metadata. Reviewed source code decides which authentication
methods a provider may use. Remote metadata cannot add login commands or executable behavior.

## Supported choices

*Scroll tables sideways to read every column on narrow screens.*

| Provider | API key | Environment | Account login |
| --- | --- | --- | --- |
| OpenAI | Yes | `OPENAI_API_KEY` | Built-in account OAuth |
| GitHub Copilot | No | `GITHUB_TOKEN`, `GH_TOKEN`, `COPILOT_GITHUB_TOKEN` | Built-in account OAuth |
| Anthropic | Yes | `ANTHROPIC_API_KEY` | Optional CLIProxyAPI adapter |
| Google | Yes | `GEMINI_API_KEY`, `GOOGLE_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY` | Optional CLIProxyAPI adapter |
| Generic catalog provider | When local policy has source environment names | Known source names | No |
| Ollama compatibility entry | Optional | `OLLAMA_API_KEY` | No auth also available |

## Choose the least complex method

1. Use environment auth when your process already receives a secret securely.
2. Use API-key storage when the project should own a local secret file.
3. Use built-in account OAuth for OpenAI or GitHub Copilot when account login is required.
4. Consider CLIProxyAPI only for Anthropic or Google account auth and only after reading its risk
   warning.

:::caution[Provider terms]
Account automation may be limited by provider terms and can carry account restriction or blocking
risk. The CLIProxyAPI flow requires explicit confirmation before provisioning or login.
:::
