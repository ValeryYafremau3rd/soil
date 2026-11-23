export const WEATHER_TYPES = ['rain', 'snow', 'fog', 'storm', 'wind', 'clear'] as const
export type Weather = typeof WEATHER_TYPES[number]

/**
 * Five equally likely effects (15% each), with the remaining 25% clear.
 * @param {() => number} random - Random-number source; injectable for deterministic results.
 * @returns {"rain" | "snow" | "fog" | "storm" | "wind" | "clear"} The result described by the TypeScript return signature.
 */
export function rollWeather(random: () => number = Math.random): Weather {
  const roll = random() * 100

  return WEATHER_TYPES[Math.min(5, Math.floor(roll / 15))]
}
