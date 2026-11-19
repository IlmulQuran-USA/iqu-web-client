/**
 * Index of the first occurrence of `phrase` in `text` that starts and ends
 * on word boundaries, or -1. "Mufti" is not found in "Muftis". Unicode
 * letters, digits and apostrophes (’ ') count as word characters.
 */
export function wholePhraseIndex(text: string, phrase: string): number {
  const isWordChar = (ch: string | undefined) => ch !== undefined && /[\p{L}\p{N}’']/u.test(ch);
  for (let at = text.indexOf(phrase); at !== -1; at = text.indexOf(phrase, at + 1)) {
    if (!isWordChar(text[at - 1]) && !isWordChar(text[at + phrase.length])) return at;
  }
  return -1;
}
