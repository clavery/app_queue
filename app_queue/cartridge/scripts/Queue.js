/**
 * app_queue Primary API
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
 * # hooks.json
 * {
 *   "hooks": [{
 *     "name": "email.send",
 *     "script": "./emailSendSubscriber"
 *   }]
 * }
 *
 * # emailSendSubscriber.js
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
 * var result = Queue.getStatus(messageId);
 * if (result.status === Queue.STATUS.COMPLETE) {
 *    ...
 * }
 *
 * @example <caption>Subscriber - Dead letters</caption>
 * # hooks.json
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
 * # deadLetterSubscriber.js
 * exports.receive = function(queueName, message) {
 *   ...
 * };
 * # deadLetterSubscriberFailedEmails.js
 * exports.receive = function(message) {
 *   ...
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
 * @property {RetentionType} retention  - The artist
 */


var DEFAULT_OPTIONS = {
    delay: 0,
    retention: RETENTION.ONFAILURE,
    retentionDuration: 604800, // 7 days
    deliveryAttempts: 3,
    priority: PRIORITY.NORMAL
};

/**
 * Publish a message to the queue
 *
 * @param {string} queueName - name of queue to publish to
 * @param {object} message - JSON serializable message
 * @param {PublishOptions} options - optional queue publish options
 *
 */
exports.publish = function(queueName, message, options) {

    var callSite = {};

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

    log.info("Queueing message {0}", id);
    Transaction.commit();

    if (System.instanceType !== System.PRODUCTION_SYSTEM &&
        Site.current.getCustomPreferenceValue("queueExecuteImmediately")) {
        var jobName = Site.current.getCustomPreferenceValue("queueJobName");
        Pipeline.execute('QueueUtils-TriggerQueueJob', {
            jobName: jobName,
        });
    }
    return id;
};