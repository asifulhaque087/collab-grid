// Go-style error handling: await a promise and get back a `[data, error]`
// tuple instead of throwing. The error branch is checked explicitly by the
// caller, which keeps async control flow flat and avoids scattered try/catch.
export type TryItResult<T, E> = [T, null] | [null, E];

export const tryit = async <T, E = Error>(promise: Promise<T>): Promise<TryItResult<T, E>> => {
  try {
    const data = await promise;
    return [data, null];
  } catch (error) {
    return [null, error as E];
  }
};
