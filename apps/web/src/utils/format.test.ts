import { describe, expect, it } from "vitest"
import { formatDate, formatDateTime, formatMinutes, formatMoney } from "./format"

describe("Format Utilities", () => {
  describe("formatMoney", () => {
    it("should format string money amounts safely with currency symbol", () => {
      const formatted = formatMoney("125000.50", "INR")
      // Check currency symbol and grouping
      expect(formatted).toContain("125,000.50")
    })

    it("should handle zero amount correctly", () => {
      const formatted = formatMoney("0", "USD")
      expect(formatted).toContain("0.00")
    })

    it("should handle null and undefined safely without throwing", () => {
      expect(formatMoney(null)).toBe("—")
      expect(formatMoney(undefined)).toBe("—")
      expect(formatMoney("")).toBe("—")
    })

    it("should format large monetary amounts without precision loss", () => {
      const formatted = formatMoney("9876543210.99", "USD")
      expect(formatted).toContain("9,876,543,210.99")
    })
  })

  describe("formatDate", () => {
    it("should format ISO dates into readable user strings", () => {
      const formatted = formatDate("2026-05-15")
      expect(formatted).toContain("2026")
      expect(formatted).toContain("May")
    })

    it("should handle null or invalid date safely", () => {
      expect(formatDate(null)).toBe("—")
      expect(formatDate(undefined)).toBe("—")
    })
  })

  describe("formatDateTime", () => {
    it("should format timestamp with time", () => {
      const formatted = formatDateTime("2026-05-15T14:30:00.000Z")
      expect(formatted).toContain("2026")
      expect(formatted).toContain("May")
    })

    it("should handle null safely", () => {
      expect(formatDateTime(null)).toBe("—")
    })
  })

  describe("formatMinutes", () => {
    it("should format minutes into hours and minutes", () => {
      expect(formatMinutes(125)).toBe("2h 5m")
      expect(formatMinutes(60)).toBe("1h")
      expect(formatMinutes(45)).toBe("45m")
    })

    it("should handle null or zero safely", () => {
      expect(formatMinutes(null)).toBe("—")
      expect(formatMinutes(undefined)).toBe("—")
      expect(formatMinutes(0)).toBe("0m")
    })
  })
})
