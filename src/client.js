"use strict";

/**
 * JavaScript Meshes Events Client
 * @module node-meshes-events-client
 * @license MIT
 * @since 1.0.0
 * @description Meshes events client for emitting events with a publishable key.
 * @repository https://github.com/mesheshq/node-meshes-events-client
 */

import { MeshesApiError } from "./lib/errors.js";
import { readBody } from "./lib/helpers.js";

const MESHES_PUBLISHABLE_KEY_REGEX =
  /^mesh_pub_([A-Za-z0-9\-.]+)_([A-Za-z0-9\-.]+)_([^_]+)$/;

const MAX_TIMEOUT_MS = 30000;

const forbiddenHeaders = new Set([
  "x-meshes-publishable-key",
  "x-meshes-client",
  "content-type",
  "accept",
]);

/**
 * Valid HTTP methods
 * @type {string[]}
 * @constant
 */
const validMethods = ["POST"];

/**
 * Meshes API Options
 * @type {import("./index").MeshesOptions}
 * @constant
 */
const defaultOptions = {
  version: "v1",
  timeout: 5000,
  debug: false,
};

/**
 * Meshes API Client
 * @type {import("./index").MeshesEventsClient}
 * @class
 */
export class MeshesEventsClient {
  #publishableKey;
  #options;
  #apiBaseUrl;
  #apiHeaders;
  #apiTimeout;
  #debug;

