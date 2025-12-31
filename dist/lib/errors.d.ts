/**
 * Meshes Event API Error
 * @extends {Error} - Error class
 * @param {string} message - Error message
 * @param {unknown} data - Additional error data
 * @class - Meshes API Error
 */
export class MeshesApiError extends Error {
    /**
     * @param {string | undefined} message
     * @param {unknown} [data]
     */
    constructor(message: string | undefined, data?: unknown);
    data: unknown;
    /**
     * Convert error to JSON
     * @param {boolean} stack - Include stack trace
     * @returns {Record<string,any>} - JSON object with error properties
     */
    toJSON(stack?: boolean): Record<string, any>;
}
