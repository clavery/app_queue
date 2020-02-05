var Queue = require('app_queue/cartridge/scripts/Queue');

function enqueue() {
    var name = "queue.test.queue";
    var message = {
        body: request.httpParameterMap.body.stringValue,
        when: new Date()
    };
    var messageId = Queue.publish(name, message, {
        retention: Queue.RETENTION.ALWAYS
    });
    response.writer.println("Queued Message with ID: " + messageId);
}
enqueue.public = true;

if (dw.system.System.instanceType !== dw.system.System.PRODUCTION_SYSTEM) {
    exports.Enqueue = enqueue;
}
