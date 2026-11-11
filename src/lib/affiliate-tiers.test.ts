import { describe, it, expect } from 'vitest';
import {
  AFFILIATE_TIERS,
  AffiliateTier,
  formatCommissionPercent,
  getAffiliateTierByVolume,
  getAffiliateTierDefinition,
  getNextAffiliateTier,
  getTierProgressPercentage,
} from './affiliate-tiers';

describe('affiliate-tiers module', () => {
  describe('AFFILIATE_TIERS catalog integrity', () => {
    it('contains exactly 8 official tiers in ascending progression order', () => {
      expect(AFFILIATE_TIERS).toHaveLength(8);
      const expectedOrder: AffiliateTier[] = [
        'bronze',
        'silver',
        'gold',
        'sapphire',
        'ruby',
        'emerald',
        'diamond',
        'legendary',
      ];
      expect(AFFILIATE_TIERS.map((t) => t.tier)).toEqual(expectedOrder);
    });

    it('enforces that Bronze has no subscription waiver while Silver and above are waived', () => {
      const bronze = getAffiliateTierDefinition('bronze');
      expect(bronze.isSubscriptionWaived).toBe(false);
      expect(bronze.eligiblePlanTier).toBe('none');

      const higherTiers: AffiliateTier[] = [
        'silver',
        'gold',
        'sapphire',
        'ruby',
        'emerald',
        'diamond',
        'legendary',
      ];
      for (const tierKey of higherTiers) {
        const tierDef = getAffiliateTierDefinition(tierKey);
        expect(tierDef.isSubscriptionWaived).toBe(true);
      }
    });

    it('has monotonically increasing commission percentages', () => {
      for (let i = 0; i < AFFILIATE_TIERS.length - 1; i++) {
        const current = AFFILIATE_TIERS[i];
        const next = AFFILIATE_TIERS[i + 1];
        expect(next.firstMonthCommissionPercent).toBeGreaterThan(current.firstMonthCommissionPercent);
        expect(next.recurringCommissionPercent).toBeGreaterThan(current.recurringCommissionPercent);
      }
    });
  });

  describe('getAffiliateTierByVolume', () => {
    it('correctly maps 0 to 3 referrals to Bronze tier', () => {
      expect(getAffiliateTierByVolume(0).tier).toBe('bronze');
      expect(getAffiliateTierByVolume(1).tier).toBe('bronze');
      expect(getAffiliateTierByVolume(2).tier).toBe('bronze');
      expect(getAffiliateTierByVolume(3).tier).toBe('bronze');
    });

    it('correctly maps 4 to 10 referrals to Silver tier', () => {
      expect(getAffiliateTierByVolume(4).tier).toBe('silver');
      expect(getAffiliateTierByVolume(7).tier).toBe('silver');
      expect(getAffiliateTierByVolume(10).tier).toBe('silver');
    });

    it('correctly maps 11 to 20 referrals to Gold tier', () => {
      expect(getAffiliateTierByVolume(11).tier).toBe('gold');
      expect(getAffiliateTierByVolume(15).tier).toBe('gold');
      expect(getAffiliateTierByVolume(20).tier).toBe('gold');
    });

    it('correctly maps 21 to 30 referrals to Sapphire tier', () => {
      expect(getAffiliateTierByVolume(21).tier).toBe('sapphire');
      expect(getAffiliateTierByVolume(30).tier).toBe('sapphire');
    });

    it('correctly maps 31 to 50 referrals to Ruby tier', () => {
      expect(getAffiliateTierByVolume(31).tier).toBe('ruby');
      expect(getAffiliateTierByVolume(50).tier).toBe('ruby');
    });

    it('correctly maps 51 to 100 referrals to Emerald tier', () => {
      expect(getAffiliateTierByVolume(51).tier).toBe('emerald');
      expect(getAffiliateTierByVolume(100).tier).toBe('emerald');
    });

    it('correctly maps 101 to 200 referrals to Diamond tier', () => {
      expect(getAffiliateTierByVolume(101).tier).toBe('diamond');
      expect(getAffiliateTierByVolume(200).tier).toBe('diamond');
    });

    it('correctly maps 201+ referrals to Legendary tier', () => {
      expect(getAffiliateTierByVolume(201).tier).toBe('legendary');
      expect(getAffiliateTierByVolume(500).tier).toBe('legendary');
    });

    it('safely handles negative activeCount by clamping to 0 (Bronze)', () => {
      expect(getAffiliateTierByVolume(-5).tier).toBe('bronze');
    });

    it('respects floorTier when volume is lower than guaranteed floor', () => {
      // Influencer with 0 sales but Gold guarantee
      const vipZero = getAffiliateTierByVolume(0, 'gold');
      expect(vipZero.tier).toBe('gold');
      expect(vipZero.firstMonthCommissionPercent).toBe(40);

      // Partner with 5 sales (Silver by volume), but guaranteed Ruby floor
      const vipSilver = getAffiliateTierByVolume(5, 'ruby');
      expect(vipSilver.tier).toBe('ruby');
      expect(vipSilver.firstMonthCommissionPercent).toBe(50);
    });

    it('allows natural advancement when organic volume surpasses the floorTier', () => {
      // Partner with Gold floor (min 11), but achieved 60 referrals (Emerald by volume)
      const highPerformer = getAffiliateTierByVolume(60, 'gold');
      expect(highPerformer.tier).toBe('emerald');
      expect(highPerformer.recurringCommissionPercent).toBe(25);
    });
  });

  describe('getNextAffiliateTier', () => {
    it('returns the subsequent tier definition in the progression ladder', () => {
      expect(getNextAffiliateTier('bronze')?.tier).toBe('silver');
      expect(getNextAffiliateTier('silver')?.tier).toBe('gold');
      expect(getNextAffiliateTier('gold')?.tier).toBe('sapphire');
      expect(getNextAffiliateTier('sapphire')?.tier).toBe('ruby');
      expect(getNextAffiliateTier('ruby')?.tier).toBe('emerald');
      expect(getNextAffiliateTier('emerald')?.tier).toBe('diamond');
      expect(getNextAffiliateTier('diamond')?.tier).toBe('legendary');
    });

    it('returns null when reaching Legendary (highest tier)', () => {
      expect(getNextAffiliateTier('legendary')).toBeNull();
    });
  });

  describe('getTierProgressPercentage', () => {
    it('calculates progress percentage towards next tier for Bronze', () => {
      // Bronze min 0, Silver min 4 => span = 4
      expect(getTierProgressPercentage(0, 'bronze')).toBe(0);
      expect(getTierProgressPercentage(1, 'bronze')).toBe(25);
      expect(getTierProgressPercentage(2, 'bronze')).toBe(50);
      expect(getTierProgressPercentage(3, 'bronze')).toBe(75);
      expect(getTierProgressPercentage(4, 'bronze')).toBe(100);
    });

    it('calculates progress percentage within higher tiers', () => {
      // Silver min 4, Gold min 11 => span = 7
      expect(getTierProgressPercentage(4, 'silver')).toBe(0);
      expect(getTierProgressPercentage(11, 'silver')).toBe(100);
      // 4 + 3.5 = 7.5 referrals => 50%
      expect(getTierProgressPercentage(7, 'silver')).toBe(43); // 3/7 * 100 ~ 42.86 -> 43%
    });

    it('clamps values between 0 and 100', () => {
      expect(getTierProgressPercentage(-1, 'bronze')).toBe(0);
      expect(getTierProgressPercentage(10, 'bronze')).toBe(100);
    });

    it('returns 100% for Legendary because it has no next tier', () => {
      expect(getTierProgressPercentage(201, 'legendary')).toBe(100);
      expect(getTierProgressPercentage(999, 'legendary')).toBe(100);
    });
  });

  describe('formatCommissionPercent', () => {
    it('formats integer percentages correctly', () => {
      expect(formatCommissionPercent(30)).toBe('30%');
      expect(formatCommissionPercent(13)).toBe('13%');
      expect(formatCommissionPercent(0)).toBe('0%');
    });

    it('handles decimal formats (e.g. 0.35 -> 35%)', () => {
      expect(formatCommissionPercent(0.35)).toBe('35%');
      expect(formatCommissionPercent(0.125)).toBe('12.5%');
    });

    it('handles fractional percentages like 12.5', () => {
      expect(formatCommissionPercent(12.5)).toBe('12.5%');
    });

    it('safely handles non-finite inputs', () => {
      expect(formatCommissionPercent(NaN)).toBe('0%');
      expect(formatCommissionPercent(Infinity)).toBe('0%');
    });
  });
});
