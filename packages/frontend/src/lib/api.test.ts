import { describe, expect, it, vi, beforeEach } from 'vitest';
import { getApiErrorMessage, parseApiError } from './api';

const toastErrorMock = vi.fn();

vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

describe('api error helpers', () => {
  beforeEach(() => {
    toastErrorMock.mockReset();
  });

  it('getApiErrorMessage returns first validation detail message', () => {
    const error = {
      response: {
        data: {
          code: 'VALIDATION_ERROR',
          details: {
            baseRate: ['Base rate must be positive'],
            effectiveFrom: ['Invalid date'],
          },
        },
      },
    };

    const message = getApiErrorMessage(error, 'Fallback');
    expect(message).toBe('Base rate must be positive');
  });

  it('getApiErrorMessage returns backend business error message', () => {
    const error = {
      response: {
        data: {
          error: 'Compensation schema is not ready. Run backend migrations and retry.',
        },
      },
    };

    const message = getApiErrorMessage(error, 'Fallback');
    expect(message).toBe('Compensation schema is not ready. Run backend migrations and retry.');
  });

  it('getApiErrorMessage falls back when no useful payload exists', () => {
    const message = getApiErrorMessage({}, 'Fallback');
    expect(message).toBe('Fallback');
  });

  it('parseApiError uses fallback parser path when payload has no explicit error', () => {
    parseApiError({ response: { data: {} } }, 'Fallback parse');
    expect(toastErrorMock).toHaveBeenCalledWith('Fallback parse');
  });
});
