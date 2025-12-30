/**
 * Typescript type definitions for Meshes Events API
 * @module meshes-events-client
 * @license MIT
 * @since 1.0.0
 * @description Meshes events client for emitting events with a publishable key.
 * @repository https://github.com/mesheshq/node-meshes-events-client
 */
/**
 * Callback function to use rather than promises
 */
export type CallbackFunction = (err: any, data?: any) => void;
/**
 * Request headers
 */
export type Headers = {
    [key: string]: string;
};
/**
 * Query parameters
 */
export type QueryParams = {
    [key: string]: string | number | boolean;
};
/**
 * Meshes API Config Options
 */
export type MeshesOptions = {
    /**
     * API version
     */
    version: "v1";
    /**
     * Request timeout in milliseconds
     * @constraint [1000-30000]
     */
    timeout: number;
    /**
     * Additional request headers
     */
    headers: Headers;
    /**
     * If true, will enable debug mode.
     */
    debug?: boolean;
    /**
     * API Base Url.  This is optional and can be useful for testing.
     * @default "https://api.meshes.io/api/v1"
     */
    apiBaseUrl?: string;
};
/**
 * Meshes API Optional Request Options
 */
export type MeshesOptionalRequestOptions = {
    /**
     * Request headers
     */
    headers?: Headers;
    /**
     * Query parameters
     */
    query?: QueryParams;
    /**
     * Request timeout in milliseconds
     */
    timeout?: number;
};
/**
 * Meshes event payload structure.
 */
export type MeshesEventPayload = {
    /**
     * The payload email.  This is required.
     */
    email: string;
    first_name?: string | undefined;
    id?: string | undefined;
    ip_address?: string | undefined;
    last_name?: string | undefined;
    name?: string | undefined;
    phone?: string | undefined;
    resource_url?: string | undefined;
} & {
    [k: string]: unknown;
};
/**
 * Meshes event structure.
 */
export type MeshesEventBody = {
    /**
     * The event type for the event.
     */
    event: string;
    /**
     * The custom resource.  Defaults to 'global'.
     */
    resource?: string | undefined;
    /**
     * The resource ID for a custom resource.
     */
    resource_id?: string | undefined;
    /**
     * The event payload that will be used.
     */
    payload: MeshesEventPayload;
};
/**
 * Meshes Events API Client
 * @class
 * @property {Function} emit - Create (emit) a single event
 * @property {Function} emitBatch - Create (emit) multiple events up to 100 at a time
 */
export type MeshesEventsClient = {
    /**
     * Create (emit) a single event
     * @param {MeshesEventBody} event - The event to emit
     * @param {MeshesOptionalRequestOptions} options - Optional request options
     * @param {CallbackFunction} done - Optional callback function
     * @returns {Promise<any> | undefined} - Request promise or undefined if a callback is provided
     */
    emit(event: MeshesEventBody, options?: MeshesOptionalRequestOptions, done?: CallbackFunction): Promise<any> | undefined;
    /**
     * Create (emit) multiple events up to 100 at a time
     * @param {MeshesEventBody[]} events - The events to emit
     * @param {MeshesOptionalRequestOptions} options - Optional request options
     * @param {CallbackFunction} done - Optional callback function
     * @returns {Promise<any> | undefined} - Request promise or undefined if a callback is provided
     */
    emitBatch(events: MeshesEventBody[], options?: MeshesOptionalRequestOptions, done?: CallbackFunction): Promise<any> | undefined;
};
/**
 * Meshes API Error
 */
export type MeshesApiError = {
    name: string;
    message: string;
    data?: any;
    stack?: any;
};
