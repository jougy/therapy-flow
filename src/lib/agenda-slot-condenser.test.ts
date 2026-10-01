import { describe, expect, it } from "vitest";
import type { AgendaEventItem } from "@/lib/agenda-events";
import {
  condenseAgendaTurnSlots,
  findConflictingAgendaEvents,
  formatFreeSlotLabel,
  formatSlotDuration,
  minuteToTimeString,
  TURN_BOUNDARIES,
} from "./agenda-slot-condenser";

describe("agenda-slot-condenser helpers", () => {
  it("converts minute offsets to HH:mm strings correctly", () => {
    expect(minuteToTimeString(0)).toBe("00:00");
    expect(minuteToTimeString(60)).toBe("01:00");
    expect(minuteToTimeString(419)).toBe("06:59");
    expect(minuteToTimeString(420)).toBe("07:00");
    expect(minuteToTimeString(779)).toBe("12:59");
    expect(minuteToTimeString(780)).toBe("13:00");
    expect(minuteToTimeString(1139)).toBe("18:59");
    expect(minuteToTimeString(1140)).toBe("19:00");
    expect(minuteToTimeString(1439)).toBe("23:59");
  });

  it("formats slot duration into human-readable strings", () => {
    expect(formatSlotDuration(30)).toBe("30min");
    expect(formatSlotDuration(60)).toBe("1h");
    expect(formatSlotDuration(90)).toBe("1h 30min");
    expect(formatSlotDuration(419)).toBe("6h 59min");
    expect(formatSlotDuration(480)).toBe("8h");
  });

  it("formats free slot label", () => {
    expect(formatFreeSlotLabel(60)).toBe("1h livre");
    expect(formatFreeSlotLabel(419)).toBe("6h 59min livre");
  });
});

