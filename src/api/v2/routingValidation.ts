import { RequestValidationError } from './catalogValidation';

export function parseAutoChannel(raw: string | null): string {
  const value = raw?.trim() || 'auto';
  if (value.length > 128 || !/^[a-zA-Z0-9:_-]+$/.test(value)) {
    throw new RequestValidationError('channel must be a simple auto/* suffix');
  }
  return value;
}
