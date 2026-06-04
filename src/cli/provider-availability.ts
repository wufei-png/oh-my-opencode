import type { InstallConfig } from "./types"
import type { ProviderAvailability } from "./model-fallback-types"

export function toProviderAvailability(config: InstallConfig): ProviderAvailability {
  return {
    native: {
      claude: config.hasClaude,
      openai: config.hasOpenAI,
      gemini: config.hasGemini,
    },
    opencodeZen: config.hasOpencodeZen,
    copilot: config.hasCopilot,
    zai: config.hasZaiCodingPlan,
    kimiForCoding: config.hasKimiForCoding,
    opencodeGo: config.hasOpencodeGo,
    minimaxCnCodingPlan: config.hasMinimaxCnCodingPlan,
    minimaxCodingPlan: config.hasMinimaxCodingPlan,
    vercelAiGateway: config.hasVercelAiGateway,
    isMaxPlan: config.isMax20,
  }
}

export function hasAnyAvailableProvider(availability: ProviderAvailability): boolean {
  return (
    availability.native.claude ||
    availability.native.openai ||
    availability.native.gemini ||
    availability.opencodeZen ||
    availability.copilot ||
    availability.zai ||
    availability.kimiForCoding ||
    availability.opencodeGo ||
    availability.minimaxCnCodingPlan ||
    availability.minimaxCodingPlan ||
    availability.vercelAiGateway
  )
}

export function hasAnyNonOpenAiProvider(availability: ProviderAvailability): boolean {
  return (
    availability.native.claude ||
    availability.native.gemini ||
    availability.opencodeZen ||
    availability.copilot ||
    availability.zai ||
    availability.kimiForCoding ||
    availability.opencodeGo ||
    availability.minimaxCnCodingPlan ||
    availability.minimaxCodingPlan ||
    availability.vercelAiGateway
  )
}

export function isOpenAiOnlyAvailability(availability: ProviderAvailability): boolean {
  return availability.native.openai && !hasAnyNonOpenAiProvider(availability)
}

export function isProviderAvailable(provider: string, availability: ProviderAvailability): boolean {
  const mapping: Record<string, boolean> = {
    anthropic: availability.native.claude,
    openai: availability.native.openai,
    google: availability.native.gemini,
    "github-copilot": availability.copilot,
    opencode: availability.opencodeZen,
    "zai-coding-plan": availability.zai,
    "kimi-for-coding": availability.kimiForCoding,
    "opencode-go": availability.opencodeGo,
    "minimax-cn-coding-plan": availability.minimaxCnCodingPlan,
    "minimax-coding-plan": availability.minimaxCodingPlan,
    vercel: availability.vercelAiGateway,
  }
  return mapping[provider] ?? false
}
