import type { ExecutionContext } from '@nestjs/common';
import { OutreachCaptureGuard } from './evangelism.controller';

function request(ip: string) {
  return {
    switchToHttp: () => ({ getRequest: () => ({ ip }) }),
  } as unknown as ExecutionContext;
}

describe('Public outreach submission limits', () => {
  it('limits repeated submissions without blocking a different source', () => {
    const guard = new OutreachCaptureGuard();
    for (let index = 0; index < 60; index++)
      expect(guard.canActivate(request('source-one'))).toBe(true);
    expect(() => guard.canActivate(request('source-one'))).toThrow(
      'Please wait',
    );
    expect(guard.canActivate(request('source-two'))).toBe(true);
  });
  it('allows submissions again after the limit expires', () => {
    jest.useFakeTimers();
    try {
      const guard = new OutreachCaptureGuard();
      for (let index = 0; index < 60; index++)
        guard.canActivate(request('source-one'));
      jest.advanceTimersByTime(60_001);
      expect(guard.canActivate(request('source-one'))).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });
});
