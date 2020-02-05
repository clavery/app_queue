/**
 * app_queue - Generic message queue for SFCC
 *
 * @module Queue
 *
 * @example <caption>Publisher (API style)</caption>
 * var Queue = require('app_queue/cartridge/scripts/Queue');
 * Queue.publish('email.send', {
 *   subject: 'Hello Friend',
 *   to: 'test@test.com',
 *   body: 'How are you',
 * }, { delay: 3600, priority: Queue.PRIORITY.LOW });
 *
 * @example <caption>Publisher (Hook style)</caption>
 * var HookMgr = require('dw/system/HookMgr');
 * HookMgr.callHook('queue', 'publish', 'email.send', {
 *   subject: 'Hello Friend',
 *   to: 'test@test.com',
 *   body: 'How are you',
 * }, { delay: 3600, priority: 2 });
 *
 * @example <caption>Subscriber implementation (hooks only)</caption>
 * // hooks.json
 * {
 *   "hooks": [{
 *     "name": "email.send",
 *     "script": "./emailSendSubscriber"
 *   }]
 * }
 *
 * // emailSendSubscriber.js
 * exports.receive = function(message) {
 *   var mail = new Mail();
 *   mail.addTo(message.to);
 *   ...
 *   return new Status(Status.OK);
 * };
 *
 * @example <caption>Publisher - Get status of message</caption>
 * var Queue = require('app_queue/cartridge/scripts/Queue');
 * var messageId = Queue.publish('test.queue', { a: 'b' }, {
 *   retention: Queue.RETENTION.ALWAYS
 * });
 * ...
 * var result = Queue.get(messageId);
 * if (result.status === Queue.STATUS.COMPLETE) {
 *    ...
 * }
 *
 * @example <caption>Subscriber - Dead letters</caption>
 * // hooks.json
 * {
 *   "hooks": [{
 *     "name": "queue.deadletter",
 *     "script": "./deadLetterSubscriber"
 *   }, {
 *     "name": "queue.deadletter.email.send",
 *     "script": "./deadLetterSubscriberFailedEmails"
 *   }]
 * }
 *
 * // deadLetterSubscriber.js
 * exports.receive = function(queueName, message) {
 *   ...
 * };
 *
 * // deadLetterSubscriberFailedEmails.js
 * exports.receive = function(message) {
 *   ...
 * };
 *
 * @example <caption>Subscriber Returning Errors</caption>
 * // hooks.json
 * {
 *   "hooks": [{
 *     "name": "email.send",
 *     "script": "./emailSendSubscriber"
 *   }]
 * }
 *
 * // emailSendSubscriber.js
 * exports.receive = function(message) {
 *   ...
 *   if (result.error) {
 *      return new Status(Status.ERROR, "FAILED_SEND", "Failed to send")
 *   }
 *   // or
 *   throw new Error("Failed to send")
 *
 *   return new Status(Status.OK);
 * };
 */

var CustomObjectMgr = require('dw/object/CustomObjectMgr');
var Transaction = require('dw/system/Transaction');
var UUIDUtils = require('dw/util/UUIDUtils');
var Logger = require('dw/system/Logger');
var Site = require('dw/system/Site');
var System = require('dw/system/System');
var Pipeline = require('dw/system/Pipeline');

var Utils = require('./queue/Utils');

var log = Logger.getLogger('queue', 'queue');

exports.MESSAGE_TYPE = "QueueMessage";

/**
 * @typedef {string} RetentionType
 */

/**
 * @readonly
 * @enum {RetentionType}
 */
var RETENTION = {
    ONFAILURE: "ONFAILURE",
    NEVER: "NEVER",
    ALWAYS: "ALWAYS"
};
exports.RETENTION = RETENTION;

/**
 * @typedef {number} PriorityType
 */

/**
 * @readonly
 * @enum {PriorityType}
 */
var PRIORITY = {
    HIGH: 0,
    NORMAL: 1,
    LOW: 2
};
exports.PRIORITY = PRIORITY;

exports.RETENTION = RETENTION;
/**
 * @typedef {string} StatusType
 */

/**
 * @readonly
 * @enum {StatusType}
 */
var STATUS = {
    PENDING: "PENDING",
    RETRY: "RETRY",
    COMPLETE: "COMPLETE",
    FAILED: "FAILED",
};
exports.STATUS = STATUS;

/**
 * Publish Options
 * @typedef {Object} PublishOptions
 * @property {number} delay - message delay in seconds
 * @property {RetentionType} retention - retention behavior
 * @property {number} retentionDuration - how long to retain message on failure or complete (default 7 days)
 * @property {number} deliveryAttempts - default number of delivery attempts before failure (default 3)
 * @property {PriorityType} priority - higher priority messages are processed first (default PRIORITY.NORMAL)
 * @property {boolean} fifo - ensure fifo delivery
 */


