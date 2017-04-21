// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
import {PatchFunction} from "diagnostic-source";

import * as assert from "assert";
import * as EventEmitter from "events";

export function makeRedisReplayFunction(redisCommunication: any[]): PatchFunction {
    return function(originalRedis) {

        const ocreateStream = originalRedis.RedisClient.prototype.create_stream;
        originalRedis.RedisClient.prototype.create_stream = function() {
            const fakeStream: any = new EventEmitter();
            fakeStream.setTimeout = fakeStream.setNoDelay = fakeStream.setKeepAlive = function() {/* empty */};
            fakeStream.writable = true;
            this.options.stream = fakeStream;

            this.options.stream.write = function(message) {
                const next = redisCommunication.shift();
                if (next.send) {
                    assert.equal(message, next.send);
                    if (redisCommunication[0].recv) {
                        setTimeout(() => {
                            fakeStream.emit("data", new Buffer(redisCommunication.shift().recv));
                        }, 0);
                    }
                    return next.ret;
                } else {
                    throw new Error("Unexpected write");
                }
            };

            setTimeout(() => this.options.stream.emit("connect", {}), 0);

            return ocreateStream.apply(this, arguments);
        };

        return originalRedis;
    };
}
