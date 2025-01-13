import {
  withTaskContext,
  Manager,
  IQueue,
  ClientManagerInstance,
  ClientManagerHelpers,
  Actions,
  ITask,
  Notifications,
  templates,
  TaskHelper,
} from '@twilio/flex-ui';
import { useEffect, useState, useRef } from 'react';
import { SyncMap } from 'twilio-sync';
import { v4 as uuidv4 } from 'uuid';

import { getAllSyncMapItems } from '../../../utils/sdk-clients/sync/SyncClient';
import {
  showOnlyQueuesWithAvailableWorkers,
  shouldFetchInsightsData,
  enforceQueueFilterFromWorker,
  getGlobalFilter,
  shouldEnforceGlobalFilter,
  isCbmColdTransferEnabled,
  isCbmWarmTransferEnabled,
  showRealTimeQueueData,
  isNativeDigitalXferEnabled,
} from '../config';
import { CustomTransferDirectoryNotification } from '../flex-hooks/notifications/CustomTransferDirectory';
import { CustomWorkerAttributes } from '../../../types/task-router/Worker';
import { StringTemplates } from '../flex-hooks/strings/CustomTransferDirectory';
import { DirectoryEntry } from '../types/DirectoryEntry';
import DirectoryTab, { TransferClickPayload } from './DirectoryTab';
import logger from '../../../utils/logger';
import { getFlexFeatureFlag } from '../../../utils/configuration';
import ConversationsHelper from '../../../utils/helpers/ConversationsHelper';

export interface IRealTimeQueueData {
  total_tasks: number | null;
  longest_task_waiting_age: number | null;
  tasks_by_status: {
    wrapping: number;
    reserved: number;
    pending: number;
    assigned: number;
  } | null;
  total_eligible_workers: number | null;
  total_available_workers: number | null;
}

export interface TransferQueue extends IQueue, IRealTimeQueueData {}

export interface OwnProps {
  task: ITask;
}

export interface MapItem {
  data: object | IRealTimeQueueData;
  key: string;
}

const mapRealTimeDataToTransferQueueItem = (
  transferQueue: TransferQueue,
  queueData?: IRealTimeQueueData,
): TransferQueue => {
  transferQueue.total_eligible_workers = queueData ? queueData.total_eligible_workers : null;
  transferQueue.total_available_workers = queueData ? queueData.total_available_workers : null;
  transferQueue.total_tasks = queueData ? queueData.total_tasks : null;
  transferQueue.longest_task_waiting_age = queueData ? queueData.longest_task_waiting_age : null;
  transferQueue.tasks_by_status = queueData ? queueData.tasks_by_status : null;

  return transferQueue;
};

