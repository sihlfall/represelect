// !!! Do not alter the integer constants. !!!
// The below functions rely on INACTIVE < PENDING < SUCCESS < FAILURE.
const INACTIVE = 0 as const;
const PENDING = 1 as const;
const SUCCESS = 2 as const;
const FAILURE = 4 as const;

export const Status = { INACTIVE, PENDING, SUCCESS, FAILURE } as const;
export type Status = (typeof Status)[keyof typeof Status];

export type Inactive = {
  readonly status: typeof INACTIVE
};
export type Pending = {
  readonly status: typeof PENDING
};
export type Success<Value> = {
  readonly status: typeof SUCCESS,
  readonly value: Value
};
export type Failure = {
  readonly status: typeof FAILURE,
  readonly reason: unknown
};
export type Undecided = Inactive | Pending;
export type Decided<T> = Success<T> | Failure;
export type Unspecified<T> = Inactive | Pending | Success<T> | Failure;

export function inactive (): Inactive {
  return { status: INACTIVE };
}
export function pending (): Pending {
  return { status: PENDING };
}
export function success<Value> (value: Value): Success<Value> {
  return { status: SUCCESS, value };
}
export function failure (reason: unknown): Failure {
  return { status: FAILURE, reason };
}

export function isInactive (disclosure: Unspecified<any>) { return disclosure.status === INACTIVE; }
export function isPending (disclosure: Unspecified<any>) { return disclosure.status === PENDING; }
export function isSuccess (disclosure: Unspecified<any>) { return disclosure.status === SUCCESS; }
export function isFailure (disclosure: Unspecified<any>) { return disclosure.status === FAILURE; }
export function isUndecided (disclosure: Unspecified<any>) { return disclosure.status <= PENDING; }
export function isDecided (disclosure: Unspecified<any>) { return disclosure.status > PENDING; }


export function equality (disclosure1: Unspecified<any>, disclosure2: Unspecified<any>): boolean {
  if (disclosure1 === disclosure2) return true;
  switch (disclosure1.status) {
    case INACTIVE: return disclosure2.status === INACTIVE;
    case PENDING: return disclosure2.status === PENDING;
    case SUCCESS: return disclosure2.status === SUCCESS && disclosure1.value === disclosure2.value;
    case FAILURE: return disclosure2.status === FAILURE && disclosure1.reason === disclosure2.reason;
  }
};