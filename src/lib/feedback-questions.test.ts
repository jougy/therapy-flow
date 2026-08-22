import { describe, it, expect } from "vitest";
import { FEEDBACK_QUESTIONS_POOL, pickRandomFeedbackQuestions } from "./feedback-questions";

describe("Feedback Questions Bank", () => {
  it("contains at least 30 curated feedback questions", () => {
    expect(FEEDBACK_QUESTIONS_POOL.length).toBeGreaterThanOrEqual(30);
  });

  it("ensures each question has an id, category, text, and shortLabel", () => {
    const ids = new Set<string>();
    FEEDBACK_QUESTIONS_POOL.forEach((question) => {
      expect(question.id).toBeTruthy();
      expect(question.text.length).toBeGreaterThan(10);
      expect(question.shortLabel.length).toBeGreaterThan(2);
      expect(question.category).toMatch(/usability|satisfaction|performance|routine|features|mobile/);
      expect(ids.has(question.id)).toBe(false);
      ids.add(question.id);
    });
  });

  it("picks exactly 5 random questions by default", () => {
    const selected = pickRandomFeedbackQuestions(5);
    expect(selected.length).toBe(5);

    const ids = selected.map((q) => q.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(5);
  });

  it("returns requested count without exceeding pool size", () => {
    const smallBatch = pickRandomFeedbackQuestions(3);
    expect(smallBatch.length).toBe(3);

    const largeBatch = pickRandomFeedbackQuestions(50);
    expect(largeBatch.length).toBe(FEEDBACK_QUESTIONS_POOL.length);
  });
});
