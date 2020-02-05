var Logger = require('dw/system/Logger');
var Status = require('dw/system/Status');

var log = Logger.getLogger('queue', 'queue.deadletter');

exports.receive = function(queueName, args) {
    log.error("Dead letter received for {0}", queueName);
    return new Status(Status.OK);
};
