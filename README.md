# Represelect

Represelect is an extension to the Reselect libary for creating lazy memoized selectors from—possibly asynchronous—deterministic functions. We call this new type of selectors “representative selectors” or, shorter, “represelectors”.

- Represelectors aim at extending the concept of selectors to situations where the
  underlying computation is asynchronous or some of its dependencies are asynchronous.
- Like ordinary selectors, represelectors model _deterministic_ functions (projections),
  whose result is determined solely by the arguments. The notion “result” here also applies
  to potential errors. Represelectors are _not_ intended to be used with operations that may
  potentially fail for external reasons, such as network calls.
- When called, a represelector returns a _representative_.
- A representative represents the result of a function call with a particular set of
  arguments. It provides an RxJS stream to subscribe for and observe the result value.
- Representatives are lazy in the sense that the computation is only triggered when
  someone subscribes for the value.
- Represelectors are designed to be memoizing. A represelector will return the same
  (in the sense of identity) representative as long as the arguments do not change.
- Represelectors can be used as dependencies for other represelectors.

The following explanations assume that you are familiar with memoized selectors, the Reselect library, and RxJS streams.

## Motivation: Reselect is inconvenient for asynchronous functions

Suppose you are dealing with states that look as follows

```js
const exampleState = { data: { a: 5, b: 7 }, otherData: { c: 10 } };
```

and you need to do some heavy computation on the data in your state, maybe in a WebWorker. In this example, we
simulate heavy processing time by a timeout:

```js
// asynchronously return the sum of a and b after 500ms
const heavySum = async function(a, b) {
  await new Promise(resolve => setTimeout(resolve, 500));
  return a + b;
};
```

This function is free from side-effects in the sense that the value we will obtain eventually only
depends on the values of its arguments.

From this function, we _can_ create a memoizing selector using Reselect's `createSelector` function:

```js
const selectSumPromise = createSelector(
  state => state.data.a, state => state.data.b,
  heavySum
);
```

As the name indicates, this selector will return a `Promise`. Due to memoization, it will continue to
return the same promise as long as the dependencies do not change:

```js
const sumPromise1 = selectSumPromise({
  data: { a: 5, b: 7 }, otherData: { c: 10 }
});
const sumPromise2 = selectSumPromise({
  data: { a: 5, b: 7 }, otherData: { c: 11 }
});
assert.ok(sumPromise1 === sumPromise2);
```

Thus we indeed have created a memoizing selector from an asynchronous function.
We may, however, find this selector somewhat inconvenient to work with, for several reasons:

_First,_ there is no direct way of retrieving the promised value synchronously in the case the calculation
has already completed. Since a the selector memoizes the result, this is a very likely case if the
dependencies change only infrequently. In the following code snippet, for instance, logging will
_always_ take place asynchronously, no matter whether the promised value is already available or not:

```js
sumPromise1.then(v => console.log(v));
```

_Second,_ there is an asymmetry between selectors created from synchronous versus asynchronous functions:
A selector created from a synchronous function returns a _value_, while a selector created from an
asynchronous function, such as `selectSumPromise`, returns a _promise_.

_Third,_ we cannot easily use such a selector as a dependency. The following, for instance, will not work,
since the dependency delivers a promise, yet the dependent function expects a value:

```js
// wrong
const selectTwiceTheSumPromise = createSelector(
  selectSumPromise,
  x => x * 2
);
```

Represelectors are designed to mitigate these issues.

## Represelectors

### Represelector basics

Represelectors, as well as representatives, are provided by the Represelect library:

```js
import { createRepreselector, Representative } from 'represelect';
```

The following examples assume that some more names have been imported:
```js
import { Representative, INACTIVE, BUSY, SUCCESS, ERROR } from 'represelect';
import assert from 'assert';
```

Creating a represelector is similar to creating a selector:

```js
const represelectSum = createRepreselector(
  state => state.data.a, state => state.data.b,
  heavySum
);
```

When called, a represelector will return a `Representative`:

