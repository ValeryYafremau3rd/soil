export const WEATHER_TYPES = ['rain', 'snow', 'fog', 'storm', 'wind', 'clear'] as const
export type Weather = typeof WEATHER_TYPES[number]

/** Five equally likely effects (15% each), with the remaining 25% clear. */
export function rollWeather(random: () => number = Math.random): Weather {
  const roll = random() * 100
  return WEATHER_TYPES[Math.min(5, Math.floor(roll / 15))]
}
