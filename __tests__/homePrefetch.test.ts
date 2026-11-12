import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../src/services/attendanceService', () => ({ getAttendanceDatesByMonth: jest.fn() }));
jest.mock('../src/services/coachService', () => ({ getCoachCode: jest.fn(), getMyCoach: jest.fn() }));
jest.mock('../src/services/programReminder', () => ({ getProgramReminder: jest.fn() }));
jest.mock('../src/services/workoutService', () => ({ getWorkoutsByUser: jest.fn() }));

import { prefetchHomeData, waitAtMost } from '../src/services/homePrefetch';
import { getAttendanceDatesByMonth } from '../src/services/attendanceService';
import { getCoachCode, getMyCoach } from '../src/services/coachService';
import { getProgramReminder } from '../src/services/programReminder';
import { getWorkoutsByUser } from '../src/services/workoutService';

const mocked = <T extends (...args: any[]) => any>(fn: T) => fn as unknown as jest.Mock<any>;

beforeEach(() => {
  mocked(getAttendanceDatesByMonth).mockReset().mockResolvedValue({ dates: new Set(), totalDays: 30 });
  mocked(getCoachCode).mockReset().mockResolvedValue(null);
  mocked(getMyCoach).mockReset().mockResolvedValue(null);
  mocked(getProgramReminder).mockReset().mockResolvedValue(null);
  mocked(getWorkoutsByUser).mockReset().mockResolvedValue([]);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('prefetchHomeData', () => {
  it('warms every Home query for that user and this month', async () => {
    await prefetchHomeData(7, new Date(2026, 10, 12));
    expect(getWorkoutsByUser).toHaveBeenCalledWith(7);
    expect(getAttendanceDatesByMonth).toHaveBeenCalledWith({ userId: 7, year: 2026, month: 10 });
    expect(getProgramReminder).toHaveBeenCalledWith(7);
    expect(getCoachCode).toHaveBeenCalledWith(7);
    expect(getMyCoach).toHaveBeenCalledWith(7);
  });

  it('never rejects: each screen handles its own errors', async () => {
    mocked(getWorkoutsByUser).mockRejectedValue(new Error('offline'));
    mocked(getCoachCode).mockRejectedValue(new Error('offline'));
    mocked(getMyCoach).mockRejectedValue(new Error('offline'));
    mocked(getProgramReminder).mockRejectedValue(new Error('offline'));
    await expect(prefetchHomeData(7)).resolves.toBeUndefined();
  });
});

describe('waitAtMost', () => {
  it('resolves as soon as the work is done', async () => {
    jest.useFakeTimers();
    let done = false;
    const wait = waitAtMost(Promise.resolve(), 1000).then(() => {
      done = true;
    });
    await wait;
    expect(done).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('gives up after the limit when the work is slow', async () => {
    jest.useFakeTimers();
    let done = false;
    void waitAtMost(new Promise(() => {}), 1000).then(() => {
      done = true;
    });
    jest.advanceTimersByTime(999);
    await Promise.resolve();
    expect(done).toBe(false);
    jest.advanceTimersByTime(1);
    await Promise.resolve();
    expect(done).toBe(true);
  });
});