```js
const sumRepresentative1 = represelectSum({
  data: { a: 5, b: 7 }, otherData: { c: 10 }
});
assert.ok(sumRepresentative1 instanceof Representative);
```

You can think of a representative as being an inspectable, lazy promise. A representative represents the
(potentially still unknown) result of a function call for some given argument values. In the above
example, `sumRepresentative1` stands for the result of calling `heavySum` with parameter `a` being 5 and
parameter `b` being 7.

A represelector will memoize the representative and, as long as the dependencies do not change, return the
same (identical) representative on subsequent calls:

```js
const sumRepresentative2 = represelectSum({
  data: { a: 5, b: 7 }, otherData: { c: 11 }
});
assert.ok(sumRepresentative1 === sumRepresentative2);
```

A representative can be _inspected_ by calling its `disclose` method. The method will return a _disclosure_ object,
whose `status` field takes one of the values `INACTIVE`, `BUSY`, `SUCCESS` or `ERROR`:

* `INACTIVE` indicates that the evaluation has not been initiated yet and, hence, the result is not yet available.
* `BUSY` indicates that the evaluation has been started, yet not completed, and, hence, the result is not yet available.
* `SUCCESS` indicates that the evaluation has completed; the `value` field of the disclosure carries the function result.
* `ERROR` indicates that the evaluation has resulted in an exception; the `error` field of the disclosure carries the exception.

The above call to `represelectSum`, for instance, will return a representative whose status 
is `INACTIVE`:

```js
assert.deepStrictEqual(sumRepresentative1.disclose(), { status: INACTIVE });
```

A representative is _lazy_ in the sense that neither its creation nor a call to `disclose` will trigger the evaluation of the
underlying function. As a consequence, none of the above code actually triggers the evaluation of `heavySum`.

For triggering evaluation and observing the result, the representative provides an RxJS stream through its `value$`
property. If necessary, i.e. if the representative is still inactive, subscribing to `value$` will move the representative
out of its inactive state and trigger the execution of the underlying function:

```js
// logging will take place as soon as the result is available
sumRepresentative1.value$.subscribe({ next(v) { console.log(v); } });
```

You can subscribe to `value$` as often as you like. Note that the result value will be emitted _synchronously_ if it is
readily available, i.e. if a call to `disclose` would result in a `BUSY` (or `ERROR`) status, which means that the execution
of the function has already completed at the time of subscription.

### Represelectors from synchronous functions

Represelectors can be created from synchronous functions as well:

```js
const lightSum = (a, b) => a + b;
const represelectLightSum = createRepreselector(
  state => state.data.a, state => state.data.b,
  lightSum
);
```

The behaviour in the synchronous case will be almost identical to the asynchronous case.
As long as all dependencies are synchronous, however, subscription to
`value$` will _always_ result in a synchronous emission of the function result:

```js
const lightSumRepresentative = represelectLightSum({
  data: { a: 5, b: 7 }, otherData: { c: 10 }
});
assert.deepStrictEqual(
  lightSumRepresentative.disclose(),
  { status: INACTIVE }
);

// logging will always take place synchronously, since lightSum is a synchronous function
//   and all dependencies are synchronous
lightSumRepresentative.value$.subscribe({ next(v) { console.log(v); } });
```

### Represelectors as dependencies

Represelectors (as well as ordinary selectors) can serve as dependencies to other represelectors:

```js
// ok
const represelectTwiceTheSum = createRepreselector(represelectSum, x => x * 2);
```

You can use such represelectors like any other represelector:

```js
const twiceTheSumRepresentative = represelectTwiceTheSum({
  data: { a: 5, b: 7 }, otherData: { c: 10}
});
twiceTheSumRepresentative.value$.subscribe({ next(v) { console.log(v); } });
```

## Memoization

A represelector does memoization on three levels; the first two of these are similar to Reselect's selectors,
the third one is special to represelectors. For the following examples, in order to be able to observe what is happening,
we log the function
calls to the console and make all selector functions synchronous:

