var CustomObjectMgr = require("dw/object/CustomObjectMgr");
var Logger = require('dw/system/Logger');
var HookMgr = require('dw/system/HookMgr');
var Transaction = require('dw/system/Transaction');
var Status = require('dw/system/Status');

var Queue = require('../../Queue');
var Utils = require('../Utils');

var log = Logger.getLogger('queue', 'queue');

var messages;
var processed = 0;
var errored = 0;
var retried = 0;
var removed = 0;

exports.beforeStep = function (parameters) {
    var now = new Date();
    var shard = 0;
    if (typeof parameters !== "undefined" && typeof parameters.queueShard !== "undefined") {
        shard = parameters.queueShard;
    }

    messages = CustomObjectMgr.queryCustomObjects(Queue.MESSAGE_TYPE,
        "(custom.status = {0} OR custom.status = {1}) AND custom.visibilityTime <= {2} AND custom.shard = {3}",
        "custom.priority, creationDate",
        Queue.STATUS.PENDING, Queue.STATUS.RETRY, now, shard);

    if (messages.count > 0) {
        log.debug("Processing {0} messages", messages.count);
    }
    return undefined;
};

exports.getTotalCount = function () {
    return messages.count;
};

exports.read = function () {
    if (messages.hasNext()) {
        return messages.next();
    }
    return undefined;
};

exports.process = function (message) {
    log.debug("Processing message {0}", message.custom.id);

    if (message.custom.status === Queue.STATUS.RETRY) {
        retried++;
    }

    var queueName = message.custom.queueName;

    var lastResult = {
        exception: undefined,
        status: {}
    };
    var success = false;
    try {
        var args = JSON.parse(message.custom.args);

        if (HookMgr.hasHook(queueName)) {
            var result;
            Transaction.wrap(function () {
                result = HookMgr.callHook(queueName, 'receive', args);
            });

            lastResult.status.details = {};
            if (empty(result)) {
                lastResult.status.code = "ERROR";
                lastResult.status.message = "Empty result from subscriber";
            } else if (result.class === Status && result.error) {
                lastResult.status.status = result.status;
                lastResult.status.code = result.code;
                lastResult.status.message = result.message;
                lastResult.status.details = Utils.mapToObject(result.details);
            } else if (result.class !== Status) {
                log.warn("Result from subscriber hook was NOT a dw.system.Status object");
                lastResult.status.status = Status.OK;
                lastResult.status.code = "OK";
                lastResult.status.details = result;
                processed++;
                success = true;
            } else {
                lastResult.status.status = result.status;
                lastResult.status.code = result.code;
                lastResult.status.message = result.message;
                lastResult.status.details = Utils.mapToObject(result.details);
                processed++;
                success = true;
            }
        } else {
            throw Error("Subscriber hook for queue '" + queueName + "' not found");
        }
    } catch (e) {
        if (e.stack) {
            lastResult.exception = Utils.callSiteFromException(e);
        }
        lastResult.status.code = "EXCEPTION";
        lastResult.status.message = e.toString();
        lastResult.status.details = {};
        errored++;
    }

    Transaction.begin();
    try {
        message.custom.lastResult = JSON.stringify(lastResult, null, 2);
    } catch (e) {
        log.error("Error serializing last result for message {0} (may contain unserializable elements): {1}", message.custom.id, e);
        message.custom.lastResult = "{}";
    }

    message.custom.remainingDeliveryAttempts--;
    if (success) {
        message.custom.status = Queue.STATUS.COMPLETE;
    } else {
        message.custom.errorCount++;
        errored++;

        if (message.custom.remainingDeliveryAttempts <= 0) {
            log.error("Message {0} failed to deliver to {1}", message.custom.id, queueName);
            message.custom.status = Queue.STATUS.FAILED;
        } else {
            log.warn("Message {0} failed to deliver to {2}; will retry {1} more times", message.custom.id,
                message.custom.remainingDeliveryAttempts, queueName);
            message.custom.status = Queue.STATUS.RETRY;
            var now = new Date();
            message.custom.visibilityTime = new Date(now.getTime() +
                Math.pow(2, message.custom.errorCount) * (60 * 1000));
        }
    }

    // dead letter
    if (message.custom.status.value === Queue.STATUS.FAILED) {
        var deadLetterResult;
        try {
            if (HookMgr.hasHook('queue.deadletter.' + queueName)) {
                deadLetterResult = HookMgr.callHook('queue.deadletter.' + queueName, 'receive', queueName, args);
            }

            if (HookMgr.hasHook('queue.deadletter') && (empty(deadLetterResult) || deadLetterResult.error)) {
                // Call generic dead letter if no specific result is available or resulted in an error
                HookMgr.callHook('queue.deadletter', 'receive', queueName, args);
            } else {
                log.warn("No generic dead letter queue available");
            }
        } catch (e) {
            log.error("Error delivering to dead letter queue(s): {0}", e);
        }

        if (message.custom.retention.value === Queue.RETENTION.NEVER) {
            log.debug("Removing message {0}", message.custom.id);
            CustomObjectMgr.remove(message);
            removed++;
        } else if (!empty(deadLetterResult) && deadLetterResult.class === Status && !deadLetterResult.error) {
            log.debug("Removing message {0} due to dead letter queue returning OK status", message.custom.id);
            removed++;
            CustomObjectMgr.remove(message);
        }
    } else if (message.custom.status.value === Queue.STATUS.COMPLETE &&
        message.custom.retention.value !== Queue.RETENTION.ALWAYS) {
        log.debug("Removing message {0}", message.custom.id);
        CustomObjectMgr.remove(message);
        removed++;
    }

    Transaction.commit();
    return null;
};

exports.write = function (chunk) {
};

exports.afterChunk = function () {
    if ((messages.count + processed + retried + errored + removed) > 0) {
        // don't log unless we have some positive number to report
        log.info("METRICS: [totalMessages:{0}],[processedMessages:{1}],[retriedMessages:{2}],[erroredMessages:{3}],[removedMessages:{4}]",
            messages.count, processed, retried, errored, removed);
    }
};

exports.afterStep = function () {
};
