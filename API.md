<a name="module_Queue"></a>

## Queue
app_queue - Generic message queue for SFCC

**Example** *(Publisher (API style))*  
```js
var Queue = require('app_queue/cartridge/scripts/Queue');
Queue.publish('email.send', {
  subject: 'Hello Friend',
  to: 'test@test.com',
  body: 'How are you',
}, { delay: 3600, priority: Queue.PRIORITY.LOW });
```
**Example** *(Publisher (Hook style))*  
```js
var HookMgr = require('dw/system/HookMgr');
HookMgr.callHook('queue', 'publish', 'email.send', {
  subject: 'Hello Friend',
  to: 'test@test.com',
  body: 'How are you',
}, { delay: 3600, priority: 2 });
```
**Example** *(Subscriber implementation (hooks only))*  
```js
// hooks.json
{
  "hooks": [{
    "name": "email.send",
    "script": "./emailSendSubscriber"
  }]
}

// emailSendSubscriber.js
exports.receive = function(message) {
  var mail = new Mail();
  mail.addTo(message.to);
  ...
  return new Status(Status.OK);
};
```
**Example** *(Publisher - Get status of message)*  
```js
var Queue = require('app_queue/cartridge/scripts/Queue');
var messageId = Queue.publish('test.queue', { a: 'b' }, {
  retention: Queue.RETENTION.ALWAYS
});
...
var result = Queue.get(messageId);
if (result.status === Queue.STATUS.COMPLETE) {
   ...
}
```
**Example** *(Subscriber - Dead letters)*  
```js
// hooks.json
{
  "hooks": [{
    "name": "queue.deadletter",
    "script": "./deadLetterSubscriber"
  }, {
    "name": "queue.deadletter.email.send",
    "script": "./deadLetterSubscriberFailedEmails"
  }]
}

// deadLetterSubscriber.js
exports.receive = function(queueName, message) {
  ...
};

// deadLetterSubscriberFailedEmails.js
exports.receive = function(queueName, message) {
  ...
};
```
**Example** *(Subscriber Returning Errors)*  
```js
// hooks.json
{
  "hooks": [{
    "name": "email.send",
    "script": "./emailSendSubscriber"
  }]
}

// emailSendSubscriber.js
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

* [Queue](#module_Queue)
    * _static_
        * [.publish(queueName, message, options)](#module_Queue.publish) ⇒ <code>string</code>
        * [.get(messageId)](#module_Queue.get) ⇒ <code>MessageInfo</code> \| <code>null</code>
    * _inner_
        * [~RETENTION](#module_Queue..RETENTION) : <code>enum</code>
        * [~PRIORITY](#module_Queue..PRIORITY) : <code>enum</code>
        * [~STATUS](#module_Queue..STATUS) : <code>enum</code>
        * [~RetentionType](#module_Queue..RetentionType) : <code>string</code>
        * [~PriorityType](#module_Queue..PriorityType) : <code>number</code>
        * [~StatusType](#module_Queue..StatusType) : <code>string</code>
        * [~PublishOptions](#module_Queue..PublishOptions) : <code>Object</code>
        * [~CallSite](#module_Queue..CallSite) : <code>Object</code>
        * [~LastResult](#module_Queue..LastResult) : <code>Object</code>
        * [~MessageInfo](#module_Queue..MessageInfo) : <code>Object</code>

<a name="module_Queue.publish"></a>

### Queue.publish(queueName, message, options) ⇒ <code>string</code>
Publish a message to a queue. The queue name should be any string
(recommend using dotted category hierarchy i.e. email.send). Message
should be any JSON serializable object.

Provide optional publish options to control delay, retention, priority
and other options.

**Kind**: static method of [<code>Queue</code>](#module_Queue)  
**Returns**: <code>string</code> - message identifier  
**See**: PublishOptions  

| Param | Type | Description |
| --- | --- | --- |
| queueName | <code>string</code> | name of queue to publish to |
| message | <code>object</code> | JSON serializable message |
| options | <code>PublishOptions</code> | optional queue publish options |

<a name="module_Queue.get"></a>

### Queue.get(messageId) ⇒ <code>MessageInfo</code> \| <code>null</code>
Retrieve status information about a message by ID

**Kind**: static method of [<code>Queue</code>](#module_Queue)  
**Returns**: <code>MessageInfo</code> \| <code>null</code> - message info or null if not found  
**See**: MessageInfo  

| Param | Type | Description |
| --- | --- | --- |
| messageId | <code>string</code> | id of published message |

<a name="module_Queue..RETENTION"></a>

### Queue~RETENTION : <code>enum</code>
**Kind**: inner enum of [<code>Queue</code>](#module_Queue)  
**Read only**: true  
**Properties**

| Name | Type | Default |
| --- | --- | --- |
| ONFAILURE | <code>RetentionType</code> | <code>ONFAILURE</code> | 
| NEVER | <code>RetentionType</code> | <code>NEVER</code> | 
| ALWAYS | <code>RetentionType</code> | <code>ALWAYS</code> | 

<a name="module_Queue..PRIORITY"></a>

### Queue~PRIORITY : <code>enum</code>
**Kind**: inner enum of [<code>Queue</code>](#module_Queue)  
**Read only**: true  
**Properties**

| Name | Type | Default |
| --- | --- | --- |
| HIGH | <code>PriorityType</code> | <code>0</code> | 
| NORMAL | <code>PriorityType</code> | <code>1</code> | 
| LOW | <code>PriorityType</code> | <code>2</code> | 

<a name="module_Queue..STATUS"></a>

### Queue~STATUS : <code>enum</code>
**Kind**: inner enum of [<code>Queue</code>](#module_Queue)  
**Read only**: true  
**Properties**

| Name | Type | Default |
| --- | --- | --- |
| PENDING | <code>StatusType</code> | <code>PENDING</code> | 
| RETRY | <code>StatusType</code> | <code>RETRY</code> | 
| COMPLETE | <code>StatusType</code> | <code>COMPLETE</code> | 
| FAILED | <code>StatusType</code> | <code>FAILED</code> | 

<a name="module_Queue..RetentionType"></a>

### Queue~RetentionType : <code>string</code>
**Kind**: inner typedef of [<code>Queue</code>](#module_Queue)  
<a name="module_Queue..PriorityType"></a>

### Queue~PriorityType : <code>number</code>
**Kind**: inner typedef of [<code>Queue</code>](#module_Queue)  
<a name="module_Queue..StatusType"></a>

### Queue~StatusType : <code>string</code>
**Kind**: inner typedef of [<code>Queue</code>](#module_Queue)  
<a name="module_Queue..PublishOptions"></a>

### Queue~PublishOptions : <code>Object</code>
Publish Options

**Kind**: inner typedef of [<code>Queue</code>](#module_Queue)  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| delay | <code>number</code> | message delay in seconds |
| retention | <code>RetentionType</code> | retention behavior |
| retentionDuration | <code>number</code> | how long to retain message on failure or complete (default 7 days) |
| deliveryAttempts | <code>number</code> | default number of delivery attempts before failure (default 3) |
| priority | <code>PriorityType</code> | higher priority messages are processed first (default PRIORITY.NORMAL) |
| fifo | <code>boolean</code> | ensure fifo delivery |

<a name="module_Queue..CallSite"></a>

### Queue~CallSite : <code>Object</code>
Call site information

**Kind**: inner typedef of [<code>Queue</code>](#module_Queue)  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| filename | <code>string</code> | filename of call site |
| lineNo | <code>number</code> | line number in filename |
| functionName | <code>string</code> | if available the call site function name |

<a name="module_Queue..LastResult"></a>

### Queue~LastResult : <code>Object</code>
Last result received from the subscriber

**Kind**: inner typedef of [<code>Queue</code>](#module_Queue)  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| exception | <code>CallSite</code> | exception location information or empty |
| status | <code>object</code> | status result of last call |
| status.status | <code>number</code> \| <code>undefined</code> | status result (OK or ERROR) |
| status.code | <code>string</code> \| <code>undefined</code> | status code |
| status.message | <code>message</code> \| <code>undefined</code> | status message |
| status.details | <code>object</code> \| <code>undefined</code> | optional details provided by the last status returned |

<a name="module_Queue..MessageInfo"></a>

### Queue~MessageInfo : <code>Object</code>
Message Info

**Kind**: inner typedef of [<code>Queue</code>](#module_Queue)  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| id | <code>string</code> | message id |
| status | <code>StatusType</code> | current message status |
| lastResult | <code>LastResult</code> | the last result if available |
| _message | <code>object</code> | raw custom object (api may change) |

