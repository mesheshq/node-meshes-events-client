/**
 * Meshes API Client
 * @class
 */
export class MeshesEventsClient {
    /**
     * Create the Meshes API Client.
     * @param {string} publishableKey - Meshes publishable key
     * @param {MeshesOptions} options - Additional options
     * @constructor - Meshes API constructor
     */
    constructor(publishableKey: string, options?: MeshesOptions);
    /**
     * Create (emit) a single event
     * @param {MeshesEventBody} event - The event to emit
     * @param {MeshesOptionalRequestOptions} event - Request options
     * @param {CallbackFunctionSingle | undefined} done - Callback function
     * @returns {Promise<CreateEventResponseSingle> | undefined} - Request promise or undefined if a callback is provided
     * @throws {MeshesApiError} - Invalid request
     */
    emit(event: MeshesEventBody, options?: {}, done?: CallbackFunctionSingle | undefined): Promise<CreateEventResponseSingle> | undefined;
    /**
     * Create (emit) multiple events up to 100 at a time
     * @param {MeshesEventBody[]} events - The events to emit
     * @param {MeshesOptionalRequestOptions} options - Request options
     * @param {CallbackFunctionBulk | undefined} done - Callback function
     * @returns {Promise<BulkCreateEventsResult> | undefined} - Request promise or undefined if a callback is provided
     * @throws {MeshesApiError} - Invalid request
     */
    emitBatch(events: MeshesEventBody[], options?: MeshesOptionalRequestOptions, done?: CallbackFunctionBulk | undefined): Promise<BulkCreateEventsResult> | undefined;
    #private;
}
export default MeshesEventsClient;
export { MeshesApiError };
export type Headers = import("./index.js").Headers;
export type MeshesOptions = import("./index.js").MeshesOptions;
export type MeshesRequestOptions = import("./index.js").MeshesRequestOptions;
export type MeshesOptionalRequestOptions = import("./index.js").MeshesOptionalRequestOptions;
export type MeshesEventBody = import("./index.js").MeshesEventBody;
export type CreateEventResponseSingle = import("./index.js").CreateEventResponseSingle;
export type BulkCreateEventsResult = import("./index.js").BulkCreateEventsResult;
export type CallbackFunctionSingle = import("./index.js").CallbackFunction<CreateEventResponseSingle>;
export type CallbackFunctionBulk = import("./index.js").CallbackFunction<BulkCreateEventsResult>;
export type CallbackAny = import("./index.js").CallbackFunction<any>;
export type MeshesRequestInit = {
    method: string;
    headers: Headers;
    body: string | null;
    signal?: AbortSignal;
};
import { MeshesApiError } from "./lib/errors.js";
