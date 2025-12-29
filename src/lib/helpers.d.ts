export function readBody(response: {
  text(): Promise<string>;
}): Promise<unknown | string | null>;
