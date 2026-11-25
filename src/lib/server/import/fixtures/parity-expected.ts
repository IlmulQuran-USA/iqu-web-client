/*
 * What the LIVE plugin answered for fixtures/parity.csv (synthetic names and
 * emails only): IQU_Billing_Import::check_file and, for each row without an
 * error, IQU_Billing_Add_Student::prepare — run read-only through Novamira on
 * 25 Nov 2026 (today = 2026-11-25 in Asia/Dhaka; plugin 3.7.20). Nothing was
 * saved: check_file writes nothing, prepare only reads (the duplicate check).
 * `row` lists the plugin's registration columns (admin_note, user_agent and
 * the timestamps left out).
 */

export type PluginRow = Record<string, string | number>;
export type Expected = {
  line: number;
  level: "ok" | "warning" | "error";
  errors: string[];
  warnings: string[];
  gross: number;
  net: number;
  courseMissing: boolean;
  in: { first_name: string; email: string; whatsapp: string; course: string; days: number; use_agreed: boolean; agreed_fee: number; zakat: boolean };
  row?: PluginRow;
};

const base = { form_type: "free", status: "enrolled", created_via: "import", existing_student: 1, special_discount: 0 };

export const TODAY = "2026-11-25";
export const PLUGIN_NOW = new Date(1795617238 * 1000);

