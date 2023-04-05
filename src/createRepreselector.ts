import { createSelector, CreateSelectorFunction, defaultMemoize } from "reselect";
import type { GetParamsFromSelectors, OutputSelector, SelectorArray, SelectorResultArray } from "reselect";
import { lift } from "./lift";
import { Representative } from "./representative";
import { Expand } from "reselect/es/types";

export type Represented<T> = T extends Representative<infer S> ? S : T;
export type Representeds<P> = [ P ] extends unknown ?
    {
      [index in keyof P]: P[index] extends unknown ? Represented<P[index]> : never
    }
  : never;

export type RepresentedResult<F> = F extends (...args: [infer Args]) => Representative<infer Result> ?
    (...args: [Args]) => Result
  :
    F;
export type RepresentedResults<P> = [ P ] extends unknown ?
    {
      [index in keyof P]: P[index] extends unknown ? RepresentedResult<P[index]> : never
    }
  : never;


export type UnknownFunction = (...args: unknown[]) => unknown;

export function createRepreselectorCreator<
/** Selectors will eventually accept some function to be memoized */
  F extends (...args: unknown[]) => unknown,  /** A memoizer such as defaultMemoize that accepts a function + some possible options */
  MemoizeFunction extends (func: F, ...options: any[]) => F,
  /** The additional options arguments to the memoizer */
  MemoizeOptions extends unknown[],
  /** The additional options arguments to the memoizer */
  InnerMemoizeOptions extends unknown[],
  Keys = Expand<Pick<ReturnType<MemoizeFunction>,keyof ReturnType<MemoizeFunction>>>
>(
  createSelector: CreateSelectorFunction<
    F,
    MemoizeFunction,
    MemoizeOptions,
    Keys
  >,
  innerMemoize: <G extends UnknownFunction> (func: G, ...options: any[]) => G = defaultMemoize,
  innerMemoizeOptions?: InnerMemoizeOptions
) {
  const createRepreselector = (...funcs: Function[]) => {
    const lastIdx = funcs.length - 1;
    funcs[lastIdx] = lift(funcs[lastIdx] as UnknownFunction, innerMemoize, innerMemoizeOptions);
    // @ts-ignore
    return createSelector.apply(null, funcs);  
  }
  return createRepreselector as unknown as CreateRepreSelectorFunction<MemoizeOptions, InnerMemoizeOptions>;
}

export interface CreateSelectorOptions<MemoizeOptions extends unknown[]> {
  memoizeOptions: MemoizeOptions[0] | MemoizeOptions
}

/**
 * An instance of createRepreselector, customized with a given outer selector
 * and a given inner memoize implementation
 */
export interface CreateRepreSelectorFunction<
  MemoizeOptions extends unknown[] = [],
  InnerMemoizeOptions extends unknown[] = []
> {
  /** Input selectors as separate inline arguments */
  <Selectors extends SelectorArray, Result>(
    ...items: [
      ...Selectors,
      (...args: SelectorResultArray<RepresentedResults<Selectors>>) => Result
    ]
  ): OutputSelector<
    Selectors,
    Representative<Awaited<Result>>,
    (...args: SelectorResultArray<RepresentedResults<Selectors>>) => Representative<Result>,
    GetParamsFromSelectors<RepresentedResults<Selectors>>
  >;

  /** Input selectors as separate inline arguments with memoizeOptions passed */
  <Selectors extends SelectorArray, Result>(
    ...items: [
      ...Selectors,
      (...args: SelectorResultArray<RepresentedResults<Selectors>>) => Result,
      CreateSelectorOptions<MemoizeOptions>
    ]
  ): OutputSelector<
    Selectors,
    Representative<Awaited<Result>>,
    (...args: SelectorResultArray<RepresentedResults<Selectors>>) => Representative<Result>,
    GetParamsFromSelectors<RepresentedResults<Selectors>>
  >;

  /** Input selectors as a separate array */
  <Selectors extends SelectorArray, Result>(
    selectors: [...Selectors],
    combiner: (...args: SelectorResultArray<RepresentedResults<Selectors>>) => Result,
    options?: CreateSelectorOptions<MemoizeOptions>,
    innerOptions?: CreateSelectorOptions<InnerMemoizeOptions>
  ): OutputSelector<
    Selectors,
    Representative<Awaited<Result>>,
    (...args: SelectorResultArray<RepresentedResults<Selectors>>) => Representative<Result>,
    GetParamsFromSelectors<RepresentedResults<Selectors>>
  >;
}

export const createRepreselector = createRepreselectorCreator(createSelector, defaultMemoize);