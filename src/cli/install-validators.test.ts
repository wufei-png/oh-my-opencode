import { describe, expect, test } from "bun:test"

import { validateNonTuiArgs } from "./install-validators"
import type { InstallArgs } from "./types"

function createArgs(overrides: Partial<InstallArgs> = {}): InstallArgs {
  return {
    tui: false,
    claude: "no",
    openai: "no",
    gemini: "no",
    copilot: "no",
    opencodeZen: "no",
    zaiCodingPlan: "no",
    kimiForCoding: "no",
    opencodeGo: "no",
    minimaxCnCodingPlan: "no",
    minimaxCodingPlan: "no",
    minimaxModelVariant: "standard",
    skipAuth: false,
    ...overrides,
  }
}

describe("validateNonTuiArgs", () => {
  test("rejects invalid --opencode-go values", () => {
    // #given
    const args = createArgs({ opencodeGo: "maybe" as InstallArgs["opencodeGo"] })

    // #when
    const result = validateNonTuiArgs(args)

    // #then
    expect(result.valid).toBe(false)
    expect(result.errors).toContain("Invalid --opencode-go value: maybe (expected: no, yes)")
  })

  test("rejects invalid MiniMax Coding Plan variant values", () => {
    // #given
    const args = createArgs({ minimaxModelVariant: "turbo" as InstallArgs["minimaxModelVariant"] })

    // #when
    const result = validateNonTuiArgs(args)

    // #then
    expect(result.valid).toBe(false)
    expect(result.errors).toContain("Invalid --minimax-model-variant value: turbo (expected: standard, highspeed)")
  })
})
