import { BehaviorSubject, Observable, shareReplay, take, throwIfEmpty } from "rxjs";

export const INACTIVE = 0 as const;
export const BUSY = 1 as const;
export const SUCCESS = 2 as const;
export const ERROR = 4 as const;

export type InactiveDisclosure<Value, Err> = {
  readonly status: typeof INACTIVE
};
export type BusyDisclosure<Value, Err = unknown> = {
  readonly status: typeof BUSY
};
export type SuccessDisclosure<Value> = {
  readonly status: typeof SUCCESS
  readonly value: Value
};
export type ErrorDisclosure<Err = unknown> = {
  readonly status: typeof ERROR
  readonly reason: Err
};
export type CompletedDisclosure<Value, Err = unknown> = 
  SuccessDisclosure<Value>
  | ErrorDisclosure<Err>;
export type Disclosure<Value, Err = unknown> =
  InactiveDisclosure<Value, Err>
  | BusyDisclosure<Value, Err>
  | SuccessDisclosure<Value>
  | ErrorDisclosure<Err>;

export function makeInactiveDisclosure<Value, Err> (
): InactiveDisclosure<Value, Err> {
  return { status: INACTIVE };
}
export function makeBusyDisclosure<Value, Err> (
): BusyDisclosure<Value, Err> {
  return { status: BUSY };
}
export function makeSuccessDisclosure<Value> (
  value: Value
): SuccessDisclosure<Value> {
  return { status: SUCCESS, value };
}
export function makeErrorDisclosure<Err> (
  reason: Err
): ErrorDisclosure<Err> {
  return { status: ERROR, reason };
}
export function isCompletedDisclosure<Value, Err> (
  disclosure: Disclosure<Value, Err>
): disclosure is CompletedDisclosure<Value, Err> {
  return disclosure.status === SUCCESS || disclosure.status === ERROR
}

export class Representative<Value, Err = unknown> {

  private readonly _passive$: BehaviorSubject<Disclosure<Value>>;
  private readonly _value$: Observable<Value>;

  constructor (
    trigger: (
      success: (v: Value) => void,
      error: (e: Err) => void
    ) => void
  ) {
    this._passive$ = new BehaviorSubject<Disclosure<Value>>(
      makeInactiveDisclosure()
    );

    this._value$ = new Observable<Value> (
      subscriber => {
        this._passive$.next(makeBusyDisclosure());
        trigger(
          v => {
            const d = makeSuccessDisclosure(v);
            this._passive$.next(d);
            this._passive$.complete();
            subscriber.next(v);
            subscriber.complete();
          },
          e => {
            const d = makeErrorDisclosure(e);
            this._passive$.next(d);
            this._passive$.complete();
            subscriber.error(e);
          }
        );
      }
    ).pipe(
      shareReplay(1)
    );

  }

  disclose () { return this._passive$.getValue(); }

  get value$ (): Observable<Value> { return this._value$; }

  get disclose$ (): Observable<Disclosure<Value>> { return this._passive$; }

  static fromFunction<Result> (f: () => Result): Representative<Awaited<Result>> {
    return new Representative (
      async (success, error) => {
        try { success(await f()); } catch (e) { error(e); }
      }
    );
  }

  static fromLazyObservable<Value> (lazyObservable: () => Observable<Value>) {
    return new Representative<Value> ( (success, error) => {
      lazyObservable().pipe(
        throwIfEmpty( () => new Error("You cannot construct a Representative from an empty observable") ),
        take(1)
      ).subscribe({ next: success, error });
    } );
  }
  
}

