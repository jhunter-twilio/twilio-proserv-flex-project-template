import * as Flex from '@twilio/flex-ui';

import { FlexActionEvent, FlexAction } from '../../../../types/feature-loader';
import ActivityManager, { getCurrentWorkerActivity, isCurrentlyInASystemActivity } from '../../helper/ActivityManager';
import { getSystemActivityNames } from '../../config';

export const actionEvent = FlexActionEvent.before;
export const actionName = FlexAction.StartOutboundCall;
export const actionHook = function changeWorkerActivityBeforeOutboundCall(flex: typeof Flex, _manager: Flex.Manager) {
  flex.Actions.addListener(`${actionEvent}${actionName}`, async (_payload, _abortFunction) => {
    // for outbound calls, because we want to change activity
    // immediately but the task comes in on a pending state
    // and only changes to accepted when answered, we have to manage the state
    // manually prior to starting the call

    // the ideal solution would be to handle all state management in
    // AcitivtyManager.#evaluateNewState however as this is a blocking
    // operation it causes the outbound call to fail
    const { onATask, onATaskNoAcd } = getSystemActivityNames();
    const workerActivity = getCurrentWorkerActivity();
    const newActivity = workerActivity?.available ? onATask : onATaskNoAcd;

    if (!isCurrentlyInASystemActivity()) ActivityManager.storePendingActivityChange(workerActivity?.name || 'UNKNOWN');
    await ActivityManager.setWorkerActivity(newActivity);
  });
};
