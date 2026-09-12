import { describe, expect, it } from "bun:test";
import {
  search,
  score,
  terms,
  toSearchable,
  type LocalCourse,
} from "./local-search-index";

/**
 * Nullability follows the generated schema: name_zh, name_en, teacher_zh,
 * times and venues are NOT NULL, while teacher_en, note, prerequisites and
 * restrictions are nullable.
 */
const BASE: LocalCourse = {
  raw_id: "11510CS 135000",
  semester: "11510",
  department: "CS",
  course: "1350",
  class: "00",
  credits: 3,
  name_zh: "程式設計",
  name_en: "Programming Design",
  teacher_zh: ["吳貞興"],
  teacher_en: ["Wu Chen Hsing"],
  times: ["M1M2"],
  venues: ["台達101"],
  note: null,
  prerequisites: null,
  restrictions: null,
};

const course = (over: Partial<LocalCourse> = {}): LocalCourse =>
  Object.assign({}, BASE, over);

const corpus = (...courses: LocalCourse[]) => courses.map(toSearchable);

describe("terms", () => {
  it("splits Latin words and keeps CJK runs whole", () => {
    expect(terms("Linear Algebra 線性代數")).toEqual([
      "linear",
      "algebra",
      "線性代數",
    ]);
  });

  it("returns nothing for text with no letters or CJK", () => {
    expect(terms("   ---   ")).toEqual([]);
  });

  it("treats punctuation and dashes as separators", () => {
    expect(terms("Bachelor's Thesis")).toEqual(["bachelor", "s", "thesis"]);
    expect(terms("Statistics – Advanced")).toEqual(["statistics", "advanced"]);
  });

  it("normalizes full-width alphanumerics", () => {
    expect(terms("英文Ａ１")).toEqual(["英文", "a1"]);
  });

  it("keeps CJK runs whole across CJK punctuation", () => {
    expect(terms("《紅樓夢》研究")).toEqual(["紅樓夢", "研究"]);
  });

  it("drops Roman numerals, which occur in 627 of 57,214 English titles", () => {
    expect(terms("Calculus Ⅰ")).toEqual(["calculus"]);
  });
});

describe("toSearchable", () => {
  it("joins the department and course number into one code", () => {
    expect(toSearchable(course()).code).toBe("cs1350");
  });

  it("collects both teacher languages into one field", () => {
    const entry = toSearchable(course());
    expect(entry.teacher).toContain("吳貞興");
    expect(entry.teacher).toContain("wu chen hsing");
  });

  it("tolerates a null teacher_en", () => {
    const entry = toSearchable(course({ teacher_en: null }));
    expect(entry.teacher).toBe("吳貞興");
  });

  it("tolerates a course with no teachers listed", () => {
    const entry = toSearchable(course({ teacher_zh: [], teacher_en: null }));
    expect(entry.teacher).toBe("");
  });
});

describe("score", () => {
  it("ranks a course-code match above a title match", () => {
    const code = score(toSearchable(course()), "cs");
    const title = score(
      toSearchable(course({ department: "ART", name_en: "CS for Artists" })),
      "artists",
    );
    expect(code).toBeGreaterThan(title);
  });

  it("ranks a title match above a teacher match", () => {
    const title = score(toSearchable(course()), "programming");
    const teacher = score(toSearchable(course()), "吳貞興");
    expect(title).toBeGreaterThan(teacher);
  });

  it("matches a CJK title by prefix", () => {
    expect(score(toSearchable(course()), "程式")).toBeGreaterThan(0);
  });

  it("does not match mid-word", () => {
    const entry = toSearchable(course({ name_en: "Artificial Intelligence" }));
    expect(score(entry, "ficial")).toBe(0);
  });

  it("ignores case", () => {
    expect(score(toSearchable(course()), "PROGRAMMING")).toBeGreaterThan(0);
  });

  it("normalizes a full-width query", () => {
    expect(score(toSearchable(course()), "ＣＳ")).toBeGreaterThan(0);
  });

  it("returns 0 for an empty query", () => {
    expect(score(toSearchable(course()), "")).toBe(0);
  });
});

describe("search", () => {
  it("returns matches highest score first", () => {
    const hits = search(
      corpus(
        course({ raw_id: "a", department: "MATH", name_en: "Statistics" }),
        course({ raw_id: "b", department: "CS", course: "1350" }),
      ),
      "cs",
    );
    expect(hits[0].course.raw_id).toBe("b");
  });

  it("excludes courses that do not match", () => {
    const hits = search(
      corpus(
        course({ raw_id: "a" }),
        course({
          raw_id: "b",
          department: "MATH",
          course: "1030",
          name_zh: "微積分",
          name_en: "Calculus",
          teacher_zh: [],
          teacher_en: null,
        }),
      ),
      "微積",
    );
    expect(hits.map((hit) => hit.course.raw_id)).toEqual(["b"]);
  });

  it("returns an empty array when nothing matches", () => {
    expect(search(corpus(course()), "zzzz")).toEqual([]);
  });
});
