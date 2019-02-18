// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
import {channel, IModulePatcher, PatchFunction} from "diagnostic-channel";

export interface IMongoData {
    startedData: {
        databaseName?: string;
        command?: any;
    };
    event: {
        commandName?: string;
        duration?: number;
        failure?: string;
        reply?: any;
    };
    succeeded: boolean;
}

const mongodbPatchFunction: PatchFunction = function(originalMongo) {
    const listener = originalMongo.instrument({
        operationIdGenerator: {
            next: function() {
                return channel.bindToContext((cb) => cb());
            },
        },
    });
    const eventMap = {};
    listener.on("started", function(event) {
        if (eventMap[event.requestId]) {
            // Note: Mongo can generate 2 completely separate requests
            // which share the same requestId, if a certain race condition is triggered.
            // For now, we accept that this can happen and potentially miss or mislabel some events.
            return;
        }
        eventMap[event.requestId] = event;
    });

    listener.on("succeeded", function(event) {
        const startedData = eventMap[event.requestId];
        if (startedData) {
            delete eventMap[event.requestId];
        }
        event.operationId(() => channel.publish<IMongoData>("mongodb", {startedData, event, succeeded: true}));
    });

    listener.on("failed", function(event) {
        const startedData = eventMap[event.requestId];
        if (startedData) {
            delete eventMap[event.requestId];
        }
        event.operationId(() => channel.publish<IMongoData>("mongodb", {startedData, event, succeeded: false}));
    });

    return originalMongo;
};

const mongodb3PatchFunction: PatchFunction = function(originalMongo) {
    const listener = originalMongo.instrument();
    const eventMap = {};
    const contextMap = {};
    listener.on("started", function(event) {
        if (eventMap[event.requestId]) {
            // Note: Mongo can generate 2 completely separate requests
            // which share the same requestId, if a certain race condition is triggered.
            // For now, we accept that this can happen and potentially miss or mislabel some events.
            return;
        }
        contextMap[event.requestId] = channel.bindToContext((cb) => cb());
        eventMap[event.requestId] = event;
    });

    listener.on("succeeded", function(event) {
        const startedData = eventMap[event.requestId];
        if (startedData) {
            delete eventMap[event.requestId];
        }

        if (typeof event === "object" && typeof contextMap[event.requestId] === "function") {
            contextMap[event.requestId](() => channel.publish<IMongoData>("mongodb", {startedData, event, succeeded: true}));
            delete contextMap[event.requestId];
        }
    });

    listener.on("failed", function(event) {
        const startedData = eventMap[event.requestId];
        if (startedData) {
            delete eventMap[event.requestId];
        }

        if (typeof event === "object" && typeof contextMap[event.requestId] === "function") {
            contextMap[event.requestId](() => channel.publish<IMongoData>("mongodb", {startedData, event, succeeded: false}));
            delete contextMap[event.requestId];
        }
    });

    return originalMongo;
};

export const mongo2: IModulePatcher = {
    versionSpecifier: ">= 2.0.0 <= 3.0.5",
    patch: mongodbPatchFunction,
};
export const mongo3: IModulePatcher = {
    versionSpecifier: "> 3.0.5 < 4.0.0",
    patch: mongodb3PatchFunction,
};

export function enable() {
    channel.registerMonkeyPatch("mongodb", mongo2);
    channel.registerMonkeyPatch("mongodb", mongo3);
}
