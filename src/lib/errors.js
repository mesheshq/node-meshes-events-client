/**
 * Meshes Event API Error
 * @extends {Error} - Error class
 * @param {string} message - Error message
 * @param {unknown} data - Additional error data
 * @type {import("../index.js").MeshesApiError} - Meshes API Error
 */
export class MeshesApiError extends Error {
  /**
   * @param {string | undefined} message
   * @param {unknown} [data]
   */
  constructor(message, data) {
    super(message);
    this.name = this.constructor.name;
    if (typeof data !== "undefined") {
      this.data = data;
    }
  }
}

/**
 * Convert error to JSON
 * @param {boolean} stack - Include stack trace
 * @returns {Record<string,any>} - JSON object with error properties
 */
MeshesApiError.prototype.toJSON = function (stack = false) {
  const stackTrace = stack === true ? { stack: this.stack } : {};
  if (typeof this.data === "undefined") {
    return {
      name: this.name,
      message: this.message,
      ...stackTrace,
    };
  } else {
    return {
      name: this.name,
      message: this.message,
      data: this.data,
      ...stackTrace,
    };
  }
};
