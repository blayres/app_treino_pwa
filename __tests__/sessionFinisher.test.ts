import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../src/services/sessionService', () => ({ stopWorkoutSession: jest.fn() }));
jest.mock('../src/services/attendanceService', () => ({ markAttendance: jest.fn(async () => {}), invalidateAttendanceCache: jest.fn() }));
jest.mock('../src/services/workoutService', () => ({ invalidateWorkoutsByUserCache: jest.fn() }));

import * as sessionService from '../src/services/sessionService';
import * as attendance from '../src/services/attendanceService';
import * as workouts from '../src/services/workoutService';
import { persistSessionEnd } from '../src/services/sessionFinisher';

const stop = sessionService.stopWorkoutSession as jest.Mock<any>;
const session = { sessionId: 77, workoutId: 3, startedAt: '2026-11-09T21:40:00Z', isRunning: true };
const events: string[] = [];
(globalThis as any).document = { dispatchEvent: (e: { type: string }) => events.push(e.type) };
(globalThis as any).Event = class { constructor(public type: string) {} };

beforeEach(() => {
  jest.clearAllMocks();
  events.length = 0;
});

describe('persistSessionEnd', () => {
  it('checks the day the workout started and refreshes the screens', async () => {
    const startDay = new Date(session.startedAt);
    stop.mockResolvedValue({ completed: 1, attendanceDate: startDay });

    await persistSessionEnd({ userId: 5, session, cancelOnly: false });

    expect(stop).toHaveBeenCalledWith({ userId: 5, sessionId: 77, startedAt: session.startedAt, cancelOnly: false });
    expect(attendance.markAttendance).toHaveBeenCalledWith(5, startDay);
    expect(attendance.invalidateAttendanceCache).toHaveBeenCalledWith(5);
    expect(workouts.invalidateWorkoutsByUserCache).toHaveBeenCalledWith(5);
    expect(events).toEqual(['workoutSessionUpdated']);
  });

  it('discarding gives no check', async () => {
    stop.mockResolvedValue({ completed: 0, attendanceDate: new Date() });
    await persistSessionEnd({ userId: 5, session, cancelOnly: true });
    expect(attendance.markAttendance).not.toHaveBeenCalled();
  });

  it('a failed save does not check the day', async () => {
    stop.mockRejectedValue(new Error('offline'));
    await expect(persistSessionEnd({ userId: 5, session, cancelOnly: false })).rejects.toThrow('offline');
    expect(attendance.markAttendance).not.toHaveBeenCalled();
  });
});
