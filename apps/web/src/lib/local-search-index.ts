import { CourseDefinition, fullWidthToHalfWidth } from "@courseweb/shared";

export type LocalCourse = Pick<
  CourseDefinition,
  | "raw_id"
  | "name_zh"
  | "name_en"
  | "semester"
  | "department"
  | "course"
  | "class"
  | "credits"
  | "venues"
  | "times"
  | "teacher_zh"
  | "teacher_en"
  | "note"
  | "prerequisites"
  | "restrictions"
>;
export type LocalHit = {
  course: LocalCourse;
  score: number;
};

export const FIELD_WEIGHTS = {
  code: 100,
  name: 10,
  teacher: 1,
} as const;

export type SearchableCourse = {
  course: LocalCourse;
  code: string;
  name: string;
  teacher: string;
  nameTerm: string[];
  teacherTerm: string[];
};

export const toSearchable = (course: LocalCourse): SearchableCourse => {
  const name = [course.name_zh, course.name_en].join(" ").trim().toLowerCase();
  const teacher = [...course.teacher_zh, ...(course.teacher_en ?? [])]
    .join(" ")
    .toLowerCase();
  return {
    course,
    code: `${course.department}${course.course}`.toLowerCase(),
    name: name,
    teacher: teacher,
    nameTerm: terms(name),
    teacherTerm: terms(teacher),
  };
};

export const terms = (text: string): string[] =>
  fullWidthToHalfWidth(text)
    .toLowerCase()
    .match(/\p{Script=Han}+|[a-z0-9]+/gu) ?? [];

const prefixMatch = (t: string, needle: string) => {
  return (t: string) => t.startsWith(needle);
};

export const score = (entry: SearchableCourse, query: string): number => {
  const n = fullWidthToHalfWidth(query).trim().toLowerCase();
  if (!n) return 0;
  let total = 0;
  if (entry.code.startsWith(n)) total += FIELD_WEIGHTS.code;
  if (entry.nameTerm.some((t) => t.startsWith(n))) total += FIELD_WEIGHTS.name;
  if (entry.teacherTerm.some((t) => t.startsWith(n)))
    total += FIELD_WEIGHTS.teacher;
  return total;
};

export const search = (
  corpus: SearchableCourse[],
  query: string,
): LocalHit[] => {
  const hits: LocalHit[] = [];
  for (const entry of corpus) {
    const value = score(entry, query);
    if (value > 0) hits.push({ course: entry.course, score: value });
  }
  return hits.sort();
};