export const EXPECTED: Expected[] = [
  {
    line: 2, level: "ok", errors: [], warnings: [], gross: 64, net: 64, courseMissing: false,
    in: { first_name: "Testa", email: "zq1@example.com", whatsapp: "+1 214 555 0101", course: "qaidah", days: 4, use_agreed: false, agreed_fee: 0, zakat: false },
    row: { ...base, first_name: "Testa", last_name: "Zqone", email: "zq1@example.com", whatsapp: "+1 214 555 0101", guardian_name: "Guard Zqone", guardian_whatsapp: "+1 214 555 0101", days_per_week: "4", referral: "friend_family", course_type: "qaidah", per_class_rate: 4, calculated_amount: 64, discount_amount: 0, payment_amount: 64, zakat_declaration: 0, flexible_fee_note: "", date_of_birth: "2016-03-04", age: 10, country_origin: "Bangladesh", country_res: "United States", quran_level: "beginner", memorized: "Juz Amma", languages: "english, bengali", preferred_days: "monday, tuesday, thursday, friday", time_slot: "05:00 PM – 06:00 PM (CST)", session_dur: "30", teacher_pref: "female" },
  },
  {
    line: 3, level: "error", gross: 0, net: 0, courseMissing: false, warnings: [],
    errors: ["Enter the student's first and last name.", "Enter a valid email address. Payment links and receipts go here.", "Enter a WhatsApp number with country code.", "Choose classes per week (1–7)."],
    in: { first_name: "Testb", email: "", whatsapp: "123", course: "qaidah", days: 9, use_agreed: false, agreed_fee: 0, zakat: false },
  },
  {
    line: 4, level: "error", gross: 0, net: 0, courseMissing: false, warnings: [], errors: ["The agreed fee must be one amount, for example 30 or 30.50."],
    in: { first_name: "Testc", email: "zq3@example.com", whatsapp: "+1 214 555 0103", course: "qaidah", days: 3, use_agreed: true, agreed_fee: 0, zakat: false },
  },
  {
    line: 5, level: "error", gross: 0, net: 0, courseMissing: false, warnings: [], errors: ["The agreed fee must be at most $5,000.00 a month — check the amount."],
    in: { first_name: "Testd", email: "zq4@example.com", whatsapp: "+1 214 555 0104", course: "qaidah", days: 3, use_agreed: true, agreed_fee: 9000, zakat: false },
  },
  {
    line: 6, level: "error", gross: 0, net: 0, courseMissing: false, warnings: [], errors: ["Quran Hifz requires a minimum of 3 classes per week."],
    in: { first_name: "Teste", email: "zq5@example.com", whatsapp: "+1 214 555 0105", course: "hifz", days: 2, use_agreed: false, agreed_fee: 0, zakat: false },
  },
  {
    line: 7, level: "error", gross: 48, net: 0, courseMissing: false, warnings: [], errors: ["The agreed fee cannot be negative."],
    in: { first_name: "Testf", email: "zq6@example.com", whatsapp: "+1 214 555 0106", course: "qaidah", days: 3, use_agreed: true, agreed_fee: -5, zakat: false },
  },
  {
    line: 8, level: "warning", errors: [], gross: 0, net: 0, courseMissing: true,
    warnings: ["Course empty — left blank. Set it before billing starts.", "Agreed fee $20.00 saved — check against the standard price once the course is set."],
    in: { first_name: "Testg", email: "zq7@example.com", whatsapp: "+1 214 555 0107", course: "", days: 3, use_agreed: true, agreed_fee: 20, zakat: true },
    row: { ...base, first_name: "Testg", last_name: "Zqseven", email: "zq7@example.com", whatsapp: "+1 214 555 0107", guardian_name: "", guardian_whatsapp: "", days_per_week: "3", referral: "", course_type: "", per_class_rate: 0, calculated_amount: 0, discount_amount: 0, payment_amount: 0, zakat_declaration: 1, flexible_fee_note: "Agreed monthly fee $20.00", agreed_fee: 20, agreed_fee_fund: "zakat" },
  },
  {
    line: 9, level: "warning", errors: [], gross: 0, net: 0, courseMissing: true,
    warnings: ["Course 'xyz course' not found — left blank. Allowed: Qa'idah / Nazirah (qaidah), Quran Hifz (hifz), Arabic Language (arabic), Tarjumatul Quran (tarjumatul_quran), Islamic Studies (islamic_studies)."],
    in: { first_name: "Testh", email: "zq8@example.com", whatsapp: "+1 214 555 0108", course: "xyzcourse", days: 3, use_agreed: false, agreed_fee: 0, zakat: false },
    row: { ...base, first_name: "Testh", last_name: "Zqeight", email: "zq8@example.com", whatsapp: "+1 214 555 0108", guardian_name: "", guardian_whatsapp: "", days_per_week: "3", referral: "", course_type: "", per_class_rate: 0, calculated_amount: 0, discount_amount: 0, payment_amount: 0, zakat_declaration: 0, flexible_fee_note: "" },
  },
  {
    line: 10, level: "warning", errors: [], gross: 64, net: 100, courseMissing: false, warnings: ["Agreed fee $100.00 is higher than the standard fee $64.00 — check the amount."],
    in: { first_name: "Testi", email: "zq9@example.com", whatsapp: "+1 214 555 0109", course: "qaidah", days: 4, use_agreed: true, agreed_fee: 100, zakat: false },
    row: { ...base, first_name: "Testi", last_name: "Zqnine", email: "zq9@example.com", whatsapp: "+1 214 555 0109", guardian_name: "", guardian_whatsapp: "", days_per_week: "4", referral: "", course_type: "qaidah", per_class_rate: 4, calculated_amount: 64, discount_amount: 0, payment_amount: 100, zakat_declaration: 0, flexible_fee_note: "Agreed monthly fee $100.00", agreed_fee: 100 },
  },
  {
    line: 11, level: "error", gross: 0, net: 0, courseMissing: false, warnings: [],
    errors: ["Date of Birth must be a real date in the past, for example 2016-03-04 or 3/4/2016 (month first).", "Qur'an level must be Beginner, Intermediate or Advanced."],
    in: { first_name: "Testj", email: "zq10@example.com", whatsapp: "+1 214 555 0110", course: "qaidah", days: 3, use_agreed: false, agreed_fee: 0, zakat: false },
  },
  {
    line: 12, level: "error", gross: 0, net: 0, courseMissing: false, warnings: [], errors: ["Age must be between 4 and 100.", "Languages must be English, Arabic, Urdu or Bengali."],
    in: { first_name: "Testk", email: "zq11@example.com", whatsapp: "+1 214 555 0111", course: "qaidah", days: 3, use_agreed: false, agreed_fee: 0, zakat: false },
  },
  {
    line: 13, level: "error", gross: 0, net: 0, courseMissing: false, warnings: [], errors: ["Age must be a number from 1 to 100.", "Preferred days must be days of the week (for example Mon, Wed)."],
    in: { first_name: "Testl", email: "zq12@example.com", whatsapp: "+1 214 555 0112", course: "qaidah", days: 3, use_agreed: false, agreed_fee: 0, zakat: false },
  },
  {
    line: 14, level: "error", gross: 0, net: 0, courseMissing: false, warnings: [], errors: ["Choose no more preferred days than classes a week."],
    in: { first_name: "Testm", email: "zq13@example.com", whatsapp: "+1 214 555 0113", course: "qaidah", days: 2, use_agreed: false, agreed_fee: 0, zakat: false },
  },
  {
    line: 15, level: "error", gross: 0, net: 0, courseMissing: false, warnings: [], errors: ["Session duration must be 30, 40, 50 or 60 minutes.", "Teacher preference must be Male, Female or No preference."],
    in: { first_name: "Testn", email: "zq14@example.com", whatsapp: "+1 214 555 0114", course: "qaidah", days: 3, use_agreed: false, agreed_fee: 0, zakat: false },
  },
  {
    line: 16, level: "warning", errors: [], gross: 48, net: 48, courseMissing: false, warnings: ["'Other' answer — check and update manually."],
    in: { first_name: "Testo", email: "zq15@example.com", whatsapp: "+1 214 555 0115", course: "qaidah", days: 3, use_agreed: false, agreed_fee: 0, zakat: false },
    row: { ...base, first_name: "Testo", last_name: "Zqfifteen", email: "zq15@example.com", whatsapp: "+1 214 555 0115", guardian_name: "", guardian_whatsapp: "", days_per_week: "3", referral: "other", course_type: "qaidah", per_class_rate: 4, calculated_amount: 48, discount_amount: 0, payment_amount: 48, zakat_declaration: 0, flexible_fee_note: "", referral_other: "a cousin" },
  },
  {
    line: 17, level: "error", gross: 0, net: 0, courseMissing: false, warnings: [],
    errors: ["How they heard about us must be one of: Facebook, WhatsApp, LinkedIn, YouTube, Website, Friend/Family, Email or Other."],
    in: { first_name: "Testp", email: "zq16@example.com", whatsapp: "+1 214 555 0116", course: "qaidah", days: 3, use_agreed: false, agreed_fee: 0, zakat: false },
  },
  {
    line: 18, level: "error", gross: 64, net: 64, courseMissing: false, warnings: [], errors: ["Same student appears twice in this file (row 2)."],
    in: { first_name: "Testa", email: "ZQ1@example.com", whatsapp: "+1 214 555 0101", course: "qaidah", days: 4, use_agreed: false, agreed_fee: 0, zakat: false },
  },
  {
    line: 19, level: "ok", errors: [], warnings: [], gross: 40, net: 30, courseMissing: false,
    in: { first_name: "Testq", email: "zq17@example.com", whatsapp: "+1 214 555 0117", course: "arabic", days: 2, use_agreed: true, agreed_fee: 30, zakat: true },
    row: { ...base, first_name: "Testq", last_name: "Zqseventeen", email: "zq17@example.com", whatsapp: "+1 214 555 0117", guardian_name: "", guardian_whatsapp: "", days_per_week: "2", referral: "", course_type: "arabic", per_class_rate: 5, calculated_amount: 40, discount_amount: 10, payment_amount: 30, zakat_declaration: 1, flexible_fee_note: "Agreed monthly fee $30.00", agreed_fee: 30, agreed_fee_fund: "zakat", date_of_birth: "2002-04-12", age: 24, country_res: "United States", languages: "english, arabic", preferred_days: "saturday, sunday", time_slot: "10:00 AM – 11:00 AM (CST)", session_dur: "40", teacher_pref: "no_preference" },
  },
  {
    line: 20, level: "ok", errors: [], warnings: [], gross: 20, net: 20, courseMissing: false,
    in: { first_name: "Testr", email: "zq18@example.com", whatsapp: "+1 214 555 0118", course: "tarjumatul_quran", days: 1, use_agreed: false, agreed_fee: 0, zakat: false },
    row: { ...base, first_name: "Testr", last_name: "Zqeighteen", email: "zq18@example.com", whatsapp: "+1 214 555 0118", guardian_name: "", guardian_whatsapp: "", days_per_week: "1", referral: "", course_type: "tarjumatul_quran", per_class_rate: 5, calculated_amount: 20, discount_amount: 0, payment_amount: 20, zakat_declaration: 0, flexible_fee_note: "" },
  },
  {
    line: 21, level: "ok", errors: [], warnings: [], gross: 100, net: 100, courseMissing: false,
    in: { first_name: "Tests", email: "zq19@example.com", whatsapp: "+1 214 555 0119", course: "hifz", days: 5, use_agreed: false, agreed_fee: 0, zakat: false },
    row: { ...base, first_name: "Tests", last_name: "Zqnineteen", email: "zq19@example.com", whatsapp: "+1 214 555 0119", guardian_name: "", guardian_whatsapp: "", days_per_week: "5", referral: "", course_type: "hifz", per_class_rate: 5, calculated_amount: 100, discount_amount: 0, payment_amount: 100, zakat_declaration: 0, flexible_fee_note: "" },
  },
  {
    line: 23, level: "ok", errors: [], warnings: [], gross: 48, net: 0, courseMissing: false,
    in: { first_name: "Testt", email: "zq20@example.com", whatsapp: "+44 20 7946 0958", course: "islamic_studies", days: 3, use_agreed: true, agreed_fee: 0, zakat: true },
    row: { ...base, first_name: "Testt", last_name: "Zqtwenty", email: "zq20@example.com", whatsapp: "+44 20 7946 0958", guardian_name: "Guard Zqt", guardian_whatsapp: "+44 20 7946 0958", days_per_week: "3", referral: "", course_type: "islamic_studies", per_class_rate: 4, calculated_amount: 48, discount_amount: 48, payment_amount: 0, zakat_declaration: 1, flexible_fee_note: "Agreed monthly fee $0.00", agreed_fee: 0, agreed_fee_fund: "zakat", teacher_pref: "no_preference" },
  },
  {
    line: 24, level: "ok", errors: [], warnings: [], gross: 48, net: 48, courseMissing: false,
    in: { first_name: "Testu", email: "zq21@example.com", whatsapp: "+1 214 555 0121", course: "qaidah", days: 3, use_agreed: false, agreed_fee: 0, zakat: false },
    row: { ...base, first_name: "Testu", last_name: "Zqtwentyone", email: "zq21@example.com", whatsapp: "+1 214 555 0121", guardian_name: "", guardian_whatsapp: "", days_per_week: "3", referral: "whatsapp", course_type: "qaidah", per_class_rate: 4, calculated_amount: 48, discount_amount: 0, payment_amount: 48, zakat_declaration: 0, flexible_fee_note: "", date_of_birth: "2016-03-04", age: 10, languages: "bengali", teacher_pref: "no_preference" },
  },
  {
    line: 25, level: "error", gross: 0, net: 0, courseMissing: false, warnings: [], errors: ["Date of Birth must be a real date in the past, for example 2016-03-04 or 3/4/2016 (month first)."],
    in: { first_name: "Testv", email: "zq22@example.com", whatsapp: "+1 214 555 0122", course: "qaidah", days: 4, use_agreed: true, agreed_fee: 1250, zakat: false },
  },
  {
    line: 26, level: "ok", errors: [], warnings: [], gross: 60, net: 30, courseMissing: false,
    in: { first_name: "Testw", email: "zq23@example.com", whatsapp: "+1 214 555 0123", course: "tarjumatul_quran", days: 3, use_agreed: true, agreed_fee: 30, zakat: false },
    row: { ...base, first_name: "Testw", last_name: "Zqtwentythree", email: "zq23@example.com", whatsapp: "+1 214 555 0123", guardian_name: "", guardian_whatsapp: "", days_per_week: "3", referral: "facebook", course_type: "tarjumatul_quran", per_class_rate: 5, calculated_amount: 60, discount_amount: 30, payment_amount: 30, zakat_declaration: 0, flexible_fee_note: "Agreed monthly fee $30.00", agreed_fee: 30, quran_level: "intermediate" },
  },
  {
    line: 27, level: "error", gross: 0, net: 0, courseMissing: false, warnings: [], errors: ["Enter a valid email address. Payment links and receipts go here."],
    in: { first_name: "Testx", email: "", whatsapp: "+1 214 555 0124", course: "qaidah", days: 3, use_agreed: false, agreed_fee: 0, zakat: false },
  },
];
