// Generates a strong password that satisfies the app's password policy
// (10+ chars with uppercase, lowercase, a number and a symbol).
// Usage: npm run gen:password
import { randomInt } from "node:crypto";

const sets = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnopqrstuvwxyz", "23456789", "!@#%^*-_=+"];
const all = sets.join("");
const chars = sets.map((set) => set[randomInt(set.length)]);
while (chars.length < 20) chars.push(all[randomInt(all.length)]);
for (let i = chars.length - 1; i > 0; i--) {
  const j = randomInt(i + 1);
  [chars[i], chars[j]] = [chars[j], chars[i]];
}
console.log(chars.join(""));
