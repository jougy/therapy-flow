import { describe, expect, it } from "vitest";
import { parseSessionShareSummaries } from "./session-sharing";

describe("session-sharing", () => {
  describe("parseSessionShareSummaries", () => {
    it("correctly parses recipients with access levels and maps read or missing values to can_evolve", () => {
      const input = [
        {
          session_id: "sess-1",
          share_count: 2,
          recipients: [
            {
              id: "user-1",
              full_name: "Estagiário Ana",
              email: "ana@clinic.com",
              job_title: "Estagiária de Fisioterapia",
              access_level: "read_only",
              shared_by_user_id: "owner-1",
              created_at: "2026-08-03T10:00:00Z",
            },
            {
              id: "user-2",
              full_name: "Dr. Carlos",
              email: "carlos@clinic.com",
              job_title: "Fisioterapeuta",
              access_level: "can_evolve",
              shared_by_user_id: "owner-1",
              created_at: "2026-08-03T10:05:00Z",
            },
            {
              id: "user-3",
              full_name: "Dra. Beatriz",
              email: "beatriz@clinic.com",
              job_title: "Fisioterapeuta",
              access_level: "read",
              shared_by_user_id: "owner-1",
              created_at: "2026-08-03T10:10:00Z",
            },
          ],
        },
      ];

      const result = parseSessionShareSummaries(input);
      expect(result).toHaveLength(1);
      expect(result[0].session_id).toBe("sess-1");
      expect(result[0].share_count).toBe(2);
      expect(result[0].recipients).toHaveLength(3);

      expect(result[0].recipients[0]).toEqual({
        id: "user-1",
        full_name: "Estagiário Ana",
        email: "ana@clinic.com",
        job_title: "Estagiária de Fisioterapia",
        operational_role: null,
        access_level: "read_only",
        shared_by_user_id: "owner-1",
        created_at: "2026-08-03T10:00:00Z",
      });

      expect(result[0].recipients[1].access_level).toBe("can_evolve");
      expect(result[0].recipients[2].access_level).toBe("can_evolve");
    });
  });
});
