import type { ProviderDefinition } from "./types.js";

export const DEFAULT_PROVIDERS: readonly ProviderDefinition[] = [
  {
    "id": "openai",
    "name": "OpenAI",
    "envVars": [
      "OPENAI_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "oauth-external",
      "env"
    ],
    "docsUrl": "https://platform.openai.com/api-keys",
    "notes": "API key or OpenAI account sign-in.",
	    "models": [
	      {
	        "id": "gpt-5.5",
	        "name": "GPT-5.5"
	      },
	      {
	        "id": "gpt-5-pro",
	        "name": "GPT-5 Pro"
	      },
	      {
	        "id": "gpt-5.4-mini",
	        "name": "GPT-5.4 Mini"
	      },
	      {
	        "id": "gpt-5.4-nano",
	        "name": "GPT-5.4 Nano"
	      },
	      {
	        "id": "gpt-5-mini",
	        "name": "GPT-5 Mini"
	      },
	      {
	        "id": "gpt-5.6-sol",
	        "name": "GPT-5.6 Sol"
	      },
	      {
	        "id": "gpt-5.6-terra",
	        "name": "GPT-5.6 Terra"
	      },
	      {
	        "id": "gpt-5.6-luna",
	        "name": "GPT-5.6 Luna"
	      }
	    ]
  },
  {
    "id": "anthropic",
    "name": "Anthropic",
    "envVars": [
      "ANTHROPIC_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "oauth-external",
      "env"
    ],
    "docsUrl": "https://console.anthropic.com/settings/keys",
    "notes": "API key or Claude account sign-in.",
    "models": [
      {
        "id": "claude-opus-4-5",
        "name": "Claude Opus 4.5 (latest)"
      },
      {
        "id": "claude-sonnet-4-6",
        "name": "Claude Sonnet 4.6"
      },
      {
        "id": "claude-haiku-4-5-20251001",
        "name": "Claude Haiku 4.5"
      }
    ]
  },
  {
    "id": "google",
    "name": "Google Gemini",
    "envVars": [
      "GEMINI_API_KEY",
      "GOOGLE_API_KEY",
      "GOOGLE_GENERATIVE_AI_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "oauth-external",
      "env"
    ],
    "docsUrl": "https://aistudio.google.com/app/apikey",
    "notes": "API key or Google account sign-in.",
	    "models": [
	      {
	        "id": "gemini-3.5-flash",
	        "name": "Gemini 3.5 Flash"
	      },
	      {
	        "id": "gemini-3.1-flash-lite",
	        "name": "Gemini 3.1 Flash Lite"
	      },
	      {
	        "id": "gemini-3.1-pro-preview",
	        "name": "Gemini 3.1 Pro Preview"
	      }
	    ]
  },
  {
    "id": "github-copilot",
    "name": "GitHub Copilot",
    "envVars": [
      "COPILOT_GITHUB_TOKEN",
      "GITHUB_TOKEN",
      "GH_TOKEN"
    ],
    "authMethods": [
      "oauth-external",
      "env"
    ],
    "docsUrl": "https://github.com/features/copilot",
    "notes": "Use GitHub sign-in or an existing token.",
    "models": [
      {
        "id": "raptor-mini",
        "name": "Raptor mini"
      },
      {
        "id": "claude-sonnet-4",
        "name": "Claude Sonnet 4 (latest)"
      },
      {
        "id": "gpt-5-mini",
        "name": "GPT-5 Mini"
      }
    ]
  },
  {
    "id": "ollama",
    "name": "Ollama",
    "envVars": [
      "OLLAMA_API_KEY"
    ],
    "authMethods": [
      "none",
      "env"
    ],
    "docsUrl": "https://ollama.com",
    "notes": "Usually no auth needed for local use.",
    "models": [
      {
        "id": "llama3.2",
        "name": "Llama 3.2"
      },
      {
        "id": "qwen2.5-coder",
        "name": "Qwen 2.5 Coder"
      }
    ]
  },
  {
    "id": "upstage",
    "name": "Upstage",
    "envVars": [
      "UPSTAGE_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://developers.upstage.ai/docs/apis/chat",
    "notes": "API key provider.",
    "models": [
      {
        "id": "solar-mini",
        "name": "solar-mini"
      },
      {
        "id": "solar-pro3",
        "name": "solar-pro3"
      },
      {
        "id": "solar-pro2",
        "name": "solar-pro2"
      }
    ]
  },
  {
    "id": "clarifai",
    "name": "Clarifai",
    "envVars": [
      "CLARIFAI_PAT"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://docs.clarifai.com/compute/inference/",
    "notes": "API key provider.",
    "models": [
      {
        "id": "clarifai/main/models/mm-poly-8b",
        "name": "MM Poly 8B"
      },
      {
        "id": "mistralai/completion/models/Ministral-3-3B-Reasoning-2512",
        "name": "Ministral 3 3B Reasoning 2512"
      },
      {
        "id": "mistralai/completion/models/Ministral-3-14B-Reasoning-2512",
        "name": "Ministral 3 14B Reasoning 2512"
      }
    ]
  },
  {
    "id": "ollama-cloud",
    "name": "Ollama Cloud",
    "envVars": [
      "OLLAMA_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://docs.ollama.com/cloud",
    "notes": "API key provider.",
    "models": [
      {
        "id": "qwen3-vl:235b-instruct",
        "name": "qwen3-vl:235b-instruct"
      },
      {
        "id": "gemma3:27b",
        "name": "gemma3:27b"
      },
      {
        "id": "kimi-k2:1t",
        "name": "kimi-k2:1t"
      }
    ]
  },
  {
    "id": "the-grid-ai",
    "name": "The Grid AI",
    "envVars": [
      "THEGRIDAI_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://thegrid.ai/docs",
    "notes": "API key provider.",
    "models": [
      {
        "id": "text-prime",
        "name": "Text Prime"
      },
      {
        "id": "agent-standard",
        "name": "Agent Standard"
      },
      {
        "id": "text-standard",
        "name": "Text Standard"
      }
    ]
  },
  {
    "id": "fireworks-ai",
    "name": "Fireworks AI",
    "envVars": [
      "FIREWORKS_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://fireworks.ai/docs/",
    "notes": "API key provider.",
    "models": [
      {
        "id": "accounts/fireworks/models/minimax-m2p5",
        "name": "MiniMax-M2.5"
      },
      {
        "id": "accounts/fireworks/models/qwen3p6-plus",
        "name": "Qwen 3.6 Plus"
      },
      {
        "id": "accounts/fireworks/models/gpt-oss-120b",
        "name": "GPT OSS 120B"
      }
    ]
  },
  {
    "id": "ambient",
    "name": "Ambient",
    "envVars": [
      "AMBIENT_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://ambient.xyz",
    "notes": "API key provider.",
    "models": [
      {
        "id": "zai-org/GLM-5.1-FP8",
        "name": "GLM-5.1"
      },
      {
        "id": "moonshotai/kimi-k2.6",
        "name": "Kimi K2.6"
      }
    ]
  },
  {
    "id": "stackit",
    "name": "STACKIT",
    "envVars": [
      "STACKIT_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://docs.stackit.cloud/products/data-and-ai/ai-model-serving/basics/available-shared-models",
    "notes": "API key provider.",
    "models": [
      {
        "id": "neuralmagic/Meta-Llama-3.1-8B-Instruct-FP8",
        "name": "Llama 3.1 8B"
      },
      {
        "id": "neuralmagic/Mistral-Nemo-Instruct-2407-FP8",
        "name": "Mistral Nemo"
      },
      {
        "id": "intfloat/e5-mistral-7b-instruct",
        "name": "E5 Mistral 7B"
      }
    ]
  },
  {
    "id": "ovhcloud",
    "name": "OVHcloud AI Endpoints",
    "envVars": [
      "OVHCLOUD_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://www.ovhcloud.com/en/public-cloud/ai-endpoints/catalog//",
    "notes": "API key provider.",
    "models": [
      {
        "id": "qwen2.5-vl-72b-instruct",
        "name": "Qwen2.5-VL-72B-Instruct"
      },
      {
        "id": "qwen3guard-gen-8b",
        "name": "Qwen3Guard-Gen-8B"
      },
      {
        "id": "qwen3-32b",
        "name": "Qwen3-32B"
      }
    ]
  },
  {
    "id": "iflowcn",
    "name": "iFlow",
    "envVars": [
      "IFLOW_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://platform.iflow.cn/en/docs",
    "notes": "API key provider.",
    "models": [
      {
        "id": "qwen3-max-preview",
        "name": "Qwen3-Max-Preview"
      },
      {
        "id": "glm-4.6",
        "name": "GLM-4.6"
      },
      {
        "id": "qwen3-32b",
        "name": "Qwen3-32B"
      }
    ]
  },
  {
    "id": "302ai",
    "name": "302.AI",
    "envVars": [
      "302AI_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://doc.302.ai",
    "notes": "API key provider.",
    "models": [
      {
        "id": "kimi-k2-thinking-turbo",
        "name": "kimi-k2-thinking-turbo"
      },
      {
        "id": "chatgpt-4o-latest",
        "name": "chatgpt-4o-latest"
      },
      {
        "id": "grok-4.1",
        "name": "grok-4.1"
      }
    ]
  },
  {
    "id": "nano-gpt",
    "name": "NanoGPT",
    "envVars": [
      "NANO_GPT_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://docs.nano-gpt.com",
    "notes": "API key provider.",
    "models": [
      {
        "id": "learnlm-1.5-pro-experimental",
        "name": "Gemini LearnLM Experimental"
      },
      {
        "id": "claude-sonnet-4-thinking:8192",
        "name": "Claude 4 Sonnet Thinking (8K)"
      },
      {
        "id": "mistral-code-latest",
        "name": "Mistral Code Latest"
      }
    ]
  },
  {
    "id": "alibaba-cn",
    "name": "Alibaba (China)",
    "envVars": [
      "DASHSCOPE_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://www.alibabacloud.com/help/en/model-studio/models",
    "notes": "API key provider.",
    "models": [
      {
        "id": "MiniMax-M2.5",
        "name": "MiniMax-M2.5"
      },
      {
        "id": "qwen3-asr-flash",
        "name": "Qwen3-ASR Flash"
      },
      {
        "id": "qwen-math-turbo",
        "name": "Qwen Math Turbo"
      }
    ]
  },
  {
    "id": "digitalocean",
    "name": "DigitalOcean",
    "envVars": [
      "DIGITALOCEAN_ACCESS_TOKEN"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://docs.digitalocean.com/products/gradient-ai-platform/details/models/",
    "notes": "API key provider.",
    "models": [
      {
        "id": "openai-gpt-5.2",
        "name": "GPT-5.2"
      },
      {
        "id": "deepseek-3.2",
        "name": "DeepSeek V3.2"
      },
      {
        "id": "openai-gpt-image-2",
        "name": "GPT Image 2"
      }
    ]
  },
  {
    "id": "submodel",
    "name": "submodel",
    "envVars": [
      "SUBMODEL_INSTAGEN_ACCESS_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://submodel.gitbook.io",
    "notes": "API key provider.",
    "models": [
      {
        "id": "zai-org/GLM-4.5-FP8",
        "name": "GLM 4.5 FP8"
      },
      {
        "id": "zai-org/GLM-4.5-Air",
        "name": "GLM 4.5 Air"
      },
      {
        "id": "deepseek-ai/DeepSeek-V3.1",
        "name": "DeepSeek V3.1"
      }
    ]
  },
  {
    "id": "bailing",
    "name": "Bailing",
    "envVars": [
      "BAILING_API_TOKEN"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://alipaytbox.yuque.com/sxs0ba/ling/intro",
    "notes": "API key provider.",
    "models": [
      {
        "id": "Ring-1T",
        "name": "Ring-1T"
      },
      {
        "id": "Ling-1T",
        "name": "Ling-1T"
      }
    ]
  },
  {
    "id": "kimi-for-coding",
    "name": "Kimi For Coding",
    "envVars": [
      "KIMI_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://www.kimi.com/code/docs/en/third-party-tools/other-coding-agents.html",
    "notes": "API key provider.",
    "models": [
      {
        "id": "kimi-k2-thinking",
        "name": "Kimi K2 Thinking"
      },
      {
        "id": "k2p5",
        "name": "Kimi K2.5"
      },
      {
        "id": "k2p6",
        "name": "Kimi K2.6"
      }
    ]
  },
  {
    "id": "dinference",
    "name": "DInference",
    "envVars": [
      "DINFERENCE_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://dinference.com",
    "notes": "API key provider.",
    "models": [
      {
        "id": "glm-4.7",
        "name": "GLM-4.7"
      },
      {
        "id": "gpt-oss-120b",
        "name": "GPT OSS 120B"
      },
      {
        "id": "glm-5",
        "name": "GLM-5"
      }
    ]
  },
  {
    "id": "novita-ai",
    "name": "NovitaAI",
    "envVars": [
      "NOVITA_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://novita.ai/docs/guides/introduction",
    "notes": "API key provider.",
    "models": [
      {
        "id": "kwaipilot/kat-coder-pro",
        "name": "Kat Coder Pro"
      },
      {
        "id": "nousresearch/hermes-2-pro-llama-3-8b",
        "name": "Hermes 2 Pro Llama 3 8B"
      },
      {
        "id": "mistralai/mistral-nemo",
        "name": "Mistral Nemo"
      }
    ]
  },
  {
    "id": "kilo",
    "name": "Kilo Gateway",
    "envVars": [
      "KILO_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://kilo.ai",
    "notes": "API key provider.",
    "models": [
      {
        "id": "kwaipilot/kat-coder-pro-v2",
        "name": "Kwaipilot: KAT-Coder-Pro V2"
      },
      {
        "id": "z-ai/glm-4.6",
        "name": "Z.ai: GLM 4.6"
      },
      {
        "id": "z-ai/glm-4.7",
        "name": "Z.ai: GLM 4.7"
      }
    ]
  },
  {
    "id": "regolo-ai",
    "name": "Regolo AI",
    "envVars": [
      "REGOLO_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://docs.regolo.ai/",
    "notes": "API key provider.",
    "models": [
      {
        "id": "mistral-small3.2",
        "name": "Mistral Small 3.2"
      },
      {
        "id": "qwen3-reranker-4b",
        "name": "Qwen3-Reranker-4B"
      },
      {
        "id": "qwen3.5-122b",
        "name": "Qwen3.5-122B"
      }
    ]
  },
  {
    "id": "google-vertex",
    "name": "Vertex",
    "envVars": [
      "GOOGLE_VERTEX_PROJECT",
      "GOOGLE_VERTEX_LOCATION",
      "GOOGLE_APPLICATION_CREDENTIALS"
    ],
    "authMethods": [
      "env"
    ],
    "docsUrl": "https://cloud.google.com/vertex-ai/generative-ai/docs/models",
    "notes": "Uses shell credentials.",
    "models": [
      {
        "id": "gemini-2.5-flash-lite-preview-06-17",
        "name": "Gemini 2.5 Flash Lite Preview 06-17"
      },
      {
        "id": "claude-opus-4-7@default",
        "name": "Claude Opus 4.7"
      },
      {
        "id": "claude-haiku-4-5@20251001",
        "name": "Claude Haiku 4.5"
      }
    ]
  },
  {
    "id": "deepseek",
    "name": "DeepSeek",
    "envVars": [
      "DEEPSEEK_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://api-docs.deepseek.com/quick_start/pricing",
    "notes": "API key provider.",
    "models": [
      {
        "id": "deepseek-reasoner",
        "name": "DeepSeek Reasoner"
      },
      {
        "id": "deepseek-chat",
        "name": "DeepSeek Chat"
      },
      {
        "id": "deepseek-v4-flash",
        "name": "DeepSeek V4 Flash"
      }
    ]
  },
  {
    "id": "orcarouter",
    "name": "OrcaRouter",
    "envVars": [
      "ORCAROUTER_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://docs.orcarouter.ai",
    "notes": "API key provider.",
    "models": [
      {
        "id": "z-ai/glm-4.6",
        "name": "GLM-4.6"
      },
      {
        "id": "z-ai/glm-4.7",
        "name": "GLM-4.7"
      },
      {
        "id": "z-ai/glm-5",
        "name": "GLM-5"
      }
    ]
  },
  {
    "id": "moonshotai-cn",
    "name": "Moonshot AI (China)",
    "envVars": [
      "MOONSHOT_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://platform.moonshot.cn/docs/api/chat",
    "notes": "API key provider.",
    "models": [
      {
        "id": "kimi-k2.5",
        "name": "Kimi K2.5"
      },
      {
        "id": "kimi-k2-0711-preview",
        "name": "Kimi K2 0711"
      },
      {
        "id": "kimi-k2-0905-preview",
        "name": "Kimi K2 0905"
      }
    ]
  },
  {
    "id": "minimax-cn-coding-plan",
    "name": "MiniMax Token Plan (minimaxi.com)",
    "envVars": [
      "MINIMAX_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://platform.minimaxi.com/docs/token-plan/intro",
    "notes": "API key provider.",
    "models": [
      {
        "id": "MiniMax-M2.5",
        "name": "MiniMax-M2.5"
      },
      {
        "id": "MiniMax-M3",
        "name": "MiniMax-M3"
      },
      {
        "id": "MiniMax-M2.5-highspeed",
        "name": "MiniMax-M2.5-highspeed"
      }
    ]
  },
  {
    "id": "inception",
    "name": "Inception",
    "envVars": [
      "INCEPTION_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://platform.inceptionlabs.ai/docs",
    "notes": "API key provider.",
    "models": [
      {
        "id": "mercury-edit-2",
        "name": "Mercury Edit 2"
      },
      {
        "id": "mercury-2",
        "name": "Mercury 2"
      }
    ]
  },
  {
    "id": "kuae-cloud-coding-plan",
    "name": "KUAE Cloud Coding Plan",
    "envVars": [
      "KUAE_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://docs.mthreads.com/kuaecloud/kuaecloud-doc-online/coding_plan/",
    "notes": "API key provider.",
    "models": [
      {
        "id": "GLM-4.7",
        "name": "GLM-4.7"
      }
    ]
  },
  {
    "id": "chutes",
    "name": "Chutes",
    "envVars": [
      "CHUTES_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://llm.chutes.ai/v1/models",
    "notes": "API key provider.",
    "models": [
      {
        "id": "XiaomiMiMo/MiMo-V2-Flash-TEE",
        "name": "MiMo V2 Flash TEE"
      },
      {
        "id": "MiniMaxAI/MiniMax-M2.5-TEE",
        "name": "MiniMax M2.5 TEE"
      },
      {
        "id": "zai-org/GLM-5.1-TEE",
        "name": "GLM 5.1 TEE"
      }
    ]
  },
  {
    "id": "crof",
    "name": "CrofAI",
    "envVars": [
      "CROF_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://crof.ai/docs",
    "notes": "API key provider.",
    "models": [
      {
        "id": "deepseek-v4-pro-lightning",
        "name": "DeepSeek V4 Pro"
      },
      {
        "id": "greg-1",
        "name": "Greg 1 Normal"
      },
      {
        "id": "greg-rp",
        "name": "Greg (Roleplay)"
      }
    ]
  },
  {
    "id": "frogbot",
    "name": "FrogBot",
    "envVars": [
      "FROGBOT_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://docs.frogbot.ai",
    "notes": "API key provider.",
    "models": [
      {
        "id": "minimax-m2-7",
        "name": "MiniMax-M2.7"
      },
      {
        "id": "claude-sonnet-4-6",
        "name": "Claude Sonnet 4.6"
      },
      {
        "id": "gpt-4o",
        "name": "GPT-4o"
      }
    ]
  },
  {
    "id": "alibaba",
    "name": "Alibaba",
    "envVars": [
      "DASHSCOPE_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://www.alibabacloud.com/help/en/model-studio/models",
    "notes": "API key provider.",
    "models": [
      {
        "id": "qwen3-asr-flash",
        "name": "Qwen3-ASR Flash"
      },
      {
        "id": "qwen3.5-122b-a10b",
        "name": "Qwen3.5 122B-A10B"
      },
      {
        "id": "qwen3-next-80b-a3b-instruct",
        "name": "Qwen3-Next 80B-A3B Instruct"
      }
    ]
  },
  {
    "id": "xiaomi",
    "name": "Xiaomi",
    "envVars": [
      "XIAOMI_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://platform.xiaomimimo.com/#/docs",
    "notes": "API key provider.",
    "models": [
      {
        "id": "mimo-v2-omni",
        "name": "MiMo-V2-Omni"
      },
      {
        "id": "mimo-v2-pro",
        "name": "MiMo-V2-Pro"
      },
      {
        "id": "mimo-v2.5",
        "name": "MiMo-V2.5"
      }
    ]
  },
  {
    "id": "mistral",
    "name": "Mistral",
    "envVars": [
      "MISTRAL_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://docs.mistral.ai/getting-started/models/",
    "notes": "API key provider.",
    "models": [
      {
        "id": "mistral-large-2411",
        "name": "Mistral Large 2.1"
      },
      {
        "id": "mistral-medium-2508",
        "name": "Mistral Medium 3.1"
      },
      {
        "id": "mistral-medium-latest",
        "name": "Mistral Medium (latest)"
      }
    ]
  },
  {
    "id": "vivgrid",
    "name": "Vivgrid",
    "envVars": [
      "VIVGRID_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://docs.vivgrid.com/models",
    "notes": "API key provider.",
    "models": [
      {
        "id": "gpt-5-mini",
        "name": "GPT-5 Mini"
      },
      {
        "id": "gemini-3.1-flash-lite-preview",
        "name": "Gemini 3.1 Flash Lite Preview"
      },
      {
        "id": "deepseek-v3.2",
        "name": "DeepSeek-V3.2"
      }
    ]
  },
  {
    "id": "databricks",
    "name": "Databricks",
    "envVars": [
      "DATABRICKS_HOST",
      "DATABRICKS_TOKEN"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://docs.databricks.com/aws/en/machine-learning/foundation-models/",
    "notes": "API key provider.",
    "models": [
      {
        "id": "databricks-claude-sonnet-4",
        "name": "Claude Sonnet 4.5"
      },
      {
        "id": "databricks-gpt-5-1",
        "name": "GPT-5.1"
      },
      {
        "id": "databricks-gpt-5-4-nano",
        "name": "GPT-5.4 nano"
      }
    ]
  },
  {
    "id": "siliconflow-cn",
    "name": "SiliconFlow (China)",
    "envVars": [
      "SILICONFLOW_CN_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://cloud.siliconflow.com/models",
    "notes": "API key provider.",
    "models": [
      {
        "id": "THUDM/GLM-4-9B-0414",
        "name": "THUDM/GLM-4-9B-0414"
      },
      {
        "id": "THUDM/GLM-4-32B-0414",
        "name": "THUDM/GLM-4-32B-0414"
      },
      {
        "id": "THUDM/GLM-Z1-9B-0414",
        "name": "THUDM/GLM-Z1-9B-0414"
      }
    ]
  },
  {
    "id": "zhipuai-coding-plan",
    "name": "Zhipu AI Coding Plan",
    "envVars": [
      "ZHIPU_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://docs.bigmodel.cn/cn/coding-plan/overview",
    "notes": "API key provider.",
    "models": [
      {
        "id": "glm-5v-turbo",
        "name": "GLM-5V-Turbo"
      },
      {
        "id": "glm-5.1",
        "name": "GLM-5.1"
      },
      {
        "id": "glm-4.5-air",
        "name": "GLM-4.5-Air"
      }
    ]
  },
  {
    "id": "xai",
    "name": "xAI",
    "envVars": [
      "XAI_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://docs.x.ai/docs/models",
    "notes": "API key provider.",
    "models": [
      {
        "id": "grok-build-0.1",
        "name": "Grok Build 0.1"
      },
      {
        "id": "grok-4.20-0309-reasoning",
        "name": "Grok 4.20 (Reasoning)"
      },
      {
        "id": "grok-4.20-multi-agent-0309",
        "name": "Grok 4.20 Multi-Agent"
      }
    ]
  },
  {
    "id": "v0",
    "name": "v0",
    "envVars": [
      "V0_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://sdk.vercel.ai/providers/ai-sdk-providers/vercel",
    "notes": "API key provider.",
    "models": [
      {
        "id": "v0-1.5-lg",
        "name": "v0-1.5-lg"
      },
      {
        "id": "v0-1.0-md",
        "name": "v0-1.0-md"
      },
      {
        "id": "v0-1.5-md",
        "name": "v0-1.5-md"
      }
    ]
  },
  {
    "id": "neuralwatt",
    "name": "Neuralwatt",
    "envVars": [
      "NEURALWATT_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://portal.neuralwatt.com/docs",
    "notes": "API key provider.",
    "models": [
      {
        "id": "glm-5-fast",
        "name": "GLM 5 Fast"
      },
      {
        "id": "qwen3.5-397b-fast",
        "name": "Qwen3.5 397B Fast"
      },
      {
        "id": "kimi-k2.5-fast",
        "name": "Kimi K2.5 Fast"
      }
    ]
  },
  {
    "id": "friendli",
    "name": "Friendli",
    "envVars": [
      "FRIENDLI_TOKEN"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://friendli.ai/docs/guides/serverless_endpoints/introduction",
    "notes": "API key provider.",
    "models": [
      {
        "id": "MiniMaxAI/MiniMax-M2.5",
        "name": "MiniMax-M2.5"
      },
      {
        "id": "zai-org/GLM-5",
        "name": "GLM-5"
      },
      {
        "id": "zai-org/GLM-5.1",
        "name": "GLM-5.1"
      }
    ]
  },
  {
    "id": "inference",
    "name": "Inference",
    "envVars": [
      "INFERENCE_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://inference.net/models",
    "notes": "API key provider.",
    "models": [
      {
        "id": "osmosis/osmosis-structure-0.6b",
        "name": "Osmosis Structure 0.6B"
      },
      {
        "id": "mistral/mistral-nemo-12b-instruct",
        "name": "Mistral Nemo 12B Instruct"
      },
      {
        "id": "qwen/qwen-2.5-7b-vision-instruct",
        "name": "Qwen 2.5 7B Vision Instruct"
      }
    ]
  },
  {
    "id": "huggingface",
    "name": "Hugging Face",
    "envVars": [
      "HF_TOKEN"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://huggingface.co/docs/inference-providers",
    "notes": "API key provider.",
    "models": [
      {
        "id": "XiaomiMiMo/MiMo-V2-Flash",
        "name": "MiMo-V2-Flash"
      },
      {
        "id": "MiniMaxAI/MiniMax-M2.5",
        "name": "MiniMax-M2.5"
      },
      {
        "id": "MiniMaxAI/MiniMax-M2.7",
        "name": "MiniMax-M2.7"
      }
    ]
  },
  {
    "id": "cohere",
    "name": "Cohere",
    "envVars": [
      "COHERE_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://docs.cohere.com/docs/models",
    "notes": "API key provider.",
    "models": [
      {
        "id": "command-r-plus-08-2024",
        "name": "Command R+"
      },
      {
        "id": "c4ai-aya-vision-8b",
        "name": "Aya Vision 8B"
      },
      {
        "id": "command-a-reasoning-08-2025",
        "name": "Command A Reasoning"
      }
    ]
  },
  {
    "id": "azure-cognitive-services",
    "name": "Azure Cognitive Services",
    "envVars": [
      "AZURE_COGNITIVE_SERVICES_RESOURCE_NAME",
      "AZURE_COGNITIVE_SERVICES_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://learn.microsoft.com/en-us/azure/ai-services/openai/concepts/models",
    "notes": "API key provider.",
    "models": [
      {
        "id": "claude-opus-4-5",
        "name": "Claude Opus 4.5"
      },
      {
        "id": "claude-haiku-4-5",
        "name": "Claude Haiku 4.5"
      },
      {
        "id": "gpt-5.4-pro",
        "name": "GPT-5.4 Pro"
      }
    ]
  },
  {
    "id": "openrouter",
    "name": "OpenRouter",
    "envVars": [
      "OPENROUTER_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://openrouter.ai/models",
    "notes": "API key provider.",
    "models": [
      {
        "id": "kwaipilot/kat-coder-pro-v2",
        "name": "KAT-Coder-Pro V2"
      },
      {
        "id": "z-ai/glm-4.5-air:free",
        "name": "GLM 4.5 Air (free)"
      },
      {
        "id": "z-ai/glm-4.6",
        "name": "GLM-4.6"
      }
    ]
  },
  {
    "id": "privatemode-ai",
    "name": "Privatemode AI",
    "envVars": [
      "PRIVATEMODE_API_KEY",
      "PRIVATEMODE_ENDPOINT"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://docs.privatemode.ai/api/overview",
    "notes": "API key provider.",
    "models": [
      {
        "id": "gemma-3-27b",
        "name": "Gemma 3 27B"
      },
      {
        "id": "gpt-oss-120b",
        "name": "gpt-oss-120b"
      },
      {
        "id": "whisper-large-v3",
        "name": "Whisper large-v3"
      }
    ]
  },
  {
    "id": "snowflake-cortex",
    "name": "Snowflake Cortex",
    "envVars": [
      "SNOWFLAKE_ACCOUNT",
      "SNOWFLAKE_CORTEX_PAT"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-rest-api",
    "notes": "API key provider.",
    "models": [
      {
        "id": "openai-gpt-5.2",
        "name": "GPT-5.2"
      },
      {
        "id": "claude-sonnet-4-6",
        "name": "Claude Sonnet 4.6"
      },
      {
        "id": "openai-gpt-4.1",
        "name": "GPT-4.1"
      }
    ]
  },
  {
    "id": "moonshotai",
    "name": "Moonshot AI",
    "envVars": [
      "MOONSHOT_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://platform.moonshot.ai/docs/api/chat",
    "notes": "API key provider.",
    "models": [
      {
        "id": "kimi-k2-thinking-turbo",
        "name": "Kimi K2 Thinking Turbo"
      },
      {
        "id": "kimi-k2-thinking",
        "name": "Kimi K2 Thinking"
      },
      {
        "id": "kimi-k2.6",
        "name": "Kimi K2.6"
      }
    ]
  },
  {
    "id": "perplexity",
    "name": "Perplexity",
    "envVars": [
      "PERPLEXITY_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://docs.perplexity.ai",
    "notes": "API key provider.",
    "models": [
      {
        "id": "sonar",
        "name": "Sonar"
      },
      {
        "id": "sonar-pro",
        "name": "Sonar Pro"
      },
      {
        "id": "sonar-reasoning-pro",
        "name": "Sonar Reasoning Pro"
      }
    ]
  },
  {
    "id": "llmgateway",
    "name": "LLM Gateway",
    "envVars": [
      "LLMGATEWAY_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://llmgateway.io/docs",
    "notes": "API key provider.",
    "models": [
      {
        "id": "kimi-k2-thinking-turbo",
        "name": "Kimi K2 Thinking Turbo"
      },
      {
        "id": "gemini-pro-latest",
        "name": "Gemini Pro Latest"
      },
      {
        "id": "llama-3.1-70b-instruct",
        "name": "Llama 3.1 70B Instruct"
      }
    ]
  },
  {
    "id": "togetherai",
    "name": "Together AI",
    "envVars": [
      "TOGETHER_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://docs.together.ai/docs/serverless-models",
    "notes": "API key provider.",
    "models": [
      {
        "id": "MiniMaxAI/MiniMax-M2.5",
        "name": "MiniMax-M2.5"
      },
      {
        "id": "MiniMaxAI/MiniMax-M2.7",
        "name": "MiniMax-M2.7"
      },
      {
        "id": "zai-org/GLM-5.1",
        "name": "GLM-5.1"
      }
    ]
  },
  {
    "id": "moark",
    "name": "Moark",
    "envVars": [
      "MOARK_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://moark.com/docs/openapi/v1#tag/%E6%96%87%E6%9C%AC%E7%94%9F%E6%88%90",
    "notes": "API key provider.",
    "models": [
      {
        "id": "GLM-4.7",
        "name": "GLM-4.7"
      },
      {
        "id": "MiniMax-M2.1",
        "name": "MiniMax-M2.1"
      }
    ]
  },
  {
    "id": "github-models",
    "name": "GitHub Models",
    "envVars": [
      "GITHUB_TOKEN"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://docs.github.com/en/github-models",
    "notes": "API key provider.",
    "models": [
      {
        "id": "core42/jais-30b-chat",
        "name": "JAIS 30b Chat"
      },
      {
        "id": "deepseek/deepseek-r1-0528",
        "name": "DeepSeek-R1-0528"
      },
      {
        "id": "deepseek/deepseek-v3-0324",
        "name": "DeepSeek-V3-0324"
      }
    ]
  },
  {
    "id": "xiaomi-token-plan-cn",
    "name": "Xiaomi Token Plan (China)",
    "envVars": [
      "XIAOMI_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://platform.xiaomimimo.com/#/docs",
    "notes": "API key provider.",
    "models": [
      {
        "id": "mimo-v2-tts",
        "name": "MiMo-V2-TTS"
      },
      {
        "id": "mimo-v2-omni",
        "name": "MiMo-V2-Omni"
      },
      {
        "id": "mimo-v2.5-tts-voicedesign",
        "name": "MiMo-V2.5-TTS-VoiceDesign"
      }
    ]
  },
  {
    "id": "lmstudio",
    "name": "LMStudio",
    "envVars": [
      "LMSTUDIO_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://lmstudio.ai/models",
    "notes": "API key provider.",
    "models": [
      {
        "id": "qwen/qwen3-coder-30b",
        "name": "Qwen3 Coder 30B"
      },
      {
        "id": "qwen/qwen3-30b-a3b-2507",
        "name": "Qwen3 30B A3B 2507"
      },
      {
        "id": "openai/gpt-oss-20b",
        "name": "GPT OSS 20B"
      }
    ]
  },
  {
    "id": "zenmux",
    "name": "ZenMux",
    "envVars": [
      "ZENMUX_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://docs.zenmux.ai",
    "notes": "API key provider.",
    "models": [
      {
        "id": "z-ai/glm-4.7-flashx",
        "name": "GLM 4.7 FlashX"
      },
      {
        "id": "z-ai/glm-4.6v-flash",
        "name": "GLM 4.6V FlashX"
      },
      {
        "id": "z-ai/glm-4.6",
        "name": "GLM 4.6"
      }
    ]
  },
  {
    "id": "claudinio",
    "name": "Claudinio",
    "envVars": [
      "CLAUDINIO_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://claudin.io",
    "notes": "API key provider.",
    "models": [
      {
        "id": "claudinio",
        "name": "Claudinio"
      }
    ]
  },
  {
    "id": "alibaba-coding-plan",
    "name": "Alibaba Coding Plan",
    "envVars": [
      "ALIBABA_CODING_PLAN_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://www.alibabacloud.com/help/en/model-studio/coding-plan",
    "notes": "API key provider.",
    "models": [
      {
        "id": "MiniMax-M2.5",
        "name": "MiniMax-M2.5"
      },
      {
        "id": "qwen3.5-plus",
        "name": "Qwen3.5 Plus"
      },
      {
        "id": "qwen3-coder-plus",
        "name": "Qwen3 Coder Plus"
      }
    ]
  },
  {
    "id": "modelscope",
    "name": "ModelScope",
    "envVars": [
      "MODELSCOPE_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://modelscope.cn/docs/model-service/API-Inference/intro",
    "notes": "API key provider.",
    "models": [
      {
        "id": "ZhipuAI/GLM-4.5",
        "name": "GLM-4.5"
      },
      {
        "id": "ZhipuAI/GLM-4.6",
        "name": "GLM-4.6"
      },
      {
        "id": "Qwen/Qwen3-30B-A3B-Instruct-2507",
        "name": "Qwen3 30B A3B Instruct 2507"
      }
    ]
  },
  {
    "id": "qihang-ai",
    "name": "QiHang",
    "envVars": [
      "QIHANG_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://www.qhaigc.net/docs",
    "notes": "API key provider.",
    "models": [
      {
        "id": "gpt-5-mini",
        "name": "GPT-5-Mini"
      },
      {
        "id": "gpt-5.2",
        "name": "GPT-5.2"
      },
      {
        "id": "claude-haiku-4-5-20251001",
        "name": "Claude Haiku 4.5"
      }
    ]
  },
  {
    "id": "aihubmix",
    "name": "AIHubMix",
    "envVars": [
      "AIHUBMIX_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://docs.aihubmix.com",
    "notes": "API key provider.",
    "models": [
      {
        "id": "doubao-seed-2-0-mini-260428",
        "name": "Doubao Seed 2.0 Mini 260428"
      },
      {
        "id": "doubao-seed-2-0-code-preview",
        "name": "Doubao Seed 2.0 Code Preview"
      },
      {
        "id": "doubao-seed-2-0-pro",
        "name": "Doubao Seed 2.0 Pro"
      }
    ]
  },
  {
    "id": "poe",
    "name": "Poe",
    "envVars": [
      "POE_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://creator.poe.com/docs/external-applications/openai-compatible-api",
    "notes": "API key provider.",
    "models": [
      {
        "id": "empiriolabs/deepseek-v4-pro-el",
        "name": "DeepSeek-V4-Pro-EL"
      },
      {
        "id": "empiriolabs/deepseek-v4-flash-el",
        "name": "DeepSeek-V4-Flash-EL"
      },
      {
        "id": "elevenlabs/elevenlabs-v3",
        "name": "ElevenLabs-v3"
      }
    ]
  },
  {
    "id": "umans-ai-coding-plan",
    "name": "Umans AI Coding Plan",
    "envVars": [
      "UMANS_AI_CODING_PLAN_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://app.umans.ai/offers/code/docs",
    "notes": "API key provider.",
    "models": [
      {
        "id": "umans-kimi-k2.6",
        "name": "Kimi K2.6"
      },
      {
        "id": "umans-glm-5.1",
        "name": "GLM 5.1"
      },
      {
        "id": "umans-qwen3.6-35b-a3b",
        "name": "Qwen3.6 35B A3B"
      }
    ]
  },
  {
    "id": "firepass",
    "name": "Fireworks (Firepass)",
    "envVars": [
      "FIREPASS_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://docs.fireworks.ai/firepass",
    "notes": "API key provider.",
    "models": [
      {
        "id": "accounts/fireworks/routers/kimi-k2p6-turbo",
        "name": "Kimi K2.6 Turbo"
      }
    ]
  },
  {
    "id": "gmicloud",
    "name": "GMI Cloud",
    "envVars": [
      "GMICLOUD_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://docs.gmicloud.ai/inference-engine/api-reference/llm-api-reference",
    "notes": "API key provider.",
    "models": [
      {
        "id": "zai-org/GLM-5-FP8",
        "name": "GLM-5"
      },
      {
        "id": "zai-org/GLM-5.1-FP8",
        "name": "GLM-5.1"
      },
      {
        "id": "anthropic/claude-sonnet-4.6",
        "name": "Claude Sonnet 4.6"
      }
    ]
  },
  {
    "id": "mixlayer",
    "name": "Mixlayer",
    "envVars": [
      "MIXLAYER_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://docs.mixlayer.com",
    "notes": "API key provider.",
    "models": [
      {
        "id": "qwen/qwen3.5-122b-a10b",
        "name": "Qwen3.5 122B A10B"
      },
      {
        "id": "qwen/qwen3.5-9b",
        "name": "Qwen3.5 9B"
      },
      {
        "id": "qwen/qwen3.5-35b-a3b",
        "name": "Qwen3.5 35B A3B"
      }
    ]
  },
  {
    "id": "minimax-coding-plan",
    "name": "MiniMax Token Plan (minimax.io)",
    "envVars": [
      "MINIMAX_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://platform.minimax.io/docs/token-plan/intro",
    "notes": "API key provider.",
    "models": [
      {
        "id": "MiniMax-M2.5",
        "name": "MiniMax-M2.5"
      },
      {
        "id": "MiniMax-M3",
        "name": "MiniMax-M3"
      },
      {
        "id": "MiniMax-M2.5-highspeed",
        "name": "MiniMax-M2.5-highspeed"
      }
    ]
  },
  {
    "id": "evroc",
    "name": "evroc",
    "envVars": [
      "EVROC_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://docs.evroc.com/products/think/overview.html",
    "notes": "API key provider.",
    "models": [
      {
        "id": "mistralai/Voxtral-Small-24B-2507",
        "name": "Voxtral Small 24B"
      },
      {
        "id": "mistralai/devstral-small-2-24b-instruct-2512",
        "name": "Devstral Small 2 24B Instruct 2512"
      },
      {
        "id": "mistralai/Magistral-Small-2509",
        "name": "Magistral Small 1.2 24B"
      }
    ]
  },
  {
    "id": "nvidia",
    "name": "Nvidia",
    "envVars": [
      "NVIDIA_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://docs.api.nvidia.com/nim/",
    "notes": "API key provider.",
    "models": [
      {
        "id": "z-ai/glm4.7",
        "name": "GLM-4.7"
      },
      {
        "id": "z-ai/glm-5.1",
        "name": "GLM-5.1"
      },
      {
        "id": "upstage/solar-10_7b-instruct",
        "name": "solar-10.7b-instruct"
      }
    ]
  },
  {
    "id": "google-vertex-anthropic",
    "name": "Vertex (Anthropic)",
    "envVars": [
      "GOOGLE_VERTEX_PROJECT",
      "GOOGLE_VERTEX_LOCATION",
      "GOOGLE_APPLICATION_CREDENTIALS"
    ],
    "authMethods": [
      "env"
    ],
    "docsUrl": "https://cloud.google.com/vertex-ai/generative-ai/docs/partner-models/claude",
    "notes": "Uses shell credentials.",
    "models": [
      {
        "id": "claude-opus-4-7@default",
        "name": "Claude Opus 4.7"
      },
      {
        "id": "claude-haiku-4-5@20251001",
        "name": "Claude Haiku 4.5"
      },
      {
        "id": "claude-sonnet-4@20250514",
        "name": "Claude Sonnet 4"
      }
    ]
  },
  {
    "id": "routing-run",
    "name": "routing.run",
    "envVars": [
      "ROUTING_RUN_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://docs.routing.run/api-reference/models",
    "notes": "API key provider.",
    "models": [
      {
        "id": "route/mistral-large-3",
        "name": "Mistral Large 3"
      },
      {
        "id": "route/mistral-small-2503",
        "name": "Mistral Small 2503"
      },
      {
        "id": "route/mimo-v2.5-pro-6bit",
        "name": "MiMo V2.5 Pro 6bit"
      }
    ]
  },
  {
    "id": "xiaomi-token-plan-ams",
    "name": "Xiaomi Token Plan (Europe)",
    "envVars": [
      "XIAOMI_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://platform.xiaomimimo.com/#/docs",
    "notes": "API key provider.",
    "models": [
      {
        "id": "mimo-v2.5-pro",
        "name": "MiMo-V2.5-Pro"
      },
      {
        "id": "mimo-v2.5-tts",
        "name": "MiMo-V2.5-TTS"
      },
      {
        "id": "mimo-v2.5",
        "name": "MiMo-V2.5"
      }
    ]
  },
  {
    "id": "deepinfra",
    "name": "Deep Infra",
    "envVars": [
      "DEEPINFRA_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://deepinfra.com/models",
    "notes": "API key provider.",
    "models": [
      {
        "id": "XiaomiMiMo/MiMo-V2.5",
        "name": "MiMo-V2.5"
      },
      {
        "id": "XiaomiMiMo/MiMo-V2.5-Pro",
        "name": "MiMo-V2.5-Pro"
      },
      {
        "id": "MiniMaxAI/MiniMax-M2.5",
        "name": "MiniMax M2.5"
      }
    ]
  },
  {
    "id": "zhipuai",
    "name": "Zhipu AI",
    "envVars": [
      "ZHIPU_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://docs.z.ai/guides/overview/pricing",
    "notes": "API key provider.",
    "models": [
      {
        "id": "glm-5v-turbo",
        "name": "GLM-5V-Turbo"
      },
      {
        "id": "glm-5",
        "name": "GLM-5"
      },
      {
        "id": "glm-5.1",
        "name": "GLM-5.1"
      }
    ]
  },
  {
    "id": "io-net",
    "name": "IO.NET",
    "envVars": [
      "IOINTELLIGENCE_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://io.net/docs/guides/intelligence/io-intelligence",
    "notes": "API key provider.",
    "models": [
      {
        "id": "mistralai/Magistral-Small-2506",
        "name": "Magistral Small 2506"
      },
      {
        "id": "mistralai/Mistral-Large-Instruct-2411",
        "name": "Mistral Large Instruct 2411"
      },
      {
        "id": "mistralai/Mistral-Nemo-Instruct-2407",
        "name": "Mistral Nemo Instruct 2407"
      }
    ]
  },
  {
    "id": "groq",
    "name": "Groq",
    "envVars": [
      "GROQ_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://console.groq.com/docs/models",
    "notes": "API key provider.",
    "models": [
      {
        "id": "whisper-large-v3-turbo",
        "name": "Whisper Large v3 Turbo"
      },
      {
        "id": "llama3-8b-8192",
        "name": "Llama 3 8B"
      },
      {
        "id": "mistral-saba-24b",
        "name": "Mistral Saba 24B"
      }
    ]
  },
  {
    "id": "sap-ai-core",
    "name": "SAP AI Core",
    "envVars": [
      "AICORE_SERVICE_KEY"
    ],
    "authMethods": [
      "env"
    ],
    "docsUrl": "https://help.sap.com/docs/sap-ai-core",
    "notes": "Uses shell credentials.",
    "models": [
      {
        "id": "anthropic--claude-3-sonnet",
        "name": "anthropic--claude-3-sonnet"
      },
      {
        "id": "gpt-5-mini",
        "name": "gpt-5-mini"
      },
      {
        "id": "sonar",
        "name": "sonar"
      }
    ]
  },
  {
    "id": "lilac",
    "name": "Lilac",
    "envVars": [
      "LILAC_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://docs.getlilac.com/inference/models",
    "notes": "API key provider.",
    "models": [
      {
        "id": "zai-org/glm-5.1",
        "name": "GLM 5.1"
      },
      {
        "id": "moonshotai/kimi-k2.6",
        "name": "Kimi K2.6"
      },
      {
        "id": "minimaxai/minimax-m2.7",
        "name": "MiniMax M2.7"
      }
    ]
  },
  {
    "id": "stepfun-ai",
    "name": "StepFun AI",
    "envVars": [
      "STEPFUN_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://platform.stepfun.ai/docs/en/step-plan/integrations/open-code",
    "notes": "API key provider.",
    "models": [
      {
        "id": "step-3.5-flash-2603",
        "name": "Step 3.5 Flash 2603"
      },
      {
        "id": "step-3.5-flash",
        "name": "Step 3.5 Flash"
      }
    ]
  },
  {
    "id": "tencent-coding-plan",
    "name": "Tencent Coding Plan (China)",
    "envVars": [
      "TENCENT_CODING_PLAN_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://cloud.tencent.com/document/product/1772/128947",
    "notes": "API key provider.",
    "models": [
      {
        "id": "hunyuan-2.0-instruct",
        "name": "Tencent HY 2.0 Instruct"
      },
      {
        "id": "hunyuan-t1",
        "name": "Hunyuan-T1"
      },
      {
        "id": "hunyuan-turbos",
        "name": "Hunyuan-TurboS"
      }
    ]
  },
  {
    "id": "opencode-go",
    "name": "OpenCode Go",
    "envVars": [
      "OPENCODE_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://opencode.ai/docs/zen",
    "notes": "API key provider.",
    "models": [
      {
        "id": "minimax-m3",
        "name": "MiniMax M3"
      },
      {
        "id": "qwen3.5-plus",
        "name": "Qwen3.5 Plus"
      },
      {
        "id": "mimo-v2-omni",
        "name": "MiMo V2 Omni"
      }
    ]
  },
  {
    "id": "gitlab",
    "name": "GitLab Duo",
    "envVars": [
      "GITLAB_TOKEN"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://docs.gitlab.com/user/duo_agent_platform/",
    "notes": "API key provider.",
    "models": [
      {
        "id": "duo-chat-sonnet-4-5",
        "name": "Agentic Chat (Claude Sonnet 4.5)"
      },
      {
        "id": "duo-chat-gpt-5-4",
        "name": "Agentic Chat (GPT-5.4)"
      },
      {
        "id": "duo-chat-gpt-5-2",
        "name": "Agentic Chat (GPT-5.2)"
      }
    ]
  },
  {
    "id": "cortecs",
    "name": "Cortecs",
    "envVars": [
      "CORTECS_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://api.cortecs.ai/v1/models",
    "notes": "API key provider.",
    "models": [
      {
        "id": "nova-pro-v1",
        "name": "Nova Pro 1.0"
      },
      {
        "id": "claude-sonnet-4",
        "name": "Claude Sonnet 4"
      },
      {
        "id": "deepseek-r1-0528",
        "name": "DeepSeek R1 0528"
      }
    ]
  },
  {
    "id": "auriko",
    "name": "Auriko",
    "envVars": [
      "AURIKO_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://docs.auriko.ai",
    "notes": "API key provider.",
    "models": [
      {
        "id": "minimax-m2-7",
        "name": "MiniMax-M2.7"
      },
      {
        "id": "claude-sonnet-4-6",
        "name": "Claude Sonnet 4.6"
      },
      {
        "id": "minimax-m2-7-highspeed",
        "name": "MiniMax-M2.7-highspeed"
      }
    ]
  },
  {
    "id": "wafer.ai",
    "name": "Wafer",
    "envVars": [
      "WAFER_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://docs.wafer.ai/wafer-pass",
    "notes": "API key provider.",
    "models": [
      {
        "id": "Kimi-K2.6",
        "name": "Kimi-K2.6"
      },
      {
        "id": "Qwen3.6-35B-A3B",
        "name": "Qwen3.6-35B-A3B"
      },
      {
        "id": "qwen3.7-max",
        "name": "Qwen3.7-Max"
      }
    ]
  },
  {
    "id": "berget",
    "name": "Berget.AI",
    "envVars": [
      "BERGET_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://api.berget.ai",
    "notes": "API key provider.",
    "models": [
      {
        "id": "mistralai/Mistral-Medium-3.5-128B",
        "name": "Mistral Medium 3.5 128B"
      },
      {
        "id": "mistralai/Mistral-Small-3.2-24B-Instruct-2506",
        "name": "Mistral Small 3.2 24B Instruct 2506"
      },
      {
        "id": "zai-org/GLM-4.7",
        "name": "GLM 4.7"
      }
    ]
  },
  {
    "id": "cloudflare-ai-gateway",
    "name": "Cloudflare AI Gateway",
    "envVars": [
      "CLOUDFLARE_API_TOKEN",
      "CLOUDFLARE_ACCOUNT_ID",
      "CLOUDFLARE_GATEWAY_ID"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://developers.cloudflare.com/ai-gateway/",
    "notes": "API key provider.",
    "models": [
      {
        "id": "anthropic/claude-opus-4-5",
        "name": "Claude Opus 4.5 (latest)"
      },
      {
        "id": "anthropic/claude-sonnet-4",
        "name": "Claude Sonnet 4 (latest)"
      },
      {
        "id": "anthropic/claude-sonnet-4-6",
        "name": "Claude Sonnet 4.6"
      }
    ]
  },
  {
    "id": "requesty",
    "name": "Requesty",
    "envVars": [
      "REQUESTY_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://requesty.ai/solution/llm-routing/models",
    "notes": "API key provider.",
    "models": [
      {
        "id": "anthropic/claude-opus-4-5",
        "name": "Claude Opus 4.5"
      },
      {
        "id": "anthropic/claude-sonnet-4",
        "name": "Claude Sonnet 4"
      },
      {
        "id": "anthropic/claude-sonnet-4-6",
        "name": "Claude Sonnet 4.6"
      }
    ]
  },
  {
    "id": "venice",
    "name": "Venice AI",
    "envVars": [
      "VENICE_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://docs.venice.ai",
    "notes": "API key provider.",
    "models": [
      {
        "id": "nvidia-nemotron-cascade-2-30b-a3b",
        "name": "Nemotron Cascade 2 30B A3B"
      },
      {
        "id": "zai-org-glm-4.7-flash",
        "name": "GLM 4.7 Flash"
      },
      {
        "id": "openai-gpt-52",
        "name": "GPT-5.2"
      }
    ]
  },
  {
    "id": "azure",
    "name": "Azure",
    "envVars": [
      "AZURE_RESOURCE_NAME",
      "AZURE_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://learn.microsoft.com/en-us/azure/ai-services/openai/concepts/models",
    "notes": "API key provider.",
    "models": [
      {
        "id": "mistral-large-2411",
        "name": "Mistral Large 24.11"
      },
      {
        "id": "gpt-3.5-turbo-1106",
        "name": "GPT-3.5 Turbo 1106"
      },
      {
        "id": "claude-opus-4-5",
        "name": "Claude Opus 4.5"
      }
    ]
  },
  {
    "id": "atomic-chat",
    "name": "Atomic Chat",
    "envVars": [
      "ATOMIC_CHAT_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://atomic.chat",
    "notes": "API key provider.",
    "models": [
      {
        "id": "Meta-Llama-3_1-8B-Instruct-GGUF",
        "name": "Meta Llama 3.1 8B Instruct (GGUF)"
      },
      {
        "id": "gemma-4-E4B-it-IQ4_XS",
        "name": "Gemma 4 E4B Instruct (IQ4_XS)"
      },
      {
        "id": "Qwen3_5-9B-MLX-4bit",
        "name": "Qwen 3.5 9B (MLX 4-bit)"
      }
    ]
  },
  {
    "id": "merge-gateway",
    "name": "Merge Gateway",
    "envVars": [
      "MERGE_GATEWAY_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://docs.merge.dev/merge-gateway",
    "notes": "API key provider.",
    "models": [
      {
        "id": "deepseek/deepseek-v4-flash",
        "name": "DeepSeek V4 Flash"
      },
      {
        "id": "deepseek/deepseek-v4-pro",
        "name": "DeepSeek V4 Pro"
      },
      {
        "id": "anthropic/claude-sonnet-4-6",
        "name": "Claude Sonnet 4.6"
      }
    ]
  },
  {
    "id": "stepfun",
    "name": "StepFun",
    "envVars": [
      "STEPFUN_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://platform.stepfun.com/docs/zh/overview/concept",
    "notes": "API key provider.",
    "models": [
      {
        "id": "step-2-16k",
        "name": "Step 2 (16K)"
      },
      {
        "id": "step-1-32k",
        "name": "Step 1 (32K)"
      },
      {
        "id": "step-3.5-flash",
        "name": "Step 3.5 Flash"
      }
    ]
  },
  {
    "id": "anyapi",
    "name": "AnyAPI",
    "envVars": [
      "ANYAPI_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://docs.anyapi.ai",
    "notes": "API key provider.",
    "models": [
      {
        "id": "mistralai/mistral-large-2512",
        "name": "Mistral Large 3"
      },
      {
        "id": "mistralai/devstral-2512",
        "name": "Devstral 2"
      },
      {
        "id": "deepseek/deepseek-r1",
        "name": "DeepSeek Reasoner"
      }
    ]
  },
  {
    "id": "vultr",
    "name": "Vultr",
    "envVars": [
      "VULTR_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://api.vultrinference.com/",
    "notes": "API key provider.",
    "models": [
      {
        "id": "MiniMaxAI/MiniMax-M2.7",
        "name": "MiniMax-M2.7"
      },
      {
        "id": "zai-org/GLM-5.1-FP8",
        "name": "GLM-5.1"
      },
      {
        "id": "moonshotai/Kimi-K2.6",
        "name": "Kimi K2.6"
      }
    ]
  },
  {
    "id": "zai-coding-plan",
    "name": "Z.AI Coding Plan",
    "envVars": [
      "ZHIPU_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://docs.z.ai/devpack/overview",
    "notes": "API key provider.",
    "models": [
      {
        "id": "glm-4.7",
        "name": "GLM-4.7"
      },
      {
        "id": "glm-5v-turbo",
        "name": "GLM-5V-Turbo"
      },
      {
        "id": "glm-5-turbo",
        "name": "GLM-5-Turbo"
      }
    ]
  },
  {
    "id": "amazon-bedrock",
    "name": "Amazon Bedrock",
    "envVars": [
      "AWS_ACCESS_KEY_ID",
      "AWS_SECRET_ACCESS_KEY",
      "AWS_REGION",
      "AWS_BEARER_TOKEN_BEDROCK"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://docs.aws.amazon.com/bedrock/latest/userguide/models-supported.html",
    "notes": "API key provider.",
    "models": [
      {
        "id": "eu.anthropic.claude-haiku-4-5-20251001-v1:0",
        "name": "Claude Haiku 4.5 (EU)"
      },
      {
        "id": "qwen.qwen3-coder-30b-a3b-v1:0",
        "name": "Qwen3 Coder 30B A3B Instruct"
      },
      {
        "id": "jp.anthropic.claude-opus-4-8",
        "name": "Claude Opus 4.8 (JP)"
      }
    ]
  },
  {
    "id": "synthetic",
    "name": "Synthetic",
    "envVars": [
      "SYNTHETIC_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://synthetic.new/pricing",
    "notes": "API key provider.",
    "models": [
      {
        "id": "hf:openai/gpt-oss-120b",
        "name": "GPT OSS 120B"
      },
      {
        "id": "hf:meta-llama/Llama-3.1-70B-Instruct",
        "name": "Llama-3.1-70B-Instruct"
      },
      {
        "id": "hf:meta-llama/Llama-3.1-405B-Instruct",
        "name": "Llama-3.1-405B-Instruct"
      }
    ]
  },
  {
    "id": "cloudferro-sherlock",
    "name": "CloudFerro Sherlock",
    "envVars": [
      "CLOUDFERRO_SHERLOCK_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://docs.sherlock.cloudferro.com/",
    "notes": "API key provider.",
    "models": [
      {
        "id": "MiniMaxAI/MiniMax-M2.5",
        "name": "MiniMax-M2.5"
      },
      {
        "id": "meta-llama/Llama-3.3-70B-Instruct",
        "name": "Llama 3.3 70B Instruct"
      },
      {
        "id": "speakleash/Bielik-11B-v2.6-Instruct",
        "name": "Bielik 11B v2.6 Instruct"
      }
    ]
  },
  {
    "id": "helicone",
    "name": "Helicone",
    "envVars": [
      "HELICONE_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://helicone.ai/models",
    "notes": "API key provider.",
    "models": [
      {
        "id": "chatgpt-4o-latest",
        "name": "OpenAI ChatGPT-4o"
      },
      {
        "id": "mistral-large-2411",
        "name": "Mistral-Large"
      },
      {
        "id": "gpt-5-pro",
        "name": "OpenAI: GPT-5 Pro"
      }
    ]
  },
  {
    "id": "zai",
    "name": "Z.AI",
    "envVars": [
      "ZHIPU_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://docs.z.ai/guides/overview/pricing",
    "notes": "API key provider.",
    "models": [
      {
        "id": "glm-4.5-flash",
        "name": "GLM-4.5-Flash"
      },
      {
        "id": "glm-4.7-flashx",
        "name": "GLM-4.7-FlashX"
      },
      {
        "id": "glm-4.6",
        "name": "GLM-4.6"
      }
    ]
  },
  {
    "id": "nova",
    "name": "Nova",
    "envVars": [
      "NOVA_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://nova.amazon.com/dev/documentation",
    "notes": "API key provider.",
    "models": [
      {
        "id": "nova-2-pro-v1",
        "name": "Nova 2 Pro"
      },
      {
        "id": "nova-2-lite-v1",
        "name": "Nova 2 Lite"
      }
    ]
  },
  {
    "id": "nearai",
    "name": "NEAR AI Cloud",
    "envVars": [
      "NEARAI_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://docs.near.ai/",
    "notes": "API key provider.",
    "models": [
      {
        "id": "zai-org/GLM-5.1-FP8",
        "name": "GLM-5.1 FP8"
      },
      {
        "id": "anthropic/claude-sonnet-4-6",
        "name": "Claude Sonnet 4.6"
      },
      {
        "id": "anthropic/claude-haiku-4-5",
        "name": "Claude Haiku 4.5 (latest)"
      }
    ]
  },
  {
    "id": "inceptron",
    "name": "Inceptron",
    "envVars": [
      "INCEPTRON_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://docs.inceptron.io",
    "notes": "API key provider.",
    "models": [
      {
        "id": "MiniMaxAI/MiniMax-M2.5",
        "name": "MiniMax M2.5"
      },
      {
        "id": "zai-org/GLM-5.1-FP8",
        "name": "GLM 5.1"
      },
      {
        "id": "moonshotai/Kimi-K2.6",
        "name": "Kimi K2.6"
      }
    ]
  },
  {
    "id": "xpersona",
    "name": "Xpersona",
    "envVars": [
      "XPERSONA_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://www.xpersona.co/docs",
    "notes": "API key provider.",
    "models": [
      {
        "id": "xpersona-gpt-5.5",
        "name": "GPT-5.5"
      },
      {
        "id": "xpersona-frieren-coder",
        "name": "Xpersona Frieren 1"
      }
    ]
  },
  {
    "id": "perplexity-agent",
    "name": "Perplexity Agent",
    "envVars": [
      "PERPLEXITY_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://docs.perplexity.ai/docs/agent-api/models",
    "notes": "API key provider.",
    "models": [
      {
        "id": "anthropic/claude-opus-4-5",
        "name": "Claude Opus 4.5"
      },
      {
        "id": "anthropic/claude-sonnet-4-6",
        "name": "Claude Sonnet 4.6"
      },
      {
        "id": "anthropic/claude-haiku-4-5",
        "name": "Claude Haiku 4.5"
      }
    ]
  },
  {
    "id": "jiekou",
    "name": "Jiekou.AI",
    "envVars": [
      "JIEKOU_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://docs.jiekou.ai/docs/support/quickstart?utm_source=github_models.dev",
    "notes": "API key provider.",
    "models": [
      {
        "id": "gemini-2.5-flash-lite-preview-06-17",
        "name": "gemini-2.5-flash-lite-preview-06-17"
      },
      {
        "id": "gpt-5-pro",
        "name": "gpt-5-pro"
      },
      {
        "id": "gpt-5-mini",
        "name": "gpt-5-mini"
      }
    ]
  },
  {
    "id": "abliteration-ai",
    "name": "abliteration.ai",
    "envVars": [
      "ABLIT_KEY"
    ],
    "authMethods": [
      "env"
    ],
    "docsUrl": "https://docs.abliteration.ai/models",
    "notes": "Uses shell credentials.",
    "models": [
      {
        "id": "abliterated-model",
        "name": "Abliterated Model"
      }
    ]
  },
  {
    "id": "minimax-cn",
    "name": "MiniMax (minimaxi.com)",
    "envVars": [
      "MINIMAX_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://platform.minimaxi.com/docs/guides/quickstart",
    "notes": "API key provider.",
    "models": [
      {
        "id": "MiniMax-M2.5",
        "name": "MiniMax-M2.5"
      },
      {
        "id": "MiniMax-M3",
        "name": "MiniMax-M3"
      },
      {
        "id": "MiniMax-M2.5-highspeed",
        "name": "MiniMax-M2.5-highspeed"
      }
    ]
  },
  {
    "id": "qiniu-ai",
    "name": "Qiniu",
    "envVars": [
      "QINIU_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://developer.qiniu.com/aitokenapi",
    "notes": "API key provider.",
    "models": [
      {
        "id": "qwen3-30b-a3b-instruct-2507",
        "name": "Qwen3 30b A3b Instruct 2507"
      },
      {
        "id": "deepseek-r1-0528",
        "name": "DeepSeek-R1-0528"
      },
      {
        "id": "doubao-seed-2.0-code",
        "name": "Doubao Seed 2.0 Code"
      }
    ]
  },
  {
    "id": "morph",
    "name": "Morph",
    "envVars": [
      "MORPH_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://docs.morphllm.com/api-reference/introduction",
    "notes": "API key provider.",
    "models": [
      {
        "id": "morph-v3-fast",
        "name": "Morph v3 Fast"
      },
      {
        "id": "morph-v3-large",
        "name": "Morph v3 Large"
      },
      {
        "id": "auto",
        "name": "Auto"
      }
    ]
  },
  {
    "id": "xiaomi-token-plan-sgp",
    "name": "Xiaomi Token Plan (Singapore)",
    "envVars": [
      "XIAOMI_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://platform.xiaomimimo.com/#/docs",
    "notes": "API key provider.",
    "models": [
      {
        "id": "mimo-v2.5-pro",
        "name": "MiMo-V2.5-Pro"
      },
      {
        "id": "mimo-v2.5-tts",
        "name": "MiMo-V2.5-TTS"
      },
      {
        "id": "mimo-v2.5",
        "name": "MiMo-V2.5"
      }
    ]
  },
  {
    "id": "fastrouter",
    "name": "FastRouter",
    "envVars": [
      "FASTROUTER_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://fastrouter.ai/models",
    "notes": "API key provider.",
    "models": [
      {
        "id": "z-ai/glm-5",
        "name": "GLM-5"
      },
      {
        "id": "anthropic/claude-sonnet-4",
        "name": "Claude Sonnet 4"
      },
      {
        "id": "anthropic/claude-opus-4.1",
        "name": "Claude Opus 4.1"
      }
    ]
  },
  {
    "id": "siliconflow",
    "name": "SiliconFlow",
    "envVars": [
      "SILICONFLOW_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://cloud.siliconflow.com/models",
    "notes": "API key provider.",
    "models": [
      {
        "id": "THUDM/GLM-Z1-32B-0414",
        "name": "THUDM/GLM-Z1-32B-0414"
      },
      {
        "id": "THUDM/GLM-Z1-9B-0414",
        "name": "THUDM/GLM-Z1-9B-0414"
      },
      {
        "id": "THUDM/GLM-4-32B-0414",
        "name": "THUDM/GLM-4-32B-0414"
      }
    ]
  },
  {
    "id": "vercel",
    "name": "Vercel AI Gateway",
    "envVars": [
      "AI_GATEWAY_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://github.com/vercel/ai/tree/5eb85cc45a259553501f535b8ac79a77d0e79223/packages/gateway",
    "notes": "API key provider.",
    "models": [
      {
        "id": "kwaipilot/kat-coder-pro-v2",
        "name": "Kat Coder Pro V2"
      },
      {
        "id": "kwaipilot/kat-coder-pro-v1",
        "name": "KAT-Coder-Pro V1"
      },
      {
        "id": "bfl/flux-kontext-max",
        "name": "FLUX.1 Kontext Max"
      }
    ]
  },
  {
    "id": "abacus",
    "name": "Abacus",
    "envVars": [
      "ABACUS_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://abacus.ai/help/api",
    "notes": "API key provider.",
    "models": [
      {
        "id": "route-llm",
        "name": "Route LLM"
      },
      {
        "id": "claude-sonnet-4-6",
        "name": "Claude Sonnet 4.6"
      },
      {
        "id": "gpt-5-mini",
        "name": "GPT-5 Mini"
      }
    ]
  },
  {
    "id": "drun",
    "name": "D.Run (China)",
    "envVars": [
      "DRUN_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://www.d.run",
    "notes": "API key provider.",
    "models": [
      {
        "id": "public/deepseek-r1",
        "name": "DeepSeek R1"
      },
      {
        "id": "public/minimax-m25",
        "name": "MiniMax M2.5"
      },
      {
        "id": "public/deepseek-v3",
        "name": "DeepSeek V3"
      }
    ]
  },
  {
    "id": "wandb",
    "name": "Weights & Biases",
    "envVars": [
      "WANDB_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://docs.wandb.ai/guides/integrations/inference/",
    "notes": "API key provider.",
    "models": [
      {
        "id": "MiniMaxAI/MiniMax-M2.5",
        "name": "MiniMax M2.5"
      },
      {
        "id": "zai-org/GLM-5.1",
        "name": "GLM-5.1"
      },
      {
        "id": "zai-org/GLM-5-FP8",
        "name": "GLM 5"
      }
    ]
  },
  {
    "id": "meganova",
    "name": "Meganova",
    "envVars": [
      "MEGANOVA_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://docs.meganova.ai",
    "notes": "API key provider.",
    "models": [
      {
        "id": "XiaomiMiMo/MiMo-V2-Flash",
        "name": "MiMo V2 Flash"
      },
      {
        "id": "mistralai/Mistral-Nemo-Instruct-2407",
        "name": "Mistral Nemo Instruct 2407"
      },
      {
        "id": "mistralai/Mistral-Small-3.2-24B-Instruct-2506",
        "name": "Mistral Small 3.2 24B Instruct"
      }
    ]
  },
  {
    "id": "opencode",
    "name": "OpenCode Zen",
    "envVars": [
      "OPENCODE_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://opencode.ai/docs/zen",
    "notes": "API key provider.",
    "models": [
      {
        "id": "claude-opus-4-5",
        "name": "Claude Opus 4.5"
      },
      {
        "id": "mimo-v2-flash-free",
        "name": "MiMo V2 Flash Free"
      },
      {
        "id": "claude-sonnet-4",
        "name": "Claude Sonnet 4"
      }
    ]
  },
  {
    "id": "poolside",
    "name": "Poolside",
    "envVars": [
      "POOLSIDE_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://platform.poolside.ai",
    "notes": "API key provider.",
    "models": [
      {
        "id": "poolside/laguna-m.1",
        "name": "Laguna M.1"
      },
      {
        "id": "poolside/laguna-xs.2",
        "name": "Laguna XS.2"
      }
    ]
  },
  {
    "id": "sarvam",
    "name": "Sarvam AI",
    "envVars": [
      "SARVAM_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://docs.sarvam.ai/api-reference-docs/getting-started/models",
    "notes": "API key provider.",
    "models": [
      {
        "id": "sarvam-105b",
        "name": "Sarvam-105B"
      },
      {
        "id": "sarvam-30b",
        "name": "Sarvam-30B"
      }
    ]
  },
  {
    "id": "baseten",
    "name": "Baseten",
    "envVars": [
      "BASETEN_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://docs.baseten.co/development/model-apis/overview",
    "notes": "API key provider.",
    "models": [
      {
        "id": "MiniMaxAI/MiniMax-M2.5",
        "name": "MiniMax-M2.5"
      },
      {
        "id": "zai-org/GLM-4.7",
        "name": "GLM-4.7"
      },
      {
        "id": "zai-org/GLM-5",
        "name": "GLM-5"
      }
    ]
  },
  {
    "id": "lucidquery",
    "name": "LucidQuery AI",
    "envVars": [
      "LUCIDQUERY_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://lucidquery.com/api/docs",
    "notes": "API key provider.",
    "models": [
      {
        "id": "lucidquery-nexus-coder",
        "name": "LucidQuery Nexus Coder"
      },
      {
        "id": "lucidnova-rf1-100b",
        "name": "LucidNova RF1 100B"
      }
    ]
  },
  {
    "id": "scaleway",
    "name": "Scaleway",
    "envVars": [
      "SCALEWAY_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://www.scaleway.com/en/docs/generative-apis/",
    "notes": "API key provider.",
    "models": [
      {
        "id": "bge-multilingual-gemma2",
        "name": "BGE Multilingual Gemma2"
      },
      {
        "id": "qwen3-coder-30b-a3b-instruct",
        "name": "Qwen3-Coder 30B-A3B Instruct"
      },
      {
        "id": "mistral-small-3.2-24b-instruct-2506",
        "name": "Mistral Small 3.2 24B Instruct (2506)"
      }
    ]
  },
  {
    "id": "cerebras",
    "name": "Cerebras",
    "envVars": [
      "CEREBRAS_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://inference-docs.cerebras.ai/models/overview",
    "notes": "API key provider.",
    "models": [
      {
        "id": "zai-glm-4.7",
        "name": "Z.AI GLM-4.7"
      },
      {
        "id": "gpt-oss-120b",
        "name": "GPT OSS 120B"
      },
      {
        "id": "llama3.1-8b",
        "name": "Llama 3.1 8B"
      }
    ]
  },
  {
    "id": "hpc-ai",
    "name": "HPC-AI",
    "envVars": [
      "HPC_AI_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://www.hpc-ai.com/doc/docs/quickstart/",
    "notes": "API key provider.",
    "models": [
      {
        "id": "zai-org/glm-5.1",
        "name": "GLM 5.1"
      },
      {
        "id": "moonshotai/kimi-k2.5",
        "name": "Kimi K2.5"
      },
      {
        "id": "minimax/minimax-m2.5",
        "name": "MiniMax M2.5"
      }
    ]
  },
  {
    "id": "alibaba-token-plan",
    "name": "Alibaba Token Plan",
    "envVars": [
      "ALIBABA_TOKEN_PLAN_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://www.alibabacloud.com/help/en/model-studio/token-plan-overview",
    "notes": "API key provider.",
    "models": [
      {
        "id": "MiniMax-M2.5",
        "name": "MiniMax-M2.5"
      },
      {
        "id": "qwen-image-2.0-pro",
        "name": "Qwen Image 2.0 Pro"
      },
      {
        "id": "deepseek-v3.2",
        "name": "DeepSeek V3.2"
      }
    ]
  },
  {
    "id": "tencent-tokenhub",
    "name": "Tencent TokenHub",
    "envVars": [
      "TENCENT_TOKENHUB_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://cloud.tencent.com/document/product/1823/130050",
    "notes": "API key provider.",
    "models": [
      {
        "id": "hy3-preview",
        "name": "Hy3 preview"
      }
    ]
  },
  {
    "id": "alibaba-coding-plan-cn",
    "name": "Alibaba Coding Plan (China)",
    "envVars": [
      "ALIBABA_CODING_PLAN_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://help.aliyun.com/zh/model-studio/coding-plan",
    "notes": "API key provider.",
    "models": [
      {
        "id": "MiniMax-M2.5",
        "name": "MiniMax-M2.5"
      },
      {
        "id": "qwen3.5-plus",
        "name": "Qwen3.5 Plus"
      },
      {
        "id": "qwen3-coder-plus",
        "name": "Qwen3 Coder Plus"
      }
    ]
  },
  {
    "id": "cloudflare-workers-ai",
    "name": "Cloudflare Workers AI",
    "envVars": [
      "CLOUDFLARE_ACCOUNT_ID",
      "CLOUDFLARE_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://developers.cloudflare.com/workers-ai/models/",
    "notes": "API key provider.",
    "models": [
      {
        "id": "@cf/mistralai/mistral-small-3.1-24b-instruct",
        "name": "Mistral Small 3.1 24B Instruct"
      },
      {
        "id": "@cf/zai-org/glm-4.7-flash",
        "name": "GLM-4.7-Flash"
      },
      {
        "id": "@cf/qwen/qwen2.5-coder-32b-instruct",
        "name": "Qwen2.5 Coder 32B Instruct"
      }
    ]
  },
  {
    "id": "nebius",
    "name": "Nebius Token Factory",
    "envVars": [
      "NEBIUS_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://docs.tokenfactory.nebius.com/",
    "notes": "API key provider.",
    "models": [
      {
        "id": "MiniMaxAI/MiniMax-M2.5",
        "name": "MiniMax-M2.5"
      },
      {
        "id": "MiniMaxAI/MiniMax-M2.5-fast",
        "name": "MiniMax-M2.5-fast"
      },
      {
        "id": "zai-org/GLM-5",
        "name": "GLM-5"
      }
    ]
  },
  {
    "id": "minimax",
    "name": "MiniMax (minimax.io)",
    "envVars": [
      "MINIMAX_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://platform.minimax.io/docs/guides/quickstart",
    "notes": "API key provider.",
    "models": [
      {
        "id": "MiniMax-M2.5",
        "name": "MiniMax-M2.5"
      },
      {
        "id": "MiniMax-M3",
        "name": "MiniMax-M3"
      },
      {
        "id": "MiniMax-M2.5-highspeed",
        "name": "MiniMax-M2.5-highspeed"
      }
    ]
  },
  {
    "id": "llama",
    "name": "Llama",
    "envVars": [
      "LLAMA_API_KEY"
    ],
    "authMethods": [
      "api-key",
      "env"
    ],
    "docsUrl": "https://llama.developer.meta.com/docs/models",
    "notes": "API key provider.",
    "models": [
      {
        "id": "cerebras-llama-4-maverick-17b-128e-instruct",
        "name": "Cerebras-Llama-4-Maverick-17B-128E-Instruct"
      },
      {
        "id": "groq-llama-4-maverick-17b-128e-instruct",
        "name": "Groq-Llama-4-Maverick-17B-128E-Instruct"
      },
      {
        "id": "llama-4-maverick-17b-128e-instruct-fp8",
        "name": "Llama-4-Maverick-17B-128E-Instruct-FP8"
      }
    ]
  }
];
