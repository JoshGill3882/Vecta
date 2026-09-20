/** Base class for errors the application raises deliberately.
 *
 * A caller can tell one of these from an unexpected failure, which is what
 * decides whether its message is safe to show the user.
 */
export abstract class DomainError extends Error {
  abstract readonly code: string;
}

/** Raised when a record the caller named does not exist. */
export class NotFoundError extends DomainError {
  readonly code = "NOT_FOUND" as const;
  constructor(entity: string, id: string) {
    super(`${entity} with id ${id} was not found`);
    this.name = "NotFoundError";
  }
}

/** Raised when a write would break a uniqueness rule. */
export class ConflictError extends DomainError {
  readonly code = "CONFLICT" as const;
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}
