import type { Account, Teacher } from "../contracts/people.ts";

/*
 * The invented people of the mock data set (owner, 27 Nov 2026: realistic,
 * but no real person and no real number from the live site). None of these
 * names belongs to a real IQU teacher, family or donor; a unit test checks
 * the teachers against src/content/instructors.ts. Family emails use
 * example.com, which can never receive mail. The four accounts use the
 * owner's preview addresses; their password is read only from
 * PREVIEW_DEFAULT_PASSWORD and is never stored here.
 */

export const ACCOUNTS: Account[] = [
  {
    id: "acc-admin",
    email: "admin@ilmulquranus.org",
    name: "Preview Admin",
    roles: ["admin", "billing_admin"],
    familyId: null,
    studentId: null,
    teacherId: null,
  },
  {
    id: "acc-teacher",
    email: "teacher@ilmulquranus.org",
    name: "Hafez Imran Chowdhury",
    roles: ["teacher"],
    familyId: null,
    studentId: null,
    teacherId: "t-imran",
  },
  {
    id: "acc-parent",
    email: "parent@ilmulquranus.org",
    name: "Amina Siddiqui",
    roles: ["parent"],
    familyId: "f-siddiqui",
    studentId: null,
    teacherId: null,
  },
  {
    id: "acc-student",
    email: "student@ilmulquranus.org",
    name: "Farhana Karim",
    roles: ["student"],
    familyId: "f-karim",
    studentId: "s-farhana",
    teacherId: null,
  },
];

const dhaka = "Asia/Dhaka" as const;

/** Ten invented teachers in Dhaka; the last is newly added (no Zoom account, no students). */
export const TEACHERS: Teacher[] = [
  { id: "t-imran", name: "Hafez Imran Chowdhury", gender: "male", zone: dhaka, courses: ["quran-hifz", "quran-nazirah"], status: "active", zoomLinked: true },
  { id: "t-rumana", name: "Hafezah Rumana Akter", gender: "female", zone: dhaka, courses: ["noorani-qaidah", "quran-nazirah"], status: "active", zoomLinked: true },
  { id: "t-sumaiya", name: "Hafezah Sumaiya Rahman", gender: "female", zone: dhaka, courses: ["tarjumatul-quran", "islamic-studies", "quran-nazirah"], status: "active", zoomLinked: true },
  { id: "t-nadia", name: "Hafezah Nadia Sultana", gender: "female", zone: dhaka, courses: ["noorani-qaidah", "islamic-studies"], status: "active", zoomLinked: true },
  { id: "t-tariq", name: "Mufti Tariq Hasan", gender: "male", zone: dhaka, courses: ["quran-hifz", "tarjumatul-quran"], status: "active", zoomLinked: true },
  { id: "t-kamal", name: "Mawlana Kamal Uddin", gender: "male", zone: dhaka, courses: ["islamic-studies", "quranic-arabic-level-1"], status: "active", zoomLinked: true },
  { id: "t-saiful", name: "Hafez Saiful Alam", gender: "male", zone: dhaka, courses: ["noorani-qaidah", "quran-nazirah"], status: "active", zoomLinked: true },
  { id: "t-anwar", name: "Mawlana Anwar Hossain", gender: "male", zone: dhaka, courses: ["quranic-arabic-level-1", "islamic-studies"], status: "active", zoomLinked: true },
  { id: "t-rafiq", name: "Mufti Rafiqul Bari", gender: "male", zone: dhaka, courses: ["tarjumatul-quran", "quran-hifz"], status: "active", zoomLinked: true },
  { id: "t-zahid", name: "Hafez Zahidul Haque", gender: "male", zone: dhaka, courses: ["noorani-qaidah"], status: "setup", zoomLinked: false },
];

/** Where families live: city, region, country and IANA zone (all five North American zones, plus Alaska and Regina). */
export const PLACES = [
  { city: "Houston", region: "TX", country: "US", zone: "America/Chicago" },
  { city: "Dallas", region: "TX", country: "US", zone: "America/Chicago" },
  { city: "Chicago", region: "IL", country: "US", zone: "America/Chicago" },
  { city: "Minneapolis", region: "MN", country: "US", zone: "America/Chicago" },
  { city: "Atlanta", region: "GA", country: "US", zone: "America/New_York" },
  { city: "Jersey City", region: "NJ", country: "US", zone: "America/New_York" },
  { city: "Dearborn", region: "MI", country: "US", zone: "America/Detroit" },
  { city: "Philadelphia", region: "PA", country: "US", zone: "America/New_York" },
  { city: "Denver", region: "CO", country: "US", zone: "America/Denver" },
  { city: "Phoenix", region: "AZ", country: "US", zone: "America/Phoenix" },
  { city: "Los Angeles", region: "CA", country: "US", zone: "America/Los_Angeles" },
  { city: "Seattle", region: "WA", country: "US", zone: "America/Los_Angeles" },
  { city: "Toronto", region: "ON", country: "CA", zone: "America/Toronto" },
  { city: "Mississauga", region: "ON", country: "CA", zone: "America/Toronto" },
  { city: "Calgary", region: "AB", country: "CA", zone: "America/Edmonton" },
  { city: "Halifax", region: "NS", country: "CA", zone: "America/Halifax" },
  { city: "Anchorage", region: "AK", country: "US", zone: "America/Anchorage" },
  { city: "Regina", region: "SK", country: "CA", zone: "America/Regina" },
] as const;

export const BOYS = ["Ibrahim", "Zayd", "Hamza", "Ayaan", "Idris", "Musa", "Rayyan", "Adam", "Zakariya", "Sami", "Ilyas", "Harun", "Talha", "Usman", "Nuh"] as const;
export const GIRLS = ["Aisha", "Hafsa", "Zainab", "Safiya", "Noor", "Layla", "Huda", "Amira", "Sumayyah", "Ruqayyah", "Inaya", "Hana", "Asiya", "Mariam", "Yasmin"] as const;
export const ADULT_WOMEN = ["Sadia", "Rabia", "Samira", "Rehana", "Saba", "Hina", "Noreen", "Shabnam", "Tasnim", "Lubna"] as const;
export const ADULT_MEN = ["Tariq", "Kamran", "Asif", "Faisal", "Javed", "Adnan", "Nabil", "Arif", "Shahid", "Rashid"] as const;
export const SURNAMES = [
  "Ahmed", "Hossain", "Ali", "Khan", "Mirza", "Qureshi", "Malik", "Sheikh", "Haque", "Farooqui", "Hashmi", "Rizvi",
  "Baig", "Ansari", "Nasser", "Haddad", "Abdi", "Warsame", "Osman", "Chaudhry", "Begum", "Mansoor", "Saleem", "Latif",
] as const;
