import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ALARM_BROADCAST_CHANNEL,
  ALARM_DISMISS_MESSAGE,
  dismissAlarm,
  getAudioContext,
  NOTIFICATION_SOUND_GROUPS,
  NOTIFICATION_SOUND_LABELS,
  type NotificationSoundKey,
  playNotificationPreview,
  playNotificationSound,
  resetAudioContext,
  startAlarmLoop,
  stopAlarmLoop,
} from "./notification-sounds";

class MockAudioParam {
  value = 0;
  setValueAtTime = vi.fn((val: number) => {
    this.value = val;
    return this;
  });
  exponentialRampToValueAtTime = vi.fn((val: number) => {
    this.value = val;
    return this;
  });
  linearRampToValueAtTime = vi.fn((val: number) => {
    this.value = val;
    return this;
  });
}

class MockGainNode {
  gain = new MockAudioParam();
  connect = vi.fn();
  disconnect = vi.fn();
}

class MockOscillatorNode {
  type: OscillatorType = "sine";
  frequency = new MockAudioParam();
  connect = vi.fn();
  disconnect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
}

class MockAudioContext {
  currentTime = 0;
  state = "running";
  destination = {};
  createGain = vi.fn(() => new MockGainNode());
  createOscillator = vi.fn(() => new MockOscillatorNode());
  resume = vi.fn().mockResolvedValue(undefined);
  close = vi.fn().mockResolvedValue(undefined);
}

class MockBroadcastChannel {
  name: string;
  onmessage: ((event: MessageEvent) => void) | null = null;
  static instances: MockBroadcastChannel[] = [];

  constructor(name: string) {
    this.name = name;
    MockBroadcastChannel.instances.push(this);
  }

  postMessage(message: unknown) {
    for (const inst of MockBroadcastChannel.instances) {
      if (inst !== this && inst.name === this.name && inst.onmessage) {
        inst.onmessage(new MessageEvent("message", { data: message }));
      }
    }
  }

  close() {
    MockBroadcastChannel.instances = MockBroadcastChannel.instances.filter((inst) => inst !== this);
  }
}

