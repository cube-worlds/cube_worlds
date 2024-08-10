import { ReactionTypeEmoji } from "@grammyjs/types"

export function toEmoji(number: number): string {
  if (number === 10) {
    return "🔟"
  }
  return number
    .toString()
    .replaceAll("0", "0️⃣")
    .replaceAll("1", "1️⃣")
    .replaceAll("2", "2️⃣")
    .replaceAll("3", "3️⃣")
    .replaceAll("4", "4️⃣")
    .replaceAll("5", "5️⃣")
    .replaceAll("6", "6️⃣")
    .replaceAll("7", "7️⃣")
    .replaceAll("8", "8️⃣")
    .replaceAll("9", "9️⃣")
}

const coolEmojis: ReactionTypeEmoji["emoji"][] = [
  "👍",
  "❤",
  "🔥",
  "👏",
  "😎",
  "🎉",
  "🤩",
  "🦄",
  "😍",
  "🐳",
  "❤‍🔥",
  "⚡",
  "🏆",
  "😎",
  "🤗",
]

export function getRandomCoolEmoji(): ReactionTypeEmoji {
  const randomIndex: number = Math.floor(Math.random() * coolEmojis.length)
  return { type: "emoji", emoji: coolEmojis[randomIndex] }
}
