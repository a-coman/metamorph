export type MrPromotionErrorCode =
  | 'not_found'
  | 'invalid_status'
  | 'missing_playbook'
  | 'integrity_failed';

export class MrPromotionError extends Error {
  constructor(
    public readonly code: MrPromotionErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'MrPromotionError';
  }
}
