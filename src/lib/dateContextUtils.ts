import { DateContext } from '../types';

export function getSeason(month: number): string {
  // 0-indexed month: 0=Jan, 1=Feb, ...
  if (month >= 2 && month <= 4) return "Spring 🌸";
  if (month >= 5 && month <= 7) return "Summer ☀️";
  if (month >= 8 && month <= 10) return "Autumn 🍂";
  return "Winter ❄️";
}

export function getTimeOfDayLabel(hour: number): { label: string, emoji: string, greeting: string } {
  if (hour >= 5 && hour < 12) {
    return { label: "Morning", emoji: "🌅", greeting: "Good morning!" };
  } else if (hour >= 12 && hour < 17) {
    return { label: "Afternoon", emoji: "☀️", greeting: "Good afternoon!" };
  } else if (hour >= 17 && hour < 21) {
    return { label: "Evening", emoji: "🌇", greeting: "Good evening!" };
  } else {
    return { label: "Night", emoji: "🌙", greeting: "It's nighttime." };
  }
}

export function getFullDateContext(date: Date): DateContext {
  const hour = date.getHours();
  const timeInfo = getTimeOfDayLabel(hour);
  const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
  const dayNumber = date.getDate();
  const monthName = date.toLocaleDateString('en-US', { month: 'long' });
  const year = date.getFullYear();
  const season = getSeason(date.getMonth());
  const formattedTime = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  const contextSentence = `It's ${dayName} ${timeInfo.label} — a ${season.split(' ')[0]} day.`;

  return {
    greeting: timeInfo.greeting,
    timeOfDay: timeInfo.label,
    timeOfDayEmoji: timeInfo.emoji,
    dayName,
    dayNumber,
    monthName,
    year,
    season,
    formattedTime,
    contextSentence
  };
}
