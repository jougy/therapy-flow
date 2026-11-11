import { useState, useEffect } from "react";

export interface CountdownState {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMilliseconds: number;
  isExpired: boolean;
  formatted: {
    days: string;
    hours: string;
    minutes: string;
    seconds: string;
  };
}

export function calculateCountdown(target: Date | string | number): CountdownState {
  const targetTime = new Date(target).getTime();
  const now = Date.now();
  const diff = isNaN(targetTime) ? 0 : targetTime - now;

  if (diff <= 0) {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      totalMilliseconds: 0,
      isExpired: true,
      formatted: {
        days: "00",
        hours: "00",
        minutes: "00",
        seconds: "00",
      },
    };
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);

  return {
    days,
    hours,
    minutes,
    seconds,
    totalMilliseconds: diff,
    isExpired: false,
    formatted: {
      days: String(days).padStart(2, "0"),
      hours: String(hours).padStart(2, "0"),
      minutes: String(minutes).padStart(2, "0"),
      seconds: String(seconds).padStart(2, "0"),
    },
  };
}

export function useCountdown(targetDate: Date | string | number): CountdownState {
  const [countdown, setCountdown] = useState<CountdownState>(() => calculateCountdown(targetDate));

  useEffect(() => {
    setCountdown(calculateCountdown(targetDate));
    const interval = setInterval(() => {
      setCountdown((prev) => {
        const next = calculateCountdown(targetDate);
        if (next.isExpired && prev.isExpired) {
          clearInterval(interval);
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [targetDate]);

  return countdown;
}

export function formatCampaignBonus(bonusValueCents: number): string {
  return ((bonusValueCents || 0) / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function getDefaultCampaignEndDate(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
}
