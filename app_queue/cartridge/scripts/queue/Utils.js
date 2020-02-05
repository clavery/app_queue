exports.assign = function(target) {
    var to = Object(target);

    for (var i = 1; i < arguments.length; i++) {
        var nextSource = arguments[i];

        if (nextSource !== null && nextSource !== undefined) {
            for (var nextKey in nextSource) {
                if (Object.prototype.hasOwnProperty.call(nextSource, nextKey)) {
                    to[nextKey] = nextSource[nextKey];
                }
            }
        }
    }

    return to;
};

var CODE_LINE = /\s*at\s([^:]+):(\d+)\s?(\((\w+)\))?/;
exports.callSiteFromException = function(e, popNum) {
    var callSite = {};
    popNum = popNum ? popNum : 0;
    try {
        var stack = e.stack;
        var stackLines = stack.split("\n").slice(popNum);
        // if using publish hook API jump another level
        if (stackLines[0].indexOf('PublishHook') !== -1) {
            stackLines = stack.split("\n").slice(popNum+1);
        }
        var sourceMatch = stackLines.shift().match(CODE_LINE);
        if (sourceMatch) {
            callSite = {
                filename: sourceMatch[1],
                lineNo: parseInt(sourceMatch[2])
            };
            if (sourceMatch[4]) {
                callSite.functionName = sourceMatch[4];
            }
        }
    } catch(e) { /* ignore */ }

    return callSite;
};

exports.mapToObject = function(map) {
    if (empty(map)) {
        return {};
    }

    var target = {};
    var keyIt = map.keySet().iterator();
    while(keyIt.hasNext()) {
        var key = keyIt.next();
        target[key] = map.get(key);
    }
    return target;
};
