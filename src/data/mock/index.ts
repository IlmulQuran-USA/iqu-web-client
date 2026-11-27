import type { DataSource } from "../contracts/index.ts";
import { buildDataset, type Dataset } from "./build.ts";
import { mockEnrollment } from "./enrollment.ts";

/*
 * The mock adapter (SERVER ONLY): the DataSource over the invented data set.
 * The data set is rebuilt once a minute at most (session states follow the
 * clock); everything else is the same all day.
 */

export function createMockSource(clock: () => Date = () => new Date()): DataSource {
  let cache: { minute: number; data: Dataset } | null = null;
  const data = () => {
    const now = clock();
    const minute = Math.floor(now.getTime() / 60_000);
    if (!cache || cache.minute !== minute) cache = { minute, data: buildDataset(now) };
    return cache.data;
  };
  const byStart = (from: Date, to: Date) => (s: { startsAt: string }) => s.startsAt >= from.toISOString() && s.startsAt < to.toISOString();

  return {
    mode: "mock",
    people: {
      account: async (id) => data().accounts.find((a) => a.id === id) ?? null,
      accountByEmail: async (email) => data().accounts.find((a) => a.email === email.trim().toLowerCase()) ?? null,
      family: async (id) => data().families.find((f) => f.id === id) ?? null,
      families: async () => data().families,
      student: async (id) => data().students.find((s) => s.id === id) ?? null,
      students: async () => data().students,
      studentsOfFamily: async (familyId) => data().students.filter((s) => s.familyId === familyId),
      studentsOfTeacher: async (teacherId) => data().students.filter((s) => s.teacherId === teacherId && s.status !== "archived"),
      teacher: async (id) => data().teachers.find((t) => t.id === id) ?? null,
      teachers: async () => data().teachers,
    },
    schedule: {
      thresholds: async () => data().thresholds,
      forStudent: async (studentId, from, to) => data().sessions.filter((s) => s.studentId === studentId).filter(byStart(from, to)),
      forTeacher: async (teacherId, from, to) => data().sessions.filter((s) => s.teacherId === teacherId).filter(byStart(from, to)),
      between: async (from, to) => data().sessions.filter(byStart(from, to)),
    },
    billing: {
      forFamily: async (familyId) => data().billing.find((b) => b.familyId === familyId) ?? null,
      all: async () => data().billing,
    },
    registrations: {
      list: async () => data().registrations,
    },
    enrollment: mockEnrollment,
  };
}
