var Queue = require('app_queue/cartridge/scripts/Queue');
var HookMgr = require('dw/system/HookMgr');

function enqueue() {
    var name = "queue.test.queue";
    var message = {
        body: request.httpParameterMap.body.stringValue,
        when: new Date()
    };
    var messageId = Queue.publish(name, message, {
        retention: Queue.RETENTION.ALWAYS
    });
    response.setContentType('text/plain');
    response.writer.println("Queued Message with ID: " + messageId);
}
enqueue.public = true;

function enqueueHook() {
    var name = "queue.test.queue";
    var message = {
        body: request.httpParameterMap.body.stringValue,
        when: new Date()
    };
    var messageId = HookMgr.callHook('queue', 'publish', name, message, {
        retention: Queue.RETENTION.ALWAYS,
        priority: 2
    });
    response.setContentType('text/plain');
    response.writer.println("Queued Message with ID: " + messageId);
}
enqueueHook.public = true;

function getStatus() {
    var id = request.httpParameterMap.messageId.stringValue;
    var info = Queue.get(id);
    response.setContentType('text/plain');
    if (info) {
        response.writer.println(info.status);
        response.writer.println(JSON.stringify(info.lastResult, null, 2));
    } else {
        response.writer.println("Not Found");
    }
}
getStatus.public = true;

if (dw.system.System.instanceType !== dw.system.System.PRODUCTION_SYSTEM) {
    exports.Enqueue = enqueue;
    exports.EnqueueHook = enqueueHook;
    exports.GetStatus = getStatus;
}
