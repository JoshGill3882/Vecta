// Domain Error Definitions

// Base error for others to extend
export abstract class DomainError extends Error {
  abstract readonly code: string;
}

// Not Found Error
export class NotFoundError extends DomainError {
  readonly code = "NOT_FOUND" as const;
  constructor(entity: string, id: string) {
    super(`${entity} with id ${id} was not found`);
    this.name = "NotFoundError";
  }
}

// Conflict Error
export class ConflictError extends DomainError {
  readonly code = "CONFLICT" as const;
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}
