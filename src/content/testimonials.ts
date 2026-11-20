import { z } from "zod";
import { programs, type ProgramId } from "./pricing";

/*
 * Family testimonials (Home §7 "What families say").
 *
 * Source: the Reviews tab of the live program posts, read-only, 20 Nov 2026:
 *   - Summer Islamic Education Program, post 312,
 *     https://ilmulquranus.org/course/summer-islamic-education-program/
 *   - Weekend Ilm Program, post 295,
 *     https://ilmulquranus.org/course/weekend-ilm-program/
 * Each quote is the family's exact words; only the name and the place are
 * kept. The live star ratings and review titles are never carried over
 * (COURSE-CONTENT.md §11), nor the Noorani Qaidah reviews (lorem ipsum).
 *
 * Status (owner, 21 Nov 2026): every one is "sample". Testimonials and
 * sample content are shown for admin review; replace or confirm them before
 * the public launch (PRODUCT.md "Brand Commitments"). `npm run content:check`
 * lists them under "Sample content to replace". Set a testimonial to "live"
 * once the family confirms it is their own words, given with consent (US FTC
 * rule on fake reviews and testimonials, 16 CFR Part 465).
 */

export const TESTIMONIAL_STATUSES = ["live", "sample"] as const;

const testimonialSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  status: z.enum(TESTIMONIAL_STATUSES),
  /** As written on the live site. */
  name: z.string().min(1),
  /** City or state, as written on the live site. */
  place: z.string().min(1),
  program: z.enum(["weekend-ilm-program", "summer-ilm-camp"] satisfies ProgramId[]),
  /** The family's exact words. */
  quote: z.string().min(1),
  source: z.object({ postId: z.number().int(), url: z.url(), read: z.string() }),
});
export type Testimonial = z.infer<typeof testimonialSchema>;

const SUMMER = { postId: 312, url: "https://ilmulquranus.org/course/summer-islamic-education-program/", read: "20 Nov 2026" };
const WEEKEND = { postId: 295, url: "https://ilmulquranus.org/course/weekend-ilm-program/", read: "20 Nov 2026" };

export const testimonials: Testimonial[] = testimonialSchema.array().parse([
  {
    id: "summer-sarah-h",
    status: "sample",
    name: "Sarah H.",
    place: "Texas, USA",
    program: "summer-ilm-camp",
    quote:
      "It was the summer of 2024. My son loved every part of the Summer Islamic Education Program organized by Ilm-Ul-Quran USA. He not only improved his Quran recitation but also started practicing daily duas and sunnahs on his own. The teachers were engaging and kind — a truly rewarding experience!",
    source: SUMMER,
  },
  {
    id: "summer-mohammad-rafiq",
    status: "sample",
    name: "Mohammad Rafiq",
    place: "Chicago, USA",
    program: "summer-ilm-camp",
    quote:
      "This program beautifully balanced Islamic knowledge with practical learning. My daughter learned short surahs, etiquettes, and Islamic stories — all in just a few weeks. We are so grateful for this initiative!",
    source: SUMMER,
  },
  {
    id: "summer-fatima-khalid",
    status: "sample",
    name: "Fatima Khalid",
    place: "New Jersey, USA",
    program: "summer-ilm-camp",
    quote:
      "It’s amazing how much my kids have grown spiritually through this program. From understanding aqeedah to memorizing duas, every class was meaningful. The structured approach made it easy to follow, even with a busy summer schedule.",
    source: SUMMER,
  },
  {
    id: "weekend-fatima-a",
    status: "sample",
    name: "Fatima A.",
    place: "Chicago, IL",
    program: "weekend-ilm-program",
    quote:
      "Alhamdulillah, we are so happy with the Weekend Ilm Program! My son has learned his daily duas, improved his salah, and looks forward to every class. The teachers are kind and engaging — may Allah bless them!",
    source: WEEKEND,
  },
  {
    id: "weekend-mohammed-s",
    status: "sample",
    name: "Mohammed S.",
    place: "Dallas, TX",
    program: "weekend-ilm-program",
    quote:
      "This program has been a great addition to our weekends. My daughter loves the Quran recitation practice and stories of the Prophets. I appreciate the balance between Islamic learning and building good character.",
    source: WEEKEND,
  },
  {
    id: "weekend-sarah-k",
    status: "sample",
    name: "Sarah K.",
    place: "New Jersey",
    program: "weekend-ilm-program",
    quote:
      "I was searching for a reliable Islamic weekend program, and Ilm-Ul-Quran USA exceeded my expectations. The teachers are knowledgeable and supportive, and the curriculum is perfect for young kids growing up here. Highly recommended!",
    source: WEEKEND,
  },
]);

/** Home shows at most three, chosen for variety: both programs, three places, a son, a daughter and young children. */
export const homeTestimonialIds = ["summer-sarah-h", "summer-mohammad-rafiq", "weekend-sarah-k"] as const;
for (const id of homeTestimonialIds) {
  if (!testimonials.some((t) => t.id === id)) throw new Error(`Unknown testimonial ${id}`);
}

/** The testimonials for the given ids, in order. Live and sample both render (owner, 21 Nov 2026). */
export function testimonialsById(ids: readonly string[]): Testimonial[] {
  return ids.map((id) => testimonials.find((t) => t.id === id)).filter((t): t is Testimonial => t !== undefined);
}

/** The program a testimonial is about, for its label and link. */
export function programOf(t: Testimonial) {
  const program = Object.values(programs).find((p) => p.id === t.program);
  if (!program) throw new Error(`Unknown program ${t.program}`);
  return program;
}