describe("notification-sounds", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    MockBroadcastChannel.instances = [];
    (window as unknown as { AudioContext: typeof MockAudioContext }).AudioContext =
      MockAudioContext as unknown as typeof AudioContext;
    (window as unknown as { BroadcastChannel: typeof MockBroadcastChannel }).BroadcastChannel =
      MockBroadcastChannel as unknown as typeof BroadcastChannel;
    resetAudioContext();
    stopAlarmLoop();
  });

  afterEach(() => {
    stopAlarmLoop();
    resetAudioContext();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  describe("Metadata and Sound Groups", () => {
    it("should list all 6 sounds with labels", () => {
      const keys: NotificationSoundKey[] = ["soft", "cute", "chime", "pulse", "urgent_alarm", "siren"];
      for (const key of keys) {
        expect(NOTIFICATION_SOUND_LABELS[key]).toBeDefined();
        expect(typeof NOTIFICATION_SOUND_LABELS[key]).toBe("string");
      }
    });

    it("should group the 6 sounds into gentle, moderate, and intense categories", () => {
      expect(NOTIFICATION_SOUND_GROUPS).toHaveLength(3);

      const gentle = NOTIFICATION_SOUND_GROUPS.find((g) => g.intensity === "gentle");
      expect(gentle?.groupLabel).toBe("Leves e Fofos");
      expect(gentle?.options.map((o) => o.key)).toEqual(["soft", "cute"]);

      const moderate = NOTIFICATION_SOUND_GROUPS.find((g) => g.intensity === "moderate");
      expect(moderate?.groupLabel).toBe("Moderados");
      expect(moderate?.options.map((o) => o.key)).toEqual(["chime", "pulse"]);

      const intense = NOTIFICATION_SOUND_GROUPS.find((g) => g.intensity === "intense");
      expect(intense?.groupLabel).toBe("Intensos e Urgentes");
      expect(intense?.options.map((o) => o.key)).toEqual(["urgent_alarm", "siren"]);
    });
  });

  describe("Web Audio API synthesis", () => {
    const soundKeys: NotificationSoundKey[] = ["soft", "cute", "chime", "pulse", "urgent_alarm", "siren"];

    it.each(soundKeys)("should synthesize sound '%s' correctly without error", (soundKey) => {
      const playback = playNotificationSound(soundKey);
      expect(playback.durationMs).toBeGreaterThan(0);
      expect(typeof playback.stop).toBe("function");

      const ctx = getAudioContext();
      expect(ctx).toBeTruthy();
      expect(ctx?.createGain).toHaveBeenCalled();
      expect(ctx?.createOscillator).toHaveBeenCalled();

      // Test manual stop
      playback.stop();
      vi.advanceTimersByTime(50);
    });

    it("should alias playNotificationPreview to playNotificationSound", () => {
      expect(playNotificationPreview).toBe(playNotificationSound);
    });

    it("should resume context if suspended", () => {
      const ctx = getAudioContext() as unknown as MockAudioContext;
      ctx.state = "suspended";

      playNotificationSound("soft");
      expect(ctx.resume).toHaveBeenCalled();
    });

    it("should handle environments without AudioContext gracefully", () => {
      const originalAudioContext = (window as unknown as { AudioContext: unknown }).AudioContext;
      delete (window as unknown as { AudioContext?: unknown }).AudioContext;
      delete (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext;
      resetAudioContext();

      const playback = playNotificationSound("soft");
      expect(playback.durationMs).toBe(0);
      expect(() => playback.stop()).not.toThrow();

      (window as unknown as { AudioContext: unknown }).AudioContext = originalAudioContext;
    });
  });

  describe("startAlarmLoop", () => {
    it("should execute loop up to maxLoops and call onComplete", () => {
      const onComplete = vi.fn();
      const onLoop = vi.fn();

      startAlarmLoop({
        soundKey: "urgent_alarm",
        maxLoops: 4,
        intervalMs: 1000,
        onComplete,
        onLoop,
      });

      expect(onLoop).toHaveBeenCalledWith(1, 4);

      vi.advanceTimersByTime(1000);
      expect(onLoop).toHaveBeenCalledWith(2, 4);

      vi.advanceTimersByTime(1000);
      expect(onLoop).toHaveBeenCalledWith(3, 4);

      vi.advanceTimersByTime(1000);
      expect(onLoop).toHaveBeenCalledWith(4, 4);

      // Sound finish buffer
      vi.advanceTimersByTime(600);
      expect(onComplete).toHaveBeenCalledTimes(1);
    });

    it("should allow stopping via returned stop function", () => {
      const onComplete = vi.fn();
      const onLoop = vi.fn();

      const stop = startAlarmLoop({
        soundKey: "pulse",
        maxLoops: 4,
        intervalMs: 1000,
        onComplete,
        onLoop,
      });

      expect(onLoop).toHaveBeenCalledWith(1, 4);

      // Stop after first loop
      stop();

      vi.advanceTimersByTime(5000);
      expect(onLoop).toHaveBeenCalledTimes(1);
      expect(onComplete).not.toHaveBeenCalled();
    });

    it("should allow stopping via handle.stop()", () => {
      const onComplete = vi.fn();
      const onLoop = vi.fn();

      const handle = startAlarmLoop({
        soundKey: "siren",
        maxLoops: 3,
        intervalMs: 1000,
        onComplete,
        onLoop,
      });

      expect(typeof handle.stop).toBe("function");
      handle.stop();

      vi.advanceTimersByTime(3000);
      expect(onLoop).toHaveBeenCalledTimes(1);
      expect(onComplete).not.toHaveBeenCalled();
    });

    it("should allow global stopAlarmLoop() to stop the active alarm", () => {
      const onComplete = vi.fn();
      const onLoop = vi.fn();

      startAlarmLoop({
        soundKey: "urgent_alarm",
        maxLoops: 4,
        intervalMs: 1000,
        onComplete,
        onLoop,
      });

      stopAlarmLoop();

      vi.advanceTimersByTime(4000);
      expect(onLoop).toHaveBeenCalledTimes(1);
      expect(onComplete).not.toHaveBeenCalled();
    });
  });

  describe("BroadcastChannel integration", () => {
    it("should stop alarm loop immediately when receiving DISMISS_ALARM message", () => {
      const onComplete = vi.fn();
      const onLoop = vi.fn();

      startAlarmLoop({
        soundKey: "urgent_alarm",
        maxLoops: 4,
        intervalMs: 1000,
        onComplete,
        onLoop,
      });

      expect(onLoop).toHaveBeenCalledWith(1, 4);

      const senderChannel = new MockBroadcastChannel(ALARM_BROADCAST_CHANNEL);
      senderChannel.postMessage(ALARM_DISMISS_MESSAGE);

      vi.advanceTimersByTime(4000);
      expect(onLoop).toHaveBeenCalledTimes(1);
      expect(onComplete).not.toHaveBeenCalled();
    });

    it("should stop alarm loop when receiving DISMISS_ALARM object message", () => {
      const onComplete = vi.fn();
      const onLoop = vi.fn();

      startAlarmLoop({
        soundKey: "siren",
        maxLoops: 4,
        intervalMs: 1000,
        onComplete,
        onLoop,
      });

      const senderChannel = new MockBroadcastChannel(ALARM_BROADCAST_CHANNEL);
      senderChannel.postMessage({ type: ALARM_DISMISS_MESSAGE });

      vi.advanceTimersByTime(4000);
      expect(onLoop).toHaveBeenCalledTimes(1);
      expect(onComplete).not.toHaveBeenCalled();
    });

    it("should broadcast DISMISS_ALARM when dismissAlarm() is invoked", () => {
      const listenerChannel = new MockBroadcastChannel(ALARM_BROADCAST_CHANNEL);
      const onMessage = vi.fn();
      listenerChannel.onmessage = onMessage;

      dismissAlarm();

      expect(onMessage).toHaveBeenCalled();
      const event = onMessage.mock.calls[0][0] as MessageEvent;
      expect(event.data).toBe(ALARM_DISMISS_MESSAGE);
    });
  });
});
