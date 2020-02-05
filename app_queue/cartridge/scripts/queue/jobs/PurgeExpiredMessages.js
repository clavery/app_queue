var CustomObjectMgr = require("dw/object/CustomObjectMgr");
var Logger = require('dw/system/Logger');
var Transaction = require('dw/system/Transaction');

var Queue = require('../../Queue');

var log = Logger.getLogger('queue', 'queue');

var messages;
var removed = 0;

exports.beforeStep = function (parameters) {
    var now = new Date();
    messages = CustomObjectMgr.queryCustomObjects(Queue.MESSAGE_TYPE,
        "(custom.status = {0} OR custom.status = {1}) AND custom.retainTill < {2}",
        "custom.priority, creationDate",
        Queue.STATUS.FAILED, Queue.STATUS.COMPLETE, now);

    log.info("Processing {0} messages", messages.count);
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
    Transaction.begin();
    log.info("Removing message {0}", message.custom.id);
    CustomObjectMgr.remove(message);
    removed++;
    Transaction.commit();
    return null;
};

exports.write = function (chunk) {
};

exports.afterChunk = function () {
    log.info("METRICS: [removedMessages:{0}]", removed);
};

exports.afterStep = function () {
};
