var Queue = require('../Queue');

/**
 * Publish a message to the queue via hook
 *
 * @param {string} queueName - name of queue to publish to
 * @param {object} message - JSON serializable message
 * @param {PublishOptions} options - optional queue publish options
 *
 */
exports.publish = function() {
    return Queue.publish.apply(Queue, arguments);
};
