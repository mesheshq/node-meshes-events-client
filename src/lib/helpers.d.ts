export function readBody(response: {
  text(): Promise<string>;
}): Promise<unknown | string | null>;

export function isNonEmpty(value: unknown): boolean;