const QueueDirectoryTab = (props: OwnProps) => {
  const [fetchedQueues, setFetchedQueues] = useState([] as Array<IQueue>);
  const [insightsQueues, setInsightsQueues] = useState([] as Array<MapItem>);
  const [filteredQueues, setFilteredQueues] = useState([] as Array<DirectoryEntry>);
  const [isLoading, setIsLoading] = useState(true);

  const transferQueues = useRef([] as Array<TransferQueue>);
  const queueMap = useRef(null as SyncMap | null);

  const { workspaceClient, insightsClient, workerClient } = Manager.getInstance();
  const na = templates[StringTemplates.NA]();

  const callWarmTransferEnabled = getFlexFeatureFlag('flex-warm-transfers');

  const isWarmTransferEnabled =
    props.task && TaskHelper.isCBMTask(props.task) ? isCbmWarmTransferEnabled() : callWarmTransferEnabled;
  const isColdTransferEnabled = props.task && TaskHelper.isCBMTask(props.task) ? isCbmColdTransferEnabled() : true;

  // async function to retrieve the task queues from the tr sdk
  // this will trigger the useEffect for a fetchedQueues update
  const fetchSDKTaskQueues = async () => {
    if (workspaceClient)
      setFetchedQueues(
        Array.from(
          (
            await workspaceClient.fetchTaskQueues({
              Ordering: 'DateUpdated:desc',
            })
          ).values(),
        ) as unknown as Array<IQueue>,
      );
  };

  // async function to retrieve queues from the insights client with
  // agent availability - it should be noted the insights client acts
  // like a cache and can go stale if account is not active
  // to restore the cache, tasks need to be pushed into the queue
  // this will trigger the useEffect for the insightsQueue update
  const fetchInsightsQueueData = async () => {
    // check if insights data has been turned off
    if (!shouldFetchInsightsData()) return;

    // check that the insights client is available
    if (
      !ClientManagerInstance.InsightsClient ||
      ClientManagerHelpers.isForcedDegraded(ClientManagerInstance.InsightsClient)
    ) {
      Notifications.showNotification(CustomTransferDirectoryNotification.FailedLoadingInsightsClient);
      return;
    }

    // get real time stats map
    queueMap.current = await insightsClient.map({
      id: 'realtime_statistics_v1',
      mode: 'open_existing',
    });

    if (!queueMap.current) {
      Notifications.showNotification(CustomTransferDirectoryNotification.FailedLoadingInsightsData);

      return;
    }

    // make sure all queues are loaded
    const insightQueues = await getAllSyncMapItems(queueMap.current);

    // update the queue item
    queueMap.current.on('itemUpdated', (updatedItem) => {
      const {
        item: { key, data },
      } = updatedItem;

      const queue = transferQueues.current.find((transferQueue) => transferQueue.sid === key);
      if (queue && data) {
        mapRealTimeDataToTransferQueueItem(queue, data as IRealTimeQueueData);
      }

      filterQueues();
    });

    // if a queue is added trigger a reload
    queueMap.current.on('itemAdded', () => {
      fetchSDKTaskQueues();
    });

    // if a queue is removed trigger a reload
    queueMap.current.on('itemRemoved', () => {
      fetchSDKTaskQueues();
    });

    setInsightsQueues(insightQueues);
  };

  // function to resolve fetchedQueues and insights queue data
  const generateTransferQueueList = () => {
    const tempQueues = [] as Array<TransferQueue>;
    fetchedQueues.forEach((value) => {
      const tempInsightsQueue = insightsQueues.find((item) => item.key === value.sid);
      const data = tempInsightsQueue?.data as IRealTimeQueueData;

      // merge the fetched queues data with the transfer queue data
      tempQueues.push(mapRealTimeDataToTransferQueueItem(value as TransferQueue, data));
    });

    // cache the merged list of fetched queues with real time data
    transferQueues.current = tempQueues;

    // Apply filter and sort alphabetically
    filterQueues();
  };

  const queueToEntry = (queue: TransferQueue): DirectoryEntry => {
    const { total_eligible_workers: eligible, total_available_workers: available, total_tasks: tasks } = queue;

    const agentsAvailable = !available || !eligible ? na : `${available}/${eligible}`;
    // eslint-disable-next-line no-eq-null, eqeqeq
    const tasksInQueue = tasks != null && tasks >= 0 ? `${tasks}` : na;

    const queue_tooltip = showRealTimeQueueData()
      ? templates[StringTemplates.QueueTooltip]({ agentsAvailable, tasksInQueue })
      : `${queue.name}`;

    return {
      cold_transfer_enabled: isColdTransferEnabled,
      warm_transfer_enabled: isWarmTransferEnabled,
      label: queue.name,
      address: queue.sid,
      tooltip: queue_tooltip,
      type: 'queue',
      key: uuidv4(),
    };
  };

  // function to filter the generatedQueueList and trigger a re-render
  const filterQueues = () => {
    const updatedQueues = transferQueues.current
      .filter((queue) => {
        if (showOnlyQueuesWithAvailableWorkers()) {
          // returning only queues with available workers
          // or queues where meta data is not available
          return queue.total_available_workers === null || queue.total_available_workers > 0;
        }
        return queue;
      })
      .filter((queue) => {
        const attributes = workerClient?.attributes as CustomWorkerAttributes;
        // This will work with both "filterString" and ["filter1", "filter2"] formats.
        const enforcedQueueFilter = attributes?.enforcedQueueFilter;
        if (enforceQueueFilterFromWorker() && enforcedQueueFilter) {
          if (Array.isArray(enforcedQueueFilter)) {
            return enforcedQueueFilter.some(filter => 
              queue.name.toLocaleLowerCase().includes(filter.toLocaleLowerCase())
            );
          }
          return queue.name.toLocaleLowerCase().includes(enforcedQueueFilter.toLocaleLowerCase());
        }
        return queue;
      })
      .sort((a: TransferQueue, b: TransferQueue) => (a.name > b.name ? 1 : -1))
      .map(queueToEntry);

    setFilteredQueues(updatedQueues);
  };

  const onTransferQueueClick = (entry: DirectoryEntry, transferOptions: TransferClickPayload) => {
    if (isNativeDigitalXferEnabled() && TaskHelper.isCBMTask(props.task) && transferOptions.mode !== 'WARM') {
      const {
        flexInteractionSid: interactionSid,
        flexInteractionChannelSid: channelSid,
        conversationSid,
      } = props.task.attributes;
      (async () => {
        const agent = await ConversationsHelper.getMyParticipant(props.task);
        Actions.invokeAction('StartChannelTransfer', {
          instanceSid: Manager.getInstance().serviceConfiguration.flex_instance_sid,
          interactionSid,
          channelSid,
          fromSid: agent?.participantSid,
          toSid: entry.address,
          conversationSid,
        });
      })();
      return;
    }
    Actions.invokeAction('TransferTask', {
      task: props.task,
      targetSid: entry.address,
      options: transferOptions,
    });
  };

  // initial render
  useEffect(() => {
    // fetch the queues from the taskrouter sdk on initial render
    fetchSDKTaskQueues().catch(logger.error);

    // fetch the queues from the insights client on initial render
    fetchInsightsQueueData().catch(logger.error);

    return () => {
      if (queueMap.current) {
        queueMap.current.close();
      }
    };
  }, []);

  // hook when fetchedQueues, insightsQueues are updated
  useEffect(() => {
    generateTransferQueueList();
  }, [fetchedQueues, insightsQueues]);

  useEffect(() => {
    if (transferQueues.current.length > 0) {
      setIsLoading(false);
    }
  }, [filteredQueues]);

  return (
    <DirectoryTab
      entries={filteredQueues}
      isLoading={isLoading}
      onTransferClick={onTransferQueueClick}
      noEntriesMessage={templates[StringTemplates.NoQueuesAvailable]}
    />
  );
};

export default withTaskContext(QueueDirectoryTab);
