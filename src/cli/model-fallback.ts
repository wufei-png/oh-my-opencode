import {
  CLI_AGENT_MODEL_REQUIREMENTS,
  CLI_CATEGORY_MODEL_REQUIREMENTS,
} from "./model-fallback-requirements"
import type { FallbackModelObject } from "../config/schema/fallback-models"
import type { FallbackEntry } from "../shared/model-requirements"
import type { InstallConfig } from "./types"

import type { AgentConfig, CategoryConfig, GeneratedOmoConfig } from "./model-fallback-types"
import { applyOpenAiOnlyModelCatalog, isOpenAiOnlyAvailability } from "./openai-only-model-catalog"
import { isProviderAvailable, toProviderAvailability } from "./provider-availability"
import {
	getSisyphusFallbackChain,
	isAnyFallbackEntryAvailable,
	isRequiredModelAvailable,
	isRequiredProviderAvailable,
	resolveModelFromChain,
} from "./fallback-chain-resolution"
import { transformModelForProvider } from "./provider-model-id-transform"

export type { GeneratedOmoConfig } from "./model-fallback-types"

const ZAI_MODEL = "zai-coding-plan/glm-4.7"
const MINIMAX_STANDARD_MODEL_ID = "MiniMax-M2.7"
const MINIMAX_HIGHSPEED_MODEL_ID = "MiniMax-M2.7-highspeed"

const ULTIMATE_FALLBACK = "opencode/gpt-5-nano"
const SCHEMA_URL = "https://raw.githubusercontent.com/code-yeongyu/oh-my-openagent/dev/assets/oh-my-opencode.schema.json"

function getMiniMaxModelId(config: InstallConfig): string {
  return config.minimaxModelVariant === "highspeed"
    ? MINIMAX_HIGHSPEED_MODEL_ID
    : MINIMAX_STANDARD_MODEL_ID
}

function getMiniMaxModel(providerID: "minimax-cn-coding-plan" | "minimax-coding-plan", config: InstallConfig): string {
  return `${providerID}/${getMiniMaxModelId(config)}`
}

function getPreferredMiniMaxModel(
  availability: ReturnType<typeof toProviderAvailability>,
  config: InstallConfig,
): string | undefined {
  if (availability.minimaxCodingPlan) {
    return getMiniMaxModel("minimax-coding-plan", config)
  }

  if (availability.minimaxCnCodingPlan) {
    return getMiniMaxModel("minimax-cn-coding-plan", config)
  }

  return undefined
}

function applyMiniMaxVariant(model: string, config: InstallConfig): string {
  if (!model.includes("minimax-cn-coding-plan/") && !model.includes("minimax-coding-plan/")) {
    return model
  }

  return model.replace(/MiniMax-M2\.7(-highspeed)?$/, getMiniMaxModelId(config))
}

function toFallbackModelObject(entry: FallbackEntry, provider: string, config: InstallConfig): FallbackModelObject {
  return {
    model: applyMiniMaxVariant(`${provider}/${transformModelForProvider(provider, entry.model)}`, config),
    ...(entry.variant ? { variant: entry.variant } : {}),
    ...(entry.reasoningEffort ? { reasoningEffort: entry.reasoningEffort as FallbackModelObject["reasoningEffort"] } : {}),
    ...(entry.temperature !== undefined ? { temperature: entry.temperature } : {}),
    ...(entry.top_p !== undefined ? { top_p: entry.top_p } : {}),
    ...(entry.maxTokens !== undefined ? { maxTokens: entry.maxTokens } : {}),
    ...(entry.thinking ? { thinking: entry.thinking } : {}),
  }
}

