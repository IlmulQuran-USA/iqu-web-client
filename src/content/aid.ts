/* ── Fees and aid (shared by Home, course pages and /scholarship) ──
 * No imports, so node tests can load it (src/content/scholarship.test.ts).
 */

// PRODUCT.md "Positioning". Live data, 25 Nov 2026: 48 of 91 active monthly students get help with
// fees (10 pay $0); "Nearly half of our students study free." was corrected to this (owner, 26 Nov 2026).
const HELP_SHARE = "About half of our students receive help with fees.";
// Owner, 22 Nov 2026: listed prices are the full fees; a reduced fee or a full
// scholarship is something a family asks for, never a discount everyone gets.
// Replaces "The rest pay subsidized fees, with tuition reduced by 50%, 45% or 30%."
const ASK_FOR_HELP =
  "Listed prices are the full monthly fees. Families who need help can ask for a reduced fee (30%, 45% or 50% off) or a full scholarship.";

export const aid = {
  helpShare: HELP_SHARE,
  /** Course pages and the /courses fee note: the full wording (owner, 22 Nov 2026). */
  help: { status: "live", text: `${ASK_FOR_HELP} ${HELP_SHARE}` },
  /** Home giving band: without the last sentence, which the hero trust strip already says (owner, 23 and 24 Nov 2026). */
  askForHelp: { status: "live", text: ASK_FOR_HELP },
} as const;
