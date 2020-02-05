# app_queue - Generic Message Queue for Salesforce Commerce Cloud B2C (SFCC)

This cartridge implements a generic async message queue service on top of
Salesforce Commerce Cloud's custom objects, job scheduler and hooks APIs.

## Motivation

The Job's framework in SFCC is frequently used to implement
decoupling of orthogonal business concerns, asynchronous scripts processing, and
message queue-like functionality but often bespoke implementations are created
for each domain-specific purpose. Multiple implementations can lead to
duplication of code, defects and behavior differences as well as reduced time to
market.

The goal here is to consolidate useful queue features into a single,
shared-library, implementation that can easily be leveraged by a storefront
implementation increasing quality and reducing time to market for new features
that require a queue.

## Features

- [Simple API](./API.md)
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
    - avoids needing to execute the processing job in business manager
- Subscribers to queues are implemented using hooks
    - decouples business logic from this cartridge
- publishing can use the API via directly referencing this cartridge or by using
  a hook to decouple from this cartridge
- Verbose logging of message delivery and queue status including parsable metrics
- low queue cardinality is maintained via opt-in retention settings, custom
  object lifetimes and clean up jobs for expired objects.
- TODO: Business manager module for monitoring queue status and dead letters

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

## Usage

See [API](./API) for API documentation including examples.

## Architecture
