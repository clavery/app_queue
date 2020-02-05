# app_queue - Generic Message Queue for Salesforce Commerce Cloud B2C (SFCC)

This cartridge implements a generic async message queue service on top of
Salesforce Commerce Cloud's custom objects, job scheduler and hooks APIs.

* [Motivation](#motivation)
* [Features](#features)
* [Use Cases](#use-cases)
* [Installation](#installation)
* [Usage](#usage)
    * [API](./API.md)
* [Development](#development)

## Motivation

The Job's framework in SFCC is frequently used to implement decoupling of
orthogonal business concerns, asynchronous scripts processing, and message
queue-like functionality. But often bespoke implementations are created for
domain-specific purpose. Multiple implementations can lead to duplication of
code, defects and behavior differences as well as reduced time to market.

The goal here is to consolidate useful, general purpose, queue features into
a single, shared, library that can easily be leveraged by a storefront
implementation increasing quality and reducing time to market for new features
that require a queue.

## Features

- [Simple API](#usage)
- Delivers messages to named queues
- delayed message support
- optional FIFO support for the same queue name and message priority
- message prioritization (HIGH, NORMAL, LOW)
- configurable, per-message, retry on error with exponential back-off
- Dead letter queue (global and per-queue dead letter delivery)
    - Allows for notifications, recovery due to coding or transient errors and
      alternative business logic for messages that fail delivery to subscribers
- optional retention of messages (by default failures are retained)
- optional immediate execution of job in sandbox environments
    - TODO: this is currently disabled due to SFCC bug
    - Workaround: run the jobs manually or use the `TestQueue-RunQueues` controller provided
- Subscribers to queues are implemented using hooks
    - decouples business logic from this cartridge
- publishing can use the API via directly referencing this cartridge or by using
  a hook to decouple from this cartridge
- Verbose logging of message delivery and queue status including parsable metrics
- Debugging (call site, errors, exceptions) stored with message
- low queue cardinality is maintained via opt-in retention settings, custom
  object lifetimes and clean up jobs for expired objects.
- TODO: Business manager module for monitoring queue status and dead letters
    - In the meantime custom object search in BM can be used to view, edit and
      requeue messages (i.e. dead letters after fixing code defects)

### Limitations

- Currently only site-scoped messages are supported; Organizational messages
  will be supported later

## Use Cases

- To move execution of expensive tasks away from storefront requests
    - i.e. Transactional email delivery
- To reduce potential storefront quota issues(i.e. HTTP requests)
- Alleviate issues with problematic 3rd parties by automatically retrying
  failed messages with exponential backoff and handling failures through the
  dead letter queue.
- Integration with external services with unpredictable reliability and
  performance characteristics
    - i.e. Order management functionality (returns, cancellations, etc)

### Invalid Use Cases

The intended use cases of this cartridge should follow best practices for
quotas, volumes and object churn. Therefore the following would not be good use
cases:

- High volume messages such as analytics-level tracking
- expensive operations such as import/export and ETL operations
    - Regular, dedicated, jobs should be used for long running tasks.
- Messages that require fine-grained execution scheduling
    - The default 1 minute run time for queue processors limits immediate
      processing guarantees

## Installation

1. Install the cartridge in your storefront
2. Import the necessary metadata from the `metadata/` folder.
3. Adjust site preferences as necessary (the default values work fine in most
instances and do not need adjustment)

## Usage

See [API](./API.md) for API documentation including examples.

### Simple Example

#### Publisher

```js
// app_something/cartridge/controllers/SomeController.js
var Queue = require('app_queue/cartridge/scripts/Queue');
Queue.publish('email.send', {
  subject: 'Hello Friend',
  to: 'test@test.com',
  body: 'How are you',
}, { delay: 3600, priority: Queue.PRIORITY.LOW });
```

#### Subscriber

```js
// app_something/hooks.json
{
  "hooks": [{
    "name": "email.send",
    "script": "./cartridge/scripts/EmailSendSubscriber.js"
  }]
}

// app_something/cartridge/scripts/EmailSendSubscriber.js
var Status = require('dw/system/Status');
exports.receive = function(message) {
  var mail = new Mail();
  mail.addTo(message.to);
  ...
  if (sendResponse.error) {
      return new Status(Status.ERROR, "FAILED_SEND")
  }
  return new Status(Status.OK);
};
```

Queue subscribers should always return a `dw.system.Status` object with a `Status.OK` status on successful execution. Returning a non-Status object (such as a string) will result in successful execution but log a warning.

All other return values including `undefined`, `dw.system.Status` with a non-OK
status, or the subscriber throwing an exception is considered a failed delivery
and will be retried based on configuration (default 3 times with exponential
back off). For best debugging experience a non-OK `dw.system.Status` should be
returned or an exception thrown:

```js
exports.receive = function(message) {
  ...
  if (result.error) {
    return new Status(Status.ERROR, "FAILED_SEND", "Failed to send")
  }
  // or
  throw new Error("Failed to send")

  return new Status(Status.OK);
};
```

#### Getting Message Status Information

The last delivery result (error or success) is serialized in the message result. This includes the `dw.system.Status`
object as well as any exception information. `Queue.get(...)` can be used to retrieve message status information given
the message ID returned from `Queue.publish(...)`.

```js
var info = Queue.get(messageId);
if (info.status === Queue.STATUS.COMPLETE) {
    // do something
}
```

Additional details can be passed back through the use of `dw.system.Status.details` property and retrieved via the
`lastResult` of the message info:

```js
// returnRequestSubscriber.js
exports.receive = function(message) {
    var rmaNo = ExternalIntegration.doReturn(message.items);
    ...
    var status = new Status(Status.OK);
    status.addDetail("rmaNo", rmaNo);
    return status;
};
```

```js
// SomeController.js
function getRmaStatus() {
   var messageId = request.httpParameterMap.rmaRequestId.stringValue;
   var info = Queue.get(messageId);
   if (info && info.status === Queue.STATUS.COMPLETE) {
       // note: check for empty details, etc
       var rmaNo = info.lastResult.details.rmaNo;
       ...
   }
}
```

## Development

TODO
