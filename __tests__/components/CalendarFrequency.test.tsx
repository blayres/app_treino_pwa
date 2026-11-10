import React from 'react';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, render, screen } from '@testing-library/react';

jest.mock('../../src/services/attendanceService', () => ({
  getAttendanceDatesByMonth: jest.fn(),
  getCachedAttendanceMonth: jest.fn(() => null),
}));

import * as attendance from '../../src/services/attendanceService';
import { CalendarFrequency } from '../../src/components/CalendarFrequency';
import { localDateKey } from '../../src/utils/date';

const mocked = attendance as jest.Mocked<typeof attendance>;
const monthName = () => ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'][new Date().getMonth()];

beforeEach(() => {
  jest.clearAllMocks();
});

describe('CalendarFrequency', () => {
  it('draws the month and its days before the check-ins arrive', async () => {
    mocked.getAttendanceDatesByMonth.mockReturnValue(new Promise(() => {})); // still loading
    render(<CalendarFrequency userId={5} />);
    expect(screen.getByText(monthName())).toBeTruthy();
    expect(screen.getByText('15')).toBeTruthy();
    await act(async () => {});
  });

  it('cached check-ins are reported on the first render, then refreshed', async () => {
    const today = localDateKey(new Date());
    mocked.getCachedAttendanceMonth.mockReturnValue({ dates: new Set([today]), totalDays: 30 });
    mocked.getAttendanceDatesByMonth.mockResolvedValue({ dates: new Set([today]), totalDays: 30 });
    const onLoad = jest.fn();
    render(<CalendarFrequency userId={5} onLoad={onLoad} />);
    expect(onLoad).toHaveBeenCalledWith(1, 30);
    await act(async () => {});
    expect(mocked.getAttendanceDatesByMonth).toHaveBeenCalled();
  });
});
