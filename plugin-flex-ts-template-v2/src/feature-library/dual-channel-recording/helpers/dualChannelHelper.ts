import { ConferenceParticipant, ITask, Manager, TaskHelper } from '@twilio/flex-ui';

import TaskRouterService from '../../../utils/serverless/TaskRouter/TaskRouterService';
import { FetchedRecording } from '../../../types/serverless/twilio-api';
import { getChannelToRecord, getExcludedAttributes, getExcludedQueues } from '../config';
import DualChannelService from './DualChannelService';
import logger from '../../../utils/logger';

const manager = Manager.getInstance();

export const canRecordTask = (task: ITask): boolean => {
  if (getExcludedQueues().findIndex((queue) => queue === task.queueName || queue === task.queueSid) >= 0) {
    return false;
  }

  for (const attribute of getExcludedAttributes()) {
    if (task.attributes[attribute.key] === attribute.value) {
      return false;
    }
  }

  return true;
};

const addCallDataToTask = async (task: ITask, callSid: string | null, recording: FetchedRecording | null) => {
  const { conference } = task;

  let newAttributes = {} as any;
  let shouldUpdateTaskAttributes = false;

  if (TaskHelper.isOutboundCallTask(task)) {
    shouldUpdateTaskAttributes = true;
    // Last Reviewed: 2021/02/01 (YYYY/MM/DD)
    // Outbound calls initiated from Flex (via StartOutboundCall Action)
    // do not include call_sid and conference metadata in task attributes
    newAttributes.conference = { sid: conference?.conferenceSid };

    if (callSid) {
      // callSid will be undefined if the outbound call was ended before
      // the called party answered
      newAttributes.call_sid = callSid;
    }
  }

  if (recording) {
    const { dateUpdated, sid: reservationSid } = task;
    shouldUpdateTaskAttributes = true;

    const state = manager.store.getState();
    const flexState = state && state.flex;
    const workerState = flexState && flexState.worker;
    const accountSid = workerState && workerState.source?.accountSid;

    const { sid: recordingSid } = recording;
    const twilioApiBase = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}`;
    const recordingUrl = `${twilioApiBase}/Recordings/${recordingSid}`;

    // Using one second before task updated time to workaround a Flex Insights
    // bug if the recording start time is after the reservation.accepted event
    const recordingStartTime = new Date(dateUpdated).valueOf() - 1000;

    // NOTE: This schema is applicable if recording the customer leg since there
    // is a single recording for the entire call. If instead you're recording the
    // worker leg, which could result in multiple recordings per call in the case
    // of a transfer, then you'll want to use the reservation_attributes pattern:
    // https://www.twilio.com/docs/flex/developer/insights/custom-media-attached-conversations#add-media-links
    const mediaObj: any = {
      url: recordingUrl,
      type: 'VoiceRecording',
      start_time: recordingStartTime,
      channels: ['customer', 'others'],
    };

    switch (getChannelToRecord()) {
      case 'worker':
        let existingMedia: any[] = [];
        if (
          task?.attributes?.reservation_attributes &&
          task?.attributes?.reservation_attributes[reservationSid]?.media
        ) {
          existingMedia = [...task.attributes.reservation_attributes[reservationSid].media];
          mediaObj.title = `Voice Recording ${existingMedia.length + 1}`;
          mediaObj.start_time = new Date().valueOf();
        }
        newAttributes = {
          ...newAttributes,
          reservation_attributes: {
            [reservationSid]: {
              media: [...existingMedia, mediaObj],
            },
          },
        };
        break;
      case 'customer':
        newAttributes.conversations = {
          media: [mediaObj],
        };
        break;
      default:
        break;
    }
  }

  if (shouldUpdateTaskAttributes) {
    try {
      await TaskRouterService.updateTaskAttributes(task.taskSid, newAttributes);
    } catch (error: any) {
      logger.error('[dual-channel-recording] Error updating task attributes', error);
    }
  }
};

const isTaskActive = (task: ITask) => {
  const { sid: reservationSid, taskStatus } = task;
  if (taskStatus === 'canceled') {
    return false;
  }
  return manager.workerClient?.reservations.has(reservationSid);
};

export const getWorkerParticipant = (participants: ConferenceParticipant[]) => {
  return participants
    .sort((a, b) => (b.mediaProperties?.sequenceNumber || 0) - (a.mediaProperties?.sequenceNumber || 0))
    .find((p) => p.participantType === 'worker' && p.isCurrentWorker && p.status === 'joined');
};

const getParticipantToRecord = (channel: 'worker' | 'customer', participants: ConferenceParticipant[]) => {
  if (channel === 'worker') {
    return getWorkerParticipant(participants);
  }

  return participants.find((p) => p.participantType === 'customer');
};

const waitForConferenceParticipants = async (task: ITask): Promise<ConferenceParticipant[]> =>
  new Promise((resolve) => {
    const waitTimeMs = 100;
    // For outbound calls, the customer participant doesn't join the conference
    // until the called party answers. Need to allow enough time for that to happen.
    const maxWaitTimeMs = 60000;
    let waitForConferenceInterval: null | NodeJS.Timeout = setInterval(async () => {
      const { conference } = task;

      if (!isTaskActive(task)) {
        logger.debug('[dual-channel-recording] Call canceled, clearing waitForConferenceInterval');
        if (waitForConferenceInterval) {
          clearInterval(waitForConferenceInterval);
          waitForConferenceInterval = null;
        }
        return;
      }
      if (conference === undefined) {
        return;
      }
      let { participants } = conference;
      if (Array.isArray(participants) && participants.length < 2) {
        return;
      }

      const participantToRecord = getParticipantToRecord(getChannelToRecord(), participants);

      if (!participantToRecord) {
        return;
      }

      if (!participantToRecord?.callSid) {
        logger.debug('[dual-channel-recording] Looking for call SID');
        // Flex sometimes does not provide callSid in task conference participants, check if it is in the Redux store instead
        const storeConference = manager.store.getState().flex.conferences.states.get(task.taskSid);

        if (!storeConference || !storeConference.source) {
          return;
        }

        participants = storeConference.source.participants;

        const storeParticipant = getParticipantToRecord(getChannelToRecord(), participants);

        if (!storeParticipant?.callSid) {
          logger.info(
            `[dual-channel-recording] ${getChannelToRecord()} participants joined conference, waiting for call SID`,
          );
          return;
        }
      }

      logger.debug(`[dual-channel-recording] ${getChannelToRecord()} participants joined conference`);
      if (waitForConferenceInterval) {
        clearInterval(waitForConferenceInterval);
        waitForConferenceInterval = null;
      }

      resolve(participants);
    }, waitTimeMs);

    setTimeout(() => {
      if (waitForConferenceInterval) {
        logger.info(
          `[dual-channel-recording] ${getChannelToRecord()} participant didn't show up within ${
            maxWaitTimeMs / 1000
          } seconds`,
        );

        if (waitForConferenceInterval) {
          clearInterval(waitForConferenceInterval);
          waitForConferenceInterval = null;
        }

        resolve([]);
      }
    }, maxWaitTimeMs);
  });

const waitForActiveCall = async (task: ITask): Promise<string> =>
  new Promise((resolve) => {
    const waitTimeMs = 100;
    // For internal calls, there is no conference, so we only have the active call to work with.
    // Wait here for the call to establish.
    const maxWaitTimeMs = 60000;
    let waitForCallInterval: null | NodeJS.Timeout = setInterval(async () => {
      if (!isTaskActive(task)) {
        logger.debug('[dual-channel-recording] Call canceled, clearing waitForCallInterval');
        if (waitForCallInterval) {
          clearInterval(waitForCallInterval);
          waitForCallInterval = null;
        }
        return;
      }

      const { activeCall } = manager.store.getState().flex.phone;

      if (!activeCall) {
        return;
      }

      if (waitForCallInterval) {
        clearInterval(waitForCallInterval);
        waitForCallInterval = null;
      }

      resolve(activeCall.parameters.CallSid);
    }, waitTimeMs);

    setTimeout(() => {
      if (waitForCallInterval) {
        logger.info(`[dual-channel-recording] Call didn't activate within ${maxWaitTimeMs / 1000} seconds`);

        if (waitForCallInterval) {
          clearInterval(waitForCallInterval);
          waitForCallInterval = null;
        }

        resolve('');
      }
    }, maxWaitTimeMs);
  });

