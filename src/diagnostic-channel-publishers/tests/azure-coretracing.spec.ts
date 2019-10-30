// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
import * as coreTracingTypes from "@azure/core-tracing";
import * as assert from "assert";
import {channel, IStandardEvent} from "diagnostic-channel";
import {AzureMonitorSymbol, enable as enableAzureSDKTracing} from "../src/azure-coretracing.pub";

const assertSpans = (events, span) => {
    assert.equal(events.length, 0);
    span.end();
    assert.equal(events.length, 1);
    assert.deepEqual(events[0].data, span);
};

describe("@azure/core-tracing@1.0.0-preview4+", () => {
    let coretracing: typeof coreTracingTypes;
    let events: Array<IStandardEvent<coreTracingTypes.Span>>;
    let tracer: coreTracingTypes.Tracer;

    before(() => {
        enableAzureSDKTracing();
        channel.subscribe<coreTracingTypes.Span>("azure-coretracing", function(span) {
            events.push(span);
        });
        coretracing = require("@azure/core-tracing");
        tracer = coretracing.getTracer();
    });

    beforeEach(() => {
        events = [];
    });

    it("should fire events when a span is ended", (done) => {
        assert.equal(tracer[AzureMonitorSymbol], true);
        const span = tracer.startSpan("test span 1");
        assert.deepEqual(tracer.getCurrentSpan(), null);
        assertSpans(events, span);
        assert.deepEqual(span["events"][0].name, "Application Insights Integration enabled");
        done();
    });
});
