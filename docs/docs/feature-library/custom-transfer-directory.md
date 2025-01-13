---
sidebar_label: custom-transfer-directory
title: custom-transfer-directory
---
import PluginLibraryFeature from "./_plugin-library-feature.md";

<PluginLibraryFeature />

This feature enables the replacement of the queue and worker transfer directories enabling the following behavior

- render different transfer icons for chat channel
- enable the use of real time data to
  - present queue insights such as # of tasks or # agents available
  - other data available such as queue wait time but further work required to show it on screen
  - filter out queues that have no agents available
- provide an improved starting point for augmenting queue transfer list with custom data (imagine the need to filter queues based on skills required to transfer to those queues)
- provide the ability to enforce queue filters by worker
- provide ability to enforce global queue filter to filter out system queues.
- provide the option to filter out unavailable workers

It also enables the addition of an external directory, enabling the following behavior

- present a list of external transfer numbers from the `contacts` feature if enabled
  - validation checks performed on transfer numbers with notifications of any validation failures

## flex-user-experience

Example queue transfer

![alt text](/img/features/custom-transfer-directory/flex-user-experience-queue-transfer.gif)

Example external transfer

![alt text](/img/features/custom-transfer-directory/flex-user-experience-external-transfer.gif)

## setup and dependencies

Enable the feature in the flex-config asset for your environment.

```javascript
"custom_transfer_directory": {
  "enabled": true, // globally enable or disable the feature
  "worker" : {
    "enabled": true, // enable the custom worker tab
    "show_only_available_workers": false
  },
  "queue" : {
    "enabled": true, // enable the custom queue tab
    "show_only_queues_with_available_workers": true,
    "show_real_time_data" : true, // tool tip for queues will show real time data instead of queue name
    "enforce_queue_filter_from_worker_object": true, // when true, if `worker.attributes.enforcedQueueFilter` is present, it will be enforced, otherwise ignored
    "enforce_global_exclude_filter": false, // when true global_exclude_filter will be applied to exclude any queues matching the filter
    "global_exclude_filter": "SYSTEM" // EXAMPLE to exclude queues containing the word SYSTEM
  },
  "external_directory": {
    "enabled": true, // enable the external directory tab for voice calls
    "skipPhoneNumberValidation": false // skip phone number validation
  }
}
```

NOTE: warm transfer for external directory entries is only available if either the 'conference' feature is also enabled OR Flex's native warm transfer feature is enabled (currently in beta). If neither of these are enabled, a notification will be posted at login informing the user that warm transfers will not be available.

Example worker attribute setting for when the `enforce_queue_filter_from_worker_object` setting is enabled:

```javascript
worker.attributes : {
  enforcedQueueFilter : "TEAM A" // example filter that will include only queues with TEAM A in the name
  // OR using array format for multiple filters
  enforcedQueueFilter : ["TEAM A", "TEAM B"] // will include queues that match any of these filters
}
```

## how does it work?

The queue and worker tabs are replaced with custom components using the Flex component framework. When the component is rendered, a list is loaded from the TaskRouter SDK and cached. Then the insights client is used to load the real time stats for all the queues. The real time stats are appended to each queue retrieved in the insights client and then any filters are applied. Various events trigger a re-evaluation of the filtered list including queue updates (update, add or remove) or an entry into the search field.