export const addMissingCallDataIfNeeded = async (task: ITask) => {
  if (!task) {
    return;
  }
  const { attributes } = task;
  const { conference } = attributes;

  if (TaskHelper.isOutboundCallTask(task) && !conference) {
    // Only worried about outbound calls since inbound calls automatically
    // have the desired call and conference metadata
    await addCallDataToTask(task, null, null);
  }
};

const startRecording = async (task: ITask, callSid: string | undefined) => {
  if (!callSid) {
    logger.warn('[dual-channel-recording] Unable to determine call SID for recording');
    return;
  }

  try {
    const recording = await DualChannelService.startDualChannelRecording(callSid);
    await addCallDataToTask(task, callSid, recording);
  } catch (error: any) {
    logger.error('[dual-channel-recording] Unable to start dual channel recording.', error);
  }
};

export const recordInternalCall = async (task: ITask) => {
  // internal call - always record based on call SID, as conference state is unknown by Flex
  // Record only the outbound leg to prevent duplicate recordings
  logger.debug('[dual-channel-recording] Waiting for internal call to begin');
  const callSid = await waitForActiveCall(task);
  logger.info(`[dual-channel-recording] Recorded internal call: ${callSid}`);

  await startRecording(task, callSid);
};

export const recordExternalCall = async (task: ITask) => {
  // We want to wait for all participants (customer and worker) to join the
  // conference before we start the recording
  logger.debug('[dual-channel-recording] Waiting for customer and worker to join the conference');
  const participants = await waitForConferenceParticipants(task);
  const participantLeg = getParticipantToRecord(getChannelToRecord(), participants);

  logger.info('[dual-channel-recording] Recorded Participant: ', participantLeg);

  if (!participantLeg) {
    logger.warn('[dual-channel-recording] No customer or worker participant. Not starting the call recording');
    return;
  }

  const { callSid } = participantLeg;

  await startRecording(task, callSid);
};

export const initiateRecording = (task: ITask) => {
  if (!TaskHelper.isCallTask(task)) {
    return;
  }

  const { attributes } = task;
  const { client_call, direction, conversations } = attributes;

  if (conversations && conversations.media && getChannelToRecord() === 'customer') {
    // This indicates a recording has already been started for this call
    // and all relevant metadata should already be on task attributes
    return;
  }

  if (!canRecordTask(task)) {
    logger.info(`[dual-channel-recording] Skipping recording for task excluded by configuration: ${task.sid}`);
    return;
  }

  if (client_call && direction === 'outbound') {
    // internal call - always record based on call SID, as conference state is unknown by Flex
    // Record only the outbound leg to prevent duplicate recordings
    // Do not await so that event processing is not blocked
    recordInternalCall(task);
  } else if (client_call) {
    // internal call, inbound leg - skip recording this leg
    logger.info(`[dual-channel-recording] Skipping recording for inbound internal call ${task.sid}`);
  } else {
    // External call
    // Do not await so that event processing is not blocked
    recordExternalCall(task);
  }
};
