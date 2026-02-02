/**
 * Helper to read the response body and parse as a json object; if json parsing fails, fallback to text
 * @param {any} response
 * @return {Promise<unknown | string | null>}
 */
export const readBody = async (response) => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

/**
 * Helper to determine that the value is non empty
 * @param {unknown} v The value to check
 * @returns {boolean} Whether or not the value is non empty
 */
export const isNonEmpty = (v) =>
  v !== null &&
  v !== undefined &&
  v !== "" &&
  !(typeof v === "string" && v.trim().length === 0) &&
  !(Array.isArray(v) && v.length === 0) &&
  !(typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0);