  /**
   * Create the Meshes API Client.
   * @param {string} publishableKey - Meshes publishable key
   * @param {import("./index").MeshesOptions} options - Additional options
   * @constructor - Meshes API constructor
   */
  constructor(publishableKey, options = {}) {
    const regex = {
      publishableKey: MESHES_PUBLISHABLE_KEY_REGEX,
    };
    if (
      typeof publishableKey !== "string" ||
      !regex.publishableKey.test(publishableKey)
    ) {
      throw new MeshesApiError(
        `Missing or invalid publishable key: ${publishableKey}`
      );
    }

    if (!options || typeof options !== "object") {
      throw new MeshesApiError(
        `Invalid options object: ${typeof options}`,
        options
      );
    }
    options = { ...defaultOptions, ...options };

    if (typeof options.version !== "string") {
      throw new MeshesApiError(`Invalid API version: ${options.version}`);
    } else if (options.version !== "v1") {
      throw new MeshesApiError(`Unsupported API version: ${options.version}`);
    }
    if (typeof options.timeout !== "undefined") {
      if (typeof options.timeout !== "number") {
        throw new MeshesApiError(`Invalid request timeout: ${options.timeout}`);
      } else if (options.timeout < 1000 || options.timeout > MAX_TIMEOUT_MS) {
        throw new MeshesApiError(
          `Unsupported request timeout: ${options.timeout}`
        );
      }
    }

    if (typeof options.headers !== "undefined") {
      if (
        !options.headers ||
        typeof options.headers !== "object" ||
        Array.isArray(options.headers)
      ) {
        throw new MeshesApiError(
          `Invalid additional request headers: ${typeof options.headers}`,
          options.headers
        );
      }
      for (const [k, v] of Object.entries(options.headers)) {
        if (typeof v !== "string") {
          throw new MeshesApiError(
            `Invalid request header value for ${k}: ${typeof v}`,
            options.headers
          );
        }
        if (forbiddenHeaders.has(k.toLowerCase())) {
          throw new MeshesApiError(`Header not allowed: ${k}`, options.headers);
        }
      }
    }

    this.#options = options;
    this.#publishableKey = publishableKey;
    this.#apiBaseUrl =
      options.apiBaseUrl ?? `https://api.meshes.io/api/${options.version}`;
    this.#apiHeaders = {
      ...this.#cleanHeaders(options.headers),
      "X-Meshes-Client": "Meshes Events Client v1.0.0",
      "Content-Type": "application/json",
      "Accept": "application/json",
    };
    this.#apiTimeout = options.timeout;
    this.#debug = options.debug === true;
  }

  /**
   * Log debug messages
   * @param {string} message - Debug message
   * @returns {void}
   */
  #log() {
    if (this.#debug) {
      console.debug(...arguments);
    }
  }

  /**
   * Log error messages
   * @param {string} message - Debug message
   * @returns {void}
   */
  #error() {
    if (this.#debug) {
      console.error(...arguments);
    }
  }

  /**
   * Add the publishable key to all outgoing API requests
   * @param {import("./index").MeshesEventsClient} blxClient
   * @param {HttpRequest} request
   * @returns {HttpRequest}
   * @throws {MeshesApiError} - No Authentication Data
   */
  #includeApiPublishableKey(request) {
    if (this.#publishableKey) {
      request.headers["X-Meshes-Publishable-Key"] = this.#publishableKey;
    } else {
      throw new MeshesApiError("No Publishable Key Data");
    }
    return request;
  }

  /**
   * Validate the event object
   * @param {import("./index").MeshesEventBody} event
   */
  #validateEvent(event) {
    if (!event || typeof event !== "object") {
      throw new MeshesApiError("Invalid event: must be an object", event);
    }
    if (typeof event.event !== "string" || !event.event.trim()) {
      throw new MeshesApiError("Invalid event: missing 'event' string", event);
    }
    if (!event.payload || typeof event.payload !== "object") {
      throw new MeshesApiError(
        "Invalid event: missing 'payload' object",
        event
      );
    }
    if (
      typeof event.payload.email !== "string" ||
      !event.payload.email.trim()
    ) {
      throw new MeshesApiError("Invalid event: missing payload.email", event);
    }
  }

  /**
   * Clean the input headers
   * @param {import("./index").Headers} headers - Request headers
   * @returns {import("./index").Headers} - Cleaned headers
   */
  #cleanHeaders(headers) {
    if (!headers || typeof headers !== "object") return {};

    const cleanHeaders = {};
    for (const [key, value] of Object.entries(headers)) {
      if (typeof key !== "string" || typeof value !== "string") {
        this.#log("Invalid Header", key, value);
        continue;
      }

      const k = key.trim();
      const v = value.trim();
      if (!k || !v) {
        continue;
      }
      if (forbiddenHeaders.has(k.toLowerCase())) {
        continue;
      }
      cleanHeaders[k] = v;
    }
    return cleanHeaders;
  }

  /**
   * Make an API request
   * @param {import("./index").MeshesRequestOptions} options - Request options
   * @param {Function | undefined} done - Callback function
   * @returns {Promise<any> | undefined} - Request promise or undefined if a callback is provided
   * @throws {MeshesApiError} - Invalid request
   */
  #request(options, done) {
    this.#log("Request Options", options, done ? "Callback" : "Promise");

    // AbortController was added in node v14.17.0 globally; if not available, don't support timeouts
    const AbortController = globalThis.AbortController ?? undefined;
    const controller = AbortController ? new AbortController() : undefined;
    const effectiveTimeout =
      typeof options?.timeout === "number" ? options.timeout : this.#apiTimeout;
    const timeout = AbortController
      ? setTimeout(() => controller?.abort(), effectiveTimeout)
      : undefined;
    if (controller === undefined) {
      this.#log("AbortController", "Not Supported; Timeouts won't be enforced");
    }

    const requestPromise = new Promise((resolve, reject) => {
      if (typeof options !== "object") {
        this.#log("Invalid Request Options", options);
        throw new MeshesApiError("Invalid request options", options);
      }
      const method = options?.method?.toUpperCase();
      if (!method || typeof method !== "string") {
        this.#log("Invalid Request Method", options);
        throw new MeshesApiError("Invalid request method", options);
      } else if (!validMethods.includes(method)) {
        this.#log("Invalid Request Method Option", options);
        throw new MeshesApiError("Unsupported request method", options);
      }

      if (
        !options?.path ||
        typeof options.path !== "string" ||
        options.path.trim().length === 0 ||
        options.path.trim() === "/"
      ) {
        this.#log("Invalid Request Path", options);
        throw new MeshesApiError("Invalid request path", options);
      }

      if (typeof options?.timeout !== "undefined") {
        if (typeof options.timeout !== "number") {
          this.#log("Invalid Request Timeout", options);
          throw new MeshesApiError("Invalid request timeout", options);
        }
        if (options.timeout < 1000 || options.timeout > MAX_TIMEOUT_MS) {
          this.#log("Unsupported Request Timeout", options);
          throw new MeshesApiError("Unsupported request timeout", options);
        }
      }

      if (typeof options.query !== "undefined") {
        if (
          !options.query ||
          typeof options.query !== "object" ||
          Array.isArray(options.query)
        ) {
          this.#log("Invalid Request Query Params", options);
          throw new MeshesApiError("Invalid request query params", options);
        }
      }

      try {
        const queryString = options.query
          ? `?${new URLSearchParams(options.query).toString()}`
          : "";

        const requestOptions = this.#includeApiPublishableKey({
          method: method,
          headers: {
            ...this.#cleanHeaders(options.headers),
            ...this.#apiHeaders,
          },
          body: options.body
            ? typeof options.body === "string"
              ? options.body
              : JSON.stringify(options.body)
            : null,
          signal: controller?.signal,
        });

        const requestPath =
          options.path.charAt(0) !== "/" ? `/${options.path}` : options.path;

        this.#log("Fetch Options", {
          method: requestOptions.method,
          path: requestPath,
          query: queryString,
        });
        return fetch(
          `${this.#apiBaseUrl}${requestPath}${queryString}`,
          requestOptions
        )
          .then((response) => {
            if (response.ok) {
              readBody(response)
                .then((data) => {
                  this.#log("Response Success");
                  resolve(data);
                })
                .catch((err) => {
                  this.#error("Response Parsing Error", err);
                  reject(
                    new MeshesApiError("Error parsing response data", err)
                  );
                });
            } else {
              readBody(response)
                .then((data) => {
                  this.#log("Response Error", data);
                  reject(
                    new MeshesApiError("Meshes API request failed", {
                      status: response.status,
                      statusText: response.statusText,
                      data,
                    })
                  );
                })
                .catch((err) => {
                  this.#error("Response Parsing Failure", err);
                  reject(
                    new MeshesApiError("Error parsing request failure", {
                      status: response.status,
                      statusText: response.statusText,
                      error: err,
                    })
                  );
                });
            }
          })
          .catch((err) => {
            this.#error("Request Failure", err);
            reject(new MeshesApiError("Request Failure", err));
          });
      } catch (err) {
        this.#error("Unexpected Error", err);
        reject(new MeshesApiError("Unexpected Error", err));
        throw err;
      }
    })
      .then((result) => {
        this.#log("Promise Success", result);

        if (done) {
          this.#log("Promise Success", "Callback Success");
          done(null, result);
        }

        return result;
      })
      .catch((err) => {
        this.#log("Promise Error", err);

        if (done) {
          this.#log("Promise Error", "Callback Error");
          done(err);
        }

        throw err;
      })
      .finally(() => {
        if (timeout) {
          clearTimeout(timeout);
        }
      });

    if (done) {
      return undefined;
    }
    this.#log("Promise Returned", "No callback");
    return requestPromise;
  }

  /**
   * Create (emit) a single event
   * @param {import("./index").MeshesEventBody} event - The event to emit
   * @param {import("./index").MeshesOptionalRequestOptions} event - Request options
   * @param {import("./index").CallbackFunction | undefined} done - Callback function
   * @returns {Promise<any> | undefined} - Request promise or undefined if a callback is provided
   * @throws {MeshesApiError} - Invalid request
   */
  emit(event, options = {}, done = undefined) {
    this.#validateEvent(event);
    return this.#request(
      {
        ...this.#options,
        ...options,
        path: "/events",
        method: "POST",
        body: event,
      },
      done
    );
  }

  /**
   * API POST request
   * @param {import("./index").MeshesEventBody[]} events - The events to emit
   * @param {import("./index").MeshesOptionalRequestOptions} options - Request options
   * @param {import("./index").CallbackFunction | undefined} done - Callback function
   * @returns {Promise<any> | undefined} - Request promise or undefined if a callback is provided
   * @throws {MeshesApiError} - Invalid request
   */
  emitBatch(events, options = {}, done = undefined) {
    if (!Array.isArray(events)) {
      throw new MeshesApiError("Events must be an array", events);
    }
    if (events.length === 0) {
      throw new MeshesApiError("Events array cannot be empty");
    }
    if (events.length > 100) {
      throw new MeshesApiError(
        "Bulk emit supports up to 100 events per request",
        {
          count: events.length,
        }
      );
    }
    for (const evt of events) {
      this.#validateEvent(evt);
    }
    return this.#request(
      {
        ...this.#options,
        ...options,
        path: "/events/bulk",
        method: "POST",
        body: events,
      },
      done
    );
  }
}

export default MeshesEventsClient;

export { MeshesApiError };
