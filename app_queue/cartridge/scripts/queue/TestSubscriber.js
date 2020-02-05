var Logger = require('dw/system/Logger');
var Status = require('dw/system/Status');

var log = Logger.getLogger('queue', 'queue.test');

exports.receive = function(message) {
    log.info("test queue subscriber received message with body {0}", message.body);
    var status = new Status(Status.OK, "GOOD", "Well done");
    status.addDetail('test', 'value');
    status.addDetail('test2', {some:"value"});
    return status;
};