function collectAvailableFallbacks(
  fallbackChain: FallbackEntry[],
  availability: ReturnType<typeof toProviderAvailability>,
  config: InstallConfig,
): FallbackModelObject[] {
  const expandedFallbacks = fallbackChain.flatMap((entry) =>
    entry.providers
      .filter((provider) => isProviderAvailable(provider, availability))
      .map((provider) => toFallbackModelObject(entry, provider, config))
  )
  return expandedFallbacks.filter((entry, index, allEntries) =>
    allEntries.findIndex((candidate) =>
      candidate.model === entry.model &&
      candidate.variant === entry.variant
    ) === index
  )
}

function attachFallbackModels<T extends AgentConfig | CategoryConfig>(
  config: T,
  fallbackChain: FallbackEntry[],
  availability: ReturnType<typeof toProviderAvailability>,
  installConfig: InstallConfig,
): T {
  const uniqueFallbacks = collectAvailableFallbacks(fallbackChain, availability, installConfig)
  const primaryIndex = uniqueFallbacks.findIndex((entry) => entry.model === config.model)
  if (primaryIndex === -1) {
    return config
  }

  const fallbackModels = uniqueFallbacks.slice(primaryIndex + 1)
  if (fallbackModels.length === 0) {
    return config
  }

  return {
    ...config,
    fallback_models: fallbackModels,
  }
}

function attachAllFallbackModels<T extends AgentConfig | CategoryConfig>(
  config: T,
  fallbackChain: FallbackEntry[],
  availability: ReturnType<typeof toProviderAvailability>,
  installConfig: InstallConfig,
): T {
  const uniqueFallbacks = collectAvailableFallbacks(fallbackChain, availability, installConfig)
  const fallbackModels = uniqueFallbacks.filter((entry) => entry.model !== config.model)
  if (fallbackModels.length === 0) {
    return config
  }

  return {
    ...config,
    fallback_models: fallbackModels,
  }
}



