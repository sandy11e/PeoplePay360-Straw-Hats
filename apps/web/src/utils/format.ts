export function formatMoney(
  amount: string | number | null | undefined,
  currency = "USD",
): string {
  if (amount === null || amount === undefined || amount === "") {
    return "—"
  }

  const numericValue = typeof amount === "number" ? amount : parseFloat(amount)

  if (Number.isNaN(numericValue)) {
    return String(amount)
  }

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numericValue)
  } catch {
    return `${currency} ${numericValue.toFixed(2)}`
  }
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "—"

  try {
    const d = typeof date === "string" ? new Date(date) : date
    if (Number.isNaN(d.getTime())) return String(date)

    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(d)
  } catch {
    return String(date)
  }
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return "—"

  try {
    const d = typeof date === "string" ? new Date(date) : date
    if (Number.isNaN(d.getTime())) return String(date)

    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d)
  } catch {
    return String(date)
  }
}

export function formatMinutes(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || Number.isNaN(minutes)) {
    return "—"
  }

  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60

  if (hours === 0) {
    return `${remainingMinutes}m`
  }

  if (remainingMinutes === 0) {
    return `${hours}h`
  }

  return `${hours}h ${remainingMinutes}m`
}
