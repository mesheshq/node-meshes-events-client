/**
 * Helper to read the response body and parse as a json object; if json parsing fails, fallback to text
 * @param {any} response
 * @return {}
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