```js
function setupMemoizationExample() {
  const represelectSum = createRepreselector(
    state => {
      console.log(`Getting state.data.a = ${state.data.a}.`);
      return state.data.a;
    },
    state => {
      console.log(`Getting state.data.b = ${state.data.b}.`);
      return state.data.b;
    },
    (a, b) => {
      console.log(`Adding a = ${a} and b = ${b}.`);
      return a + b;
    }
  );

  const represelectTwiceTheSum = createRepreselector(
    represelectSum,
    x => {
      console.log(`Doubling ${x}.`);
      return x * 2;
    }
  );

  const consoleLogger = { next(v) { console.log(`Observed value ${v}.`); } };

  return { represelectSum, represelectTwiceTheSum, consoleLogger };
}
```

As said, memoization is done on three levels:

* On the selector argument level. If the represelector is called repeatedly with exactly the same arguments, it does not
  evaluate the dependencies again and delivers the memoized result representative.

  ```js
  const { represelectSum, represelectTwiceTheSum, consoleLogger } =
    setupMemoizationExample();

  const exampleState = { data: { a: 5, b: 7 }, otherData: { c: 10} };

  // for definition of represelectSum and exampleState, see above
  const r1 = represelectSum(exampleState);
  // Output:
  // Getting state.data.a = 5.
  // Getting state.data.b = 7.

  r1.value$.subscribe(consoleLogger);
  // Output:
  // Adding a = 5 and b = 7.
  // Observed value 12.

  // Neither the dependencies nor the selector functions will be evaluated
  //   again.
  // The represelector will just return the memoized result representative.
  const r2 = represelectSum(exampleState);
  // No output.

  r2.value$.subscribe(consoleLogger);
  // Output:
  // Observed value 12.

  assert.ok(r1 === r2);
  ```

* On the selector function argument level. If, after evaluation of the dependencies, the arguments to the selector
  function have not changed, the represelector will again return the memoized representative:

  ```js
  const { represelectSum, represelectTwiceTheSum, consoleLogger } =
    setupMemoizationExample();

  const r1 = represelectSum({ data: { a: 5, b: 7 }, otherData: { c: 10} });
  // Output:
  // Getting state.data.a = 5.
  // Getting state.data.b = 7.

  r1.value$.subscribe(consoleLogger);
  // Output:
  // Adding a = 5 and b = 7.
  // Observed value 12.

  // The dependencies will be evaluated, because the argument to the selector
  //   is not identical, yet since the values of a and b have not changed,
  //   the memoized result representative will be returned. As a consequence,
  //   the sum will not be calculated again.
  const r2 = represelectSum({ data: { a: 5, b: 7 }, otherData: { c: 11} });
  // Output:
  // Getting state.data.a = 5.
  // Getting state.data.b = 7.

  r2.value$.subscribe(consoleLogger);
  // Output:
  // Observed value 12.

  assert.ok(r1 === r2);
  ```

* On the inner (argument value) level. This level of memoization is special to represelectors; although always
  taking place, it is only relevant if some of the dependencies yield representatives (i.e. are represelectors
  themselves).

  ```js
  const { represelectSum, represelectTwiceTheSum, consoleLogger } = setupMemoizationExample();

  const r1 = represelectTwiceTheSum({ data: { a: 5, b: 7 }, otherData: { c: 10} });
  // Output:
  // Getting state.data.a = 5.
  // Getting state.data.b = 7.

  // On subscription to value$, both the sum of a and b as well as the
  //   doubling will take place.
  r1.value$.subscribe(consoleLogger);
  // Output:
  // Adding a = 5 and b = 7.
  // Doubling x = 12.
  // Observed value 24.

  // r2 will be distinct from r1, since the dependencies have changed.
  const r2 = represelectTwiceTheSum({ data: { a: 6, b: 6 }, otherData: { c: 10} });
  // Output:
  // Getting state.data.a = 6.
  // Getting state.data.b = 6.

  assert.ok(r1 !== r2);

  // On subscription to value$, the sum will be calculated again, but since
  //   its value is the same as before, doubling will not take place again.
  r2.value$.subscribe(consoleLogger);
  // Output:
  // Adding a = 6 and b = 6.
  // Observed value 24.
  ```



