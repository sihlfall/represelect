import { ReplaySubject, Observable, shareReplay, take, throwIfEmpty } from "rxjs";
import * as Disclosure from './disclosure';

export class Representative<Value> {

  private readonly _passive$: ReplaySubject<Disclosure.Unspecified<Value>>;
  private readonly _value$: Observable<Value>;
  private _disclose: Disclosure.Unspecified<Value>;

  constructor (
    trigger: (
      success: (v: Value) => void,
      error: (e: unknown) => void
    ) => void
  ) {
    const _disclose = Disclosure.inactive();
    this._disclose = _disclose;

    const _passive$ = new ReplaySubject<Disclosure.Unspecified<Value>>(1);
    _passive$.next(_disclose);
    this._passive$ = _passive$;

    this._value$ = new Observable<Value> (
      subscriber => {
        const PENDING = 
        this._disclose = Disclosure.pending();
        this._passive$.next(PENDING);
        trigger(
          v => {
            const d = Disclosure.success(v);
            this._disclose = d;
            this._passive$.next(d);
            this._passive$.complete();
            subscriber.next(v);
            subscriber.complete();
          },
          e => {
            const d = Disclosure.failure(e);
            this._disclose = d;
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

  disclose () { return this._disclose; }

  get value$ (): Observable<Value> { return this._value$; }

  get disclose$ (): Observable<Disclosure.Unspecified<Value>> { return this._passive$; }

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