describe("condenseAgendaTurnSlots", () => {
  const baseDay = new Date(2026, 8, 26, 12, 0, 0, 0); // 2026-09-26

  const createEvent = (partial: Partial<AgendaEventItem>): AgendaEventItem => ({
    id: `ev-${Math.random().toString(36).substring(2, 9)}`,
    eventType: "atendimento",
    patientId: "patient-1",
    scheduledFor: "2026-09-26T00:00:00.000Z",
    status: "confirmado",
    title: "Consulta Clínica",
    date: baseDay,
    time: "09:00",
    durationMinutes: 60,
    ...partial,
  });

  // 1. Turnos vazios (4 blocos de ~6h59)
  describe("Turnos vazios", () => {
    it("condensa turno 'dawn' vazio em um único slot livre de 00:00 às 06:59 (419 min)", () => {
      const slots = condenseAgendaTurnSlots([], "dawn", baseDay);

      expect(slots).toHaveLength(1);
      expect(slots[0]).toEqual({
        type: "free",
        startTime: "00:00",
        endTime: "06:59",
        durationMinutes: 419,
        label: "6h 59min livre",
      });
    });

    it("condensa turno 'morning' vazio em um único slot livre de 07:00 às 12:59 (359 min)", () => {
      const slots = condenseAgendaTurnSlots([], "morning", baseDay);

      expect(slots).toHaveLength(1);
      expect(slots[0]).toEqual({
        type: "free",
        startTime: "07:00",
        endTime: "12:59",
        durationMinutes: 359,
        label: "5h 59min livre",
      });
    });

    it("condensa turno 'afternoon' vazio em um único slot livre de 13:00 às 18:59 (359 min)", () => {
      const slots = condenseAgendaTurnSlots([], "afternoon", baseDay);

      expect(slots).toHaveLength(1);
      expect(slots[0]).toEqual({
        type: "free",
        startTime: "13:00",
        endTime: "18:59",
        durationMinutes: 359,
        label: "5h 59min livre",
      });
    });

    it("condensa turno 'night' vazio em um único slot livre de 19:00 às 23:59 (299 min)", () => {
      const slots = condenseAgendaTurnSlots([], "night", baseDay);

      expect(slots).toHaveLength(1);
      expect(slots[0]).toEqual({
        type: "free",
        startTime: "19:00",
        endTime: "23:59",
        durationMinutes: 299,
        label: "4h 59min livre",
      });
    });
  });

  // 2. Com 1 evento
  describe("Turnos com 1 evento", () => {
    it("intercala slot livre inicial, evento no meio da manhã e slot livre restante", () => {
      const event = createEvent({
        time: "09:00",
        durationMinutes: 60,
        title: "Atendimento João",
      });

      const slots = condenseAgendaTurnSlots([event], "morning", baseDay);

      expect(slots).toHaveLength(3);

      // Slot livre inicial (07:00 às 09:00 = 120 min)
      expect(slots[0]).toEqual({
        type: "free",
        startTime: "07:00",
        endTime: "09:00",
        durationMinutes: 120,
        label: "2h livre",
      });

      // Slot ocupado (09:00 às 10:00 = 60 min)
      expect(slots[1]).toMatchObject({
        type: "occupied",
        startTime: "09:00",
        endTime: "10:00",
        durationMinutes: 60,
        event,
        label: "Atendimento João",
      });

      // Slot livre restante (10:00 às 12:59 = 179 min)
      expect(slots[2]).toEqual({
        type: "free",
        startTime: "10:00",
        endTime: "12:59",
        durationMinutes: 179,
        label: "2h 59min livre",
      });
    });

    it("não gera slot livre antes se o evento começar exatamente no início do turno", () => {
      const event = createEvent({
        time: "00:00",
        durationMinutes: 60,
        title: "Plantão Inicial",
      });

      const slots = condenseAgendaTurnSlots([event], "dawn", baseDay);

      expect(slots).toHaveLength(2);
      expect(slots[0].type).toBe("occupied");
      expect(slots[0].startTime).toBe("00:00");
      expect(slots[0].endTime).toBe("01:00");

      expect(slots[1]).toEqual({
        type: "free",
        startTime: "01:00",
        endTime: "06:59",
        durationMinutes: 359,
        label: "5h 59min livre",
      });
    });

    it("não gera slot livre depois se o evento cobrir até o fim do turno", () => {
      const event = createEvent({
        time: "18:00",
        durationMinutes: 59, // 18:00 às 18:59
        title: "Último Atendimento da Tarde",
      });

      const slots = condenseAgendaTurnSlots([event], "afternoon", baseDay);

      expect(slots).toHaveLength(2);
      expect(slots[0]).toEqual({
        type: "free",
        startTime: "13:00",
        endTime: "18:00",
        durationMinutes: 300,
        label: "5h livre",
      });
      expect(slots[1].type).toBe("occupied");
      expect(slots[1].startTime).toBe("18:00");
      expect(slots[1].endTime).toBe("18:59");
    });
  });

  // 3. Múltiplos eventos
  describe("Turnos com múltiplos eventos", () => {
    it("intercala múltiplos eventos com suas respectivas lacunas livres", () => {
      const ev1 = createEvent({ time: "14:00", durationMinutes: 60, title: "Consulta 1" });
      const ev2 = createEvent({ time: "16:00", durationMinutes: 30, title: "Consulta 2" });

      const slots = condenseAgendaTurnSlots([ev2, ev1], "afternoon", baseDay); // ordem invertida propositalmente

      expect(slots).toHaveLength(5);

      // 1. Livre: 13:00 - 14:00 (60 min)
      expect(slots[0]).toEqual({
        type: "free",
        startTime: "13:00",
        endTime: "14:00",
        durationMinutes: 60,
        label: "1h livre",
      });

      // 2. Ocupado: Consulta 1 (14:00 - 15:00)
      expect(slots[1]).toMatchObject({
        type: "occupied",
        startTime: "14:00",
        endTime: "15:00",
        durationMinutes: 60,
      });

      // 3. Livre: 15:00 - 16:00 (60 min)
      expect(slots[2]).toEqual({
        type: "free",
        startTime: "15:00",
        endTime: "16:00",
        durationMinutes: 60,
        label: "1h livre",
      });

      // 4. Ocupado: Consulta 2 (16:00 - 16:30)
      expect(slots[3]).toMatchObject({
        type: "occupied",
        startTime: "16:00",
        endTime: "16:30",
        durationMinutes: 30,
      });

      // 5. Livre: 16:30 - 18:59 (149 min)
      expect(slots[4]).toEqual({
        type: "free",
        startTime: "16:30",
        endTime: "18:59",
        durationMinutes: 149,
        label: "2h 29min livre",
      });
    });

    it("ignora lacuna entre dois eventos contíguos sequenciais", () => {
      const ev1 = createEvent({ time: "09:00", durationMinutes: 60, title: "Consulta A" });
      const ev2 = createEvent({ time: "10:00", durationMinutes: 60, title: "Consulta B" });

      const slots = condenseAgendaTurnSlots([ev1, ev2], "morning", baseDay);

      expect(slots).toHaveLength(4);
      expect(slots[0].type).toBe("free"); // 07:00 - 09:00
      expect(slots[1].type).toBe("occupied"); // 09:00 - 10:00
      expect(slots[2].type).toBe("occupied"); // 10:00 - 11:00 (sem slot livre intermediário)
      expect(slots[3].type).toBe("free"); // 11:00 - 12:59
    });
  });

  // 4. Sem intervalos livres
  describe("Turno sem intervalos livres", () => {
    it("retorna exclusivamente slots ocupados quando os eventos cobrem integralmente o turno", () => {
      // Turno da tarde: 13:00 às 18:59 (359 minutos)
      const ev1 = createEvent({ time: "13:00", durationMinutes: 180, title: "Workshop Parte 1" }); // 13:00 - 16:00
      const ev2 = createEvent({ time: "16:00", durationMinutes: 180, title: "Workshop Parte 2" }); // 16:00 - 19:00 (ultrapassa 18:59)

      const slots = condenseAgendaTurnSlots([ev1, ev2], "afternoon", baseDay);

      expect(slots).toHaveLength(2);
      expect(slots[0].type).toBe("occupied");
      expect(slots[1].type).toBe("occupied");
      expect(slots.filter((s) => s.type === "free")).toHaveLength(0);
    });
  });

  // 5. Eventos cancelados
  describe("Eventos cancelados", () => {
    it("ignora eventos com status 'cancelado' mantendo o espaço livre", () => {
      const cancelledEvent = createEvent({
        time: "10:00",
        durationMinutes: 60,
        status: "cancelado",
      });

      const slots = condenseAgendaTurnSlots([cancelledEvent], "morning", baseDay);

      expect(slots).toHaveLength(1);
      expect(slots[0].type).toBe("free");
      expect(slots[0].durationMinutes).toBe(359);
    });
  });

  // 6. Eventos sobrepostos
  describe("Eventos sobrepostos", () => {
    it("lida de forma robusta com sobreposição sem gerar slots livres negativos", () => {
      const ev1 = createEvent({ time: "09:00", durationMinutes: 90, title: "Evento Longo" }); // 09:00 - 10:30
      const ev2 = createEvent({ time: "09:30", durationMinutes: 30, title: "Evento Concorrente" }); // 09:30 - 10:00

      const slots = condenseAgendaTurnSlots([ev1, ev2], "morning", baseDay);

      expect(slots).toHaveLength(4);
      expect(slots[0].type).toBe("free"); // 07:00 - 09:00
      expect(slots[1].type).toBe("occupied"); // 09:00 - 10:30
      expect(slots[2].type).toBe("occupied"); // 09:30 - 10:00
      expect(slots[3]).toEqual({
        type: "free",
        startTime: "10:30",
        endTime: "12:59",
        durationMinutes: 149,
        label: "2h 29min livre",
      });
    });
  });

  // 7. Eventos Spanning (invadindo turnos)
  describe("Eventos Spanning (Interperíodo)", () => {
    it("detecta spanning quando o evento começa na madrugada e termina na manhã (ex: 06:30 às 07:20)", () => {
      const spanningEvent = createEvent({
        time: "06:30",
        durationMinutes: 50, // 06:30 a 07:20
        title: "Plantão Transição",
      });

      // No turno da madrugada (00:00 - 06:59): termina após o turno
      const dawnSlots = condenseAgendaTurnSlots([spanningEvent], "dawn", baseDay);
      const dawnOccupied = dawnSlots.find((s) => s.type === "occupied");
      expect(dawnOccupied).toBeDefined();
      expect(dawnOccupied?.spanning?.isSpanning).toBe(true);
      expect(dawnOccupied?.spanning?.endsAfterTurn).toBe(true);
      expect(dawnOccupied?.spanning?.spanLabel).toBe("Continua no próximo período (término às 07:20)");

      // No turno da manhã (07:00 - 12:59): começou antes do turno
      const morningSlots = condenseAgendaTurnSlots([spanningEvent], "morning", baseDay);
      const morningOccupied = morningSlots.find((s) => s.type === "occupied");
      expect(morningOccupied).toBeDefined();
      expect(morningOccupied?.spanning?.isSpanning).toBe(true);
      expect(morningOccupied?.spanning?.startsBeforeTurn).toBe(true);
      expect(morningOccupied?.spanning?.spanLabel).toBe("Inicia no período anterior (06:30)");
    });
  });

  // 8. Detecção de Conflitos em Tempo Real
  describe("findConflictingAgendaEvents", () => {
    it("detecta sobreposições no mesmo dia e desconsidera eventos cancelados", () => {
      const ev1 = createEvent({ id: "ev-1", time: "10:00", durationMinutes: 60, title: "Consulta 10h" });
      const evCancelled = createEvent({ id: "ev-2", time: "10:30", durationMinutes: 30, status: "cancelado" });

      const conflicts = findConflictingAgendaEvents({
        date: baseDay,
        startTime: "10:30",
        durationMinutes: 45,
        existingEvents: [ev1, evCancelled],
      });

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].event.id).toBe("ev-1");
      expect(conflicts[0].endTime).toBe("11:00");
    });

    it("ignora o próprio evento no modo de edição (excludeEventId)", () => {
      const ev1 = createEvent({ id: "ev-1", time: "10:00", durationMinutes: 60, title: "Consulta 10h" });

      const conflicts = findConflictingAgendaEvents({
        date: baseDay,
        startTime: "10:00",
        durationMinutes: 60,
        existingEvents: [ev1],
        excludeEventId: "ev-1",
      });

      expect(conflicts).toHaveLength(0);
    });
  });

  // 9. Determinismo e Imutabilidade
  describe("Determinismo e Imutabilidade", () => {
    it("não muta o array de entrada de eventos e produz resultados idênticos em múltiplas chamadas", () => {
      const ev1 = createEvent({ time: "10:00", durationMinutes: 60 });
      const ev2 = createEvent({ time: "08:00", durationMinutes: 30 });
      const originalEvents = [ev1, ev2];
      const snapshot = [...originalEvents];

      const res1 = condenseAgendaTurnSlots(originalEvents, "morning", baseDay);
      const res2 = condenseAgendaTurnSlots(originalEvents, "morning", baseDay);

      expect(originalEvents).toEqual(snapshot);
      expect(res1).toEqual(res2);
    });
  });

  // 9. Eficiência Assintótica O(N log N) e Prevenção contra loops O(N^2)
  describe("Eficiência Assintótica e Escalabilidade Big-O", () => {
    it("processa 1.000 eventos em poucos milissegundos sem degradação quadrática", () => {
      const largeEventList: AgendaEventItem[] = [];
      for (let i = 0; i < 1000; i++) {
        const hour = 1 + (i % 10);
        const minute = (i * 7) % 60;
        const timeStr = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
        largeEventList.push(
          createEvent({
            id: `large-ev-${i}`,
            time: timeStr,
            durationMinutes: 15,
            title: `Consulta em Massa #${i}`,
          })
        );
      }

      const startTime = performance.now();
      const slots = condenseAgendaTurnSlots(largeEventList, "morning", baseDay);
      const elapsed = performance.now() - startTime;

      expect(slots.length).toBeGreaterThan(0);
      // 1.000 eventos devem rodar em menos de 100ms em hardware comum (evidenciando O(N log N) e ausência de O(N^2))
      expect(elapsed).toBeLessThan(100);
    });

    it("é resiliente a horários mal formatados ou durações extremas", () => {
      const corruptedEvents: AgendaEventItem[] = [
        createEvent({
          time: "invalid-time",
          durationMinutes: -50,
          title: "Evento Corrompido 1",
        }),
        createEvent({
          time: "28:99",
          durationMinutes: 999999,
          title: "Evento Corrompido 2",
        }),
        createEvent({
          time: "09:00",
          durationMinutes: 60,
          title: "Evento Válido",
        }),
      ];

      const slots = condenseAgendaTurnSlots(corruptedEvents, "morning", baseDay);
      expect(slots.length).toBeGreaterThan(0);
      const validSlot = slots.find((s) => s.type === "occupied" && s.label === "Evento Válido");
      expect(validSlot).toBeDefined();
    });
  });
});
