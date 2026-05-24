import { describe, expect, test } from "bun:test"

import { generateModelConfig } from "./model-fallback"
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
    hasVercelAiGateway: false,
    ...overrides,
  }
}

describe("generateModelConfig OpenAI-only model catalog", () => {
  test("fills remaining OpenAI-only agent gaps with OpenAI models", () => {
    // #given
    const config = createConfig({ hasOpenAI: true })

    // #when
    const result = generateModelConfig(config)

    // #then
    expect(result.agents?.explore).toEqual({ model: "openai/gpt-5.4-mini-fast" })
    expect(result.agents?.librarian).toEqual({ model: "openai/gpt-5.4-mini-fast" })
  })

  test("fills remaining OpenAI-only category gaps with OpenAI models", () => {
    // #given
    const config = createConfig({ hasOpenAI: true })

    // #when
    const result = generateModelConfig(config)

    // #then
    expect(result.categories?.artistry).toEqual({ model: "openai/gpt-5.5", variant: "xhigh" })
    expect(result.categories?.quick).toEqual({ model: "openai/gpt-5.4-mini" })
    expect(result.categories?.["visual-engineering"]).toEqual({ model: "openai/gpt-5.5", variant: "high" })
    expect(result.categories?.writing).toEqual({ model: "openai/gpt-5.5", variant: "medium" })
  })

  test("does not apply OpenAI-only overrides when OpenCode Go is also available", () => {
    // #given
    const config = createConfig({ hasOpenAI: true, hasOpencodeGo: true })

    // #when
    const result = generateModelConfig(config)

    // #then
    expect(result.agents?.explore).toMatchObject({ model: "openai/gpt-5.4-mini-fast" })
    expect(result.agents?.librarian).toMatchObject({ model: "openai/gpt-5.4-mini-fast" })
    expect(result.agents?.explore).not.toMatchObject({ variant: "medium" })
    expect(result.agents?.librarian).not.toMatchObject({ variant: "medium" })
    expect(result.categories?.quick).toMatchObject({ model: "openai/gpt-5.4-mini" })
  })

  test("does not apply OpenAI-only overrides when MiniMax is also available", () => {
    // #given
    const config = createConfig({ hasOpenAI: true, hasMinimaxCodingPlan: true })

    // #when
    const result = generateModelConfig(config)

    // #then
    expect(result.agents?.explore).toEqual({
      model: "openai/gpt-5.4-mini-fast",
      fallback_models: [
        { model: "minimax-coding-plan/MiniMax-M2.7" },
        { model: "openai/gpt-5.4-nano" },
      ],
    })
    expect(result.categories?.writing).toEqual({ model: "minimax-coding-plan/MiniMax-M2.7" })
  })

  test("does not apply OpenAI-only overrides when Vercel AI Gateway is also available", () => {
    // #given
    const config = createConfig({ hasOpenAI: true, hasVercelAiGateway: true })

    // #when
    const result = generateModelConfig(config)

    // #then
    expect(result.agents?.explore).toEqual({
      model: "openai/gpt-5.4-mini-fast",
      fallback_models: [
        { model: "vercel/minimax/minimax-m2.7-highspeed" },
        { model: "vercel/minimax/minimax-m2.7" },
        { model: "vercel/anthropic/claude-haiku-4.5" },
        { model: "openai/gpt-5.4-nano" },
        { model: "vercel/openai/gpt-5.4-nano" },
      ],
    })
    expect(result.categories?.writing).toEqual({
      model: "vercel/google/gemini-3-flash",
      fallback_models: [
        { model: "vercel/moonshotai/kimi-k2.6" },
        { model: "vercel/anthropic/claude-sonnet-4.6" },
        { model: "vercel/minimax/minimax-m2.7" },
      ],
    })
  })
})
