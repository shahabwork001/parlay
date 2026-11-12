/** Thrown by repositories when an insert or update violates a unique constraint (e.g. a taken email). */
export class UniqueConstraintViolationError extends Error {
  constructor(readonly constraint: string) {
    super(`Unique constraint violated: ${constraint}`);
    this.name = "UniqueConstraintViolationError";
  }
}
