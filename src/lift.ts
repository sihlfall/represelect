import { Representative } from './representative';
import { defaultMemoize } from 'reselect';
import { defaultIfEmpty, forkJoin, Observable, of, shareReplay, switchMap } from "rxjs";

function isThenable(x: any): x is { then: () => void } {
  return (typeof x === 'object' || typeof x === 'function') && typeof x["then"] === 'function';
}

export function firstStageLift<
  Args extends readonly any[], Result
> (
  f: (...args: Args) => Result
): (...s: Args) => Observable<Awaited<Result>> {
  return (...s: Args) => new Observable<Awaited<Result>>(
    subscriber => {
      try {
        const r = f(...s);
        if (isThenable(r)) {
          (async function () {
            try {
              // @ts-ignore
              subscriber.next(await r);
              subscriber.complete();
            } catch (e) {
              subscriber.error(e);
            }
          }) ();
        } else {
          subscriber.next(r as Awaited<Result>);
          subscriber.complete();
        }
      } catch (e) {
        subscriber.error(e);
      }
    }
  ).pipe(
    shareReplay(1)
  );
}

export function secondStageLift<
  Args extends readonly unknown[], Result
> (
  f: (...args: Args) => Observable<Result>
): (...args: PossiblyRepresentatives<Args> ) => Representative<Result> {
  return (...args: PossiblyRepresentatives<Args> ) => Representative.fromLazyObservable(
    () => (forkJoin(
      args.map( arg => arg instanceof Representative ? arg.value$ : of(arg) )
    ) as Observable<[...Args]>).pipe(
      defaultIfEmpty([] as unknown as [...Args]),
      switchMap( values => f.apply(null, values) )
    )
  );
}

export function lift<
  Args extends readonly unknown[],
  Result,
  InnerMemoizeOptions extends unknown[]
> (
  f: (...args: Args) => Result,
  memoize: <G extends (...args: any[]) => any> (func: G, ...options: any[]) => G = defaultMemoize,
  innerMemoizeOptions?: InnerMemoizeOptions
): (...args: PossiblyRepresentatives<Args> ) => Representative<Awaited<Result>> {
  const memoizedf = memoize(firstStageLift(f), innerMemoizeOptions);
  return secondStageLift(memoizedf);
}

export type PossiblyRepresentatives<P extends readonly any[]> = {
  [index in keyof P]: P[index] extends P[number] ? P[index] | Representative<P[index]> : never
};
