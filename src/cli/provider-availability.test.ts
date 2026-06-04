import { describe, expect, test } from "bun:test"

import {
  hasAnyAvailableProvider,
  isOpenAiOnlyAvailability,
  toProviderAvailability,
} from "./provider-availability"
import type { InstallConfig } from "./types"

function createConfig(overrides: Partial<InstallConfig> = {}): InstallConfig {
  return {
    hasClaude: false,
    isMax20: false,
    hasOpenAI: false,
    hasGemini: false,
    hasCopilot: false,
    hasOpencodeZen: false,
    hasZaiCodingPlan: false,
    hasKimiForCoding: false,
    hasOpencodeGo: false,
    hasMinimaxCnCodingPlan: false,
    hasMinimaxCodingPlan: false,
    minimaxModelVariant: "standard",
    hasVercelAiGateway: false,
    ...overrides,
  }
}

describe("provider availability predicates", () => {
  test("hasAnyAvailableProvider returns false when no providers are configured", () => {
    // #given
    const availability = toProviderAvailability(createConfig())

    // #when
    const result = hasAnyAvailableProvider(availability)

    // #then
    expect(result).toBe(false)
  })

  test("hasAnyAvailableProvider returns true when MiniMax is configured", () => {
    // #given
    const availability = toProviderAvailability(createConfig({ hasMinimaxCodingPlan: true }))

    // #when
    const result = hasAnyAvailableProvider(availability)

    // #then
    expect(result).toBe(true)
  })

  test("isOpenAiOnlyAvailability returns true when OpenAI is the only configured provider", () => {
    // #given
    const availability = toProviderAvailability(createConfig({ hasOpenAI: true }))

    // #when
    const result = isOpenAiOnlyAvailability(availability)

    // #then
    expect(result).toBe(true)
  })

  test("isOpenAiOnlyAvailability returns false when another provider is also configured", () => {
    // #given
    const availability = toProviderAvailability(createConfig({ hasOpenAI: true, hasMinimaxCodingPlan: true }))

    // #when
    const result = isOpenAiOnlyAvailability(availability)

    // #then
    expect(result).toBe(false)
  })
})