export function generateModelConfig(config: InstallConfig): GeneratedOmoConfig {
  const avail = toProviderAvailability(config)
  const hasAnyProvider =
    avail.native.claude ||
    avail.native.openai ||
    avail.native.gemini ||
    avail.opencodeZen ||
    avail.copilot ||
    avail.zai ||
    avail.kimiForCoding ||
    avail.opencodeGo ||
    avail.minimaxCnCodingPlan ||
    avail.minimaxCodingPlan ||
    avail.vercelAiGateway
  if (!hasAnyProvider) {
    return {
      $schema: SCHEMA_URL,
      agents: Object.fromEntries(
        Object.entries(CLI_AGENT_MODEL_REQUIREMENTS)
          .filter(([role, req]) => !(role === "sisyphus" && req.requiresAnyModel))
          .map(([role]) => [role, { model: ULTIMATE_FALLBACK }])
      ),
      categories: Object.fromEntries(
        Object.keys(CLI_CATEGORY_MODEL_REQUIREMENTS).map((cat) => [cat, { model: ULTIMATE_FALLBACK }])
      ),
    }
  }

  const agents: Record<string, AgentConfig> = {}
  const categories: Record<string, CategoryConfig> = {}

  for (const [role, req] of Object.entries(CLI_AGENT_MODEL_REQUIREMENTS)) {
    if (role === "librarian") {
      let agentConfig: AgentConfig | undefined
      const preferredMiniMaxModel = getPreferredMiniMaxModel(avail, config)
      if (avail.native.openai) {
        agentConfig = { model: "openai/gpt-5.4-mini-fast" }
      } else if (avail.opencodeGo) {
        agentConfig = { model: "opencode-go/qwen3.5-plus" }
      } else if (avail.zai) {
        agentConfig = { model: ZAI_MODEL }
      } else if (preferredMiniMaxModel) {
        agentConfig = { model: preferredMiniMaxModel }
      } else if (avail.vercelAiGateway) {
        agentConfig = { model: "vercel/minimax/minimax-m2.7" }
      }
      if (agentConfig) {
        agents[role] = attachAllFallbackModels(agentConfig, req.fallbackChain, avail, config)
      }
      continue
    }

    if (role === "explore") {
      let agentConfig: AgentConfig
      const preferredMiniMaxModel = getPreferredMiniMaxModel(avail, config)
      if (avail.native.openai) {
        agentConfig = { model: "openai/gpt-5.4-mini-fast" }
      } else if (avail.native.claude) {
        agentConfig = { model: "anthropic/claude-haiku-4-5" }
      } else if (avail.opencodeZen) {
        agentConfig = { model: "opencode/claude-haiku-4-5" }
      } else if (avail.opencodeGo) {
        agentConfig = { model: "opencode-go/qwen3.5-plus" }
      } else if (avail.copilot) {
        agentConfig = { model: "github-copilot/gpt-5-mini" }
      } else if (preferredMiniMaxModel) {
        agentConfig = { model: preferredMiniMaxModel }
      } else if (avail.vercelAiGateway) {
        agentConfig = { model: "vercel/minimax/minimax-m2.7-highspeed" }
      } else {
        agentConfig = { model: "opencode/gpt-5-nano" }
      }
      agents[role] = attachAllFallbackModels(agentConfig, req.fallbackChain, avail, config)
      continue
    }

    if (role === "sisyphus") {
      const fallbackChain = getSisyphusFallbackChain()
      if (req.requiresAnyModel && !isAnyFallbackEntryAvailable(fallbackChain, avail)) {
        continue
      }
      const resolved = resolveModelFromChain(fallbackChain, avail)
      if (resolved) {
        const variant = resolved.variant ?? req.variant
        const model = applyMiniMaxVariant(resolved.model, config)
        const agentConfig = variant ? { model, variant } : { model }
        agents[role] = attachFallbackModels(agentConfig, fallbackChain, avail, config)
      }
      continue
    }

    if (req.requiresModel && !isRequiredModelAvailable(req.requiresModel, req.fallbackChain, avail)) {
      continue
    }
    if (req.requiresProvider && !isRequiredProviderAvailable(req.requiresProvider, avail)) {
      continue
    }

    const resolved = resolveModelFromChain(req.fallbackChain, avail)
    if (resolved) {
      const variant = resolved.variant ?? req.variant
      const model = applyMiniMaxVariant(resolved.model, config)
      const agentConfig = variant ? { model, variant } : { model }
      agents[role] = attachFallbackModels(agentConfig, req.fallbackChain, avail, config)
    } else {
      agents[role] = { model: ULTIMATE_FALLBACK }
    }
  }

  for (const [cat, req] of Object.entries(CLI_CATEGORY_MODEL_REQUIREMENTS)) {
    // Special case: unspecified-high downgrades to unspecified-low when not isMaxPlan
    const fallbackChain =
      cat === "unspecified-high" && !avail.isMaxPlan
        ? CLI_CATEGORY_MODEL_REQUIREMENTS["unspecified-low"].fallbackChain
        : req.fallbackChain

    if (req.requiresModel && !isRequiredModelAvailable(req.requiresModel, req.fallbackChain, avail)) {
      continue
    }
    if (req.requiresProvider && !isRequiredProviderAvailable(req.requiresProvider, avail)) {
      continue
    }

    const resolved = resolveModelFromChain(fallbackChain, avail)
    if (resolved) {
      const variant = resolved.variant ?? req.variant
      const model = applyMiniMaxVariant(resolved.model, config)
      const categoryConfig = variant ? { model, variant } : { model }
      categories[cat] = attachFallbackModels(categoryConfig, fallbackChain, avail, config)
    } else {
      categories[cat] = { model: ULTIMATE_FALLBACK }
    }
  }

  const generatedConfig: GeneratedOmoConfig = {
    $schema: SCHEMA_URL,
    agents,
    categories,
  }

  return isOpenAiOnlyAvailability(avail)
    ? applyOpenAiOnlyModelCatalog(generatedConfig)
    : generatedConfig
}

export function shouldShowChatGPTOnlyWarning(config: InstallConfig): boolean {
  return !config.hasClaude && !config.hasGemini && config.hasOpenAI
}