var DEFAULT_OPTIONS = {
    delay: 0,
    retention: RETENTION.ONFAILURE,
    retentionDuration: 604800, // 7 days
    deliveryAttempts: 3,
    priority: PRIORITY.NORMAL,
    fifo: false
};

/**
 * Call site information
 * @typedef {Object} CallSite
 * @property {string} filename - filename of call site
 * @property {number} lineNo - line number in filename
 * @property {string} functionName - if available the call site function name
 */

/**
 * Last result received from the subscriber
 * @typedef {Object} LastResult
 * @property {CallSite} exception - exception location information or empty
 * @property {object} status - status result of last call
 * @property {number|undefined} status.status - status result (OK or ERROR)
 * @property {string|undefined} status.code - status code
 * @property {message|undefined} status.message - status message
 * @property {object|undefined} status.details - optional details provided by the last status returned
 */

/**
 * Message Info
 * @typedef {Object} MessageInfo
 * @property {string} id - message id
 * @property {StatusType} status - current message status
 * @property {LastResult} lastResult - the last result if available
 * @property {object} _message - raw custom object (api may change)
 */

/**
 * Publish a message to a queue. The queue name should be any string
 * (recommend using dotted category hierarchy i.e. email.send). Message
 * should be any JSON serializable object.
 *
 * Provide optional publish options to control delay, retention, priority
 * and other options.
 *
 * @param {string} queueName - name of queue to publish to
 * @param {object} message - JSON serializable message
 * @param {PublishOptions} options - optional queue publish options
 * @returns {string} message identifier
 * @see PublishOptions
 */
exports.publish = function(queueName, message, options) {
    var callSite = {};
    options = options ? options : {};

    // collect call site information for debugging
    try {
        throw new Error("test");
    } catch(e) {
        callSite = Utils.callSiteFromException(e, 1);
    }

    var finalOptions = Utils.assign({}, DEFAULT_OPTIONS, options);

    Transaction.begin();

    var id = UUIDUtils.createUUID();
    var now = new Date();

    var messageObj = CustomObjectMgr.createCustomObject(exports.MESSAGE_TYPE, id);
    messageObj.custom.queueName = queueName;

    try {
        messageObj.custom.args = JSON.stringify(message, undefined, 2);
    } catch(e) {
        Transaction.rollback();
        log.error("Cannot queue message with unserializable body");
        throw new Error("Cannot serialize message; Must be JSON serializable");
    }

    messageObj.custom.callSite = JSON.stringify(callSite, undefined, 2);
    messageObj.custom.status = STATUS.PENDING;

    messageObj.custom.priority = finalOptions.priority;
    messageObj.custom.remainingDeliveryAttempts = finalOptions.deliveryAttempts;
    messageObj.custom.errorCount = 0;
    messageObj.custom.visibilityTime = new Date(now.getTime() + finalOptions.delay * 1000);
    messageObj.custom.retention = finalOptions.retention;
    messageObj.custom.retainTill = new Date(now.getTime() + finalOptions.retentionDuration * 1000);

    var shard = 0;
    var queueNum = Site.current.getCustomPreferenceValue("queueNumQueues");

    if (!finalOptions.fifo) {
        shard = Math.floor(Math.random() * queueNum);
    } else {
        // if requesting fifo always use same queue shard
        shard = queueName.length % queueNum;
    }
    messageObj.custom.shard = shard;

    log.info("Queueing message {0} to {1}", id, queueName);
    Transaction.commit();

    /* This is disabled pending fix of a defect with salesforce (logging breaks when using RunJobNow
     * pipelet/
    /* if (System.instanceType !== System.PRODUCTION_SYSTEM && */
    /*     Site.current.getCustomPreferenceValue("queueExecuteImmediately")) { */
    /*     var jobName = Site.current.getCustomPreferenceValue("queueJobName"); */
    /*     for (var i = 0; i < queueNum; i++) { */
    /*         Pipeline.execute('QueueUtils-TriggerQueueJob', { */
    /*             jobName: jobName + i, */
    /*         }); */
    /*     } */
    /* } */
    return id;
};

/**
 * Retrieve status information about a message by ID
 *
 * @see MessageInfo
 *
 * @param {string} messageId - id of published message
 * @returns {MessageInfo|null} message info or null if not found
 */
exports.get = function(messageId) {
    var message = CustomObjectMgr.getCustomObject(exports.MESSAGE_TYPE, messageId);
    if (empty(message)) {
        return null;
    }

    var lastResult = {
        exception: {},
        status: {}
    };
    try {
        lastResult = JSON.parse(message.custom.lastResult);
    } catch(e) { /* ignore */ }

    return {
        id: messageId,
        status: message.custom.status.value,
        lastResult: lastResult,
        _message: message
    };
};
