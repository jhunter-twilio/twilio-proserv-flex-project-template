import { Actions, Manager } from '@twilio/flex-ui';

import { getSystemActivityNames } from '../config';
import FlexHelper from '../../../utils/flex-helper';

// collect the configured activity names from the configuration
const systemActivityNames = getSystemActivityNames();

// create a string array of these system names for
// comparison later exporrted for StartOutboundCall
export const rerservedSystemActivities: string[] = [
  systemActivityNames.onATask,
  systemActivityNames.onATaskNoAcd,
  systemActivityNames.wrapup,
  systemActivityNames.wrapupNoAcd,
];

export const isWorkerCurrentlyInASystemActivity = async (): Promise<boolean> => {
  return rerservedSystemActivities
    .map((a) => a.toLowerCase())
    .includes((await FlexHelper.getWorkerActivityName())?.toLowerCase());
};

interface PendingActivity {
  name: string;
}

interface CallbackPromise {
  resolve: any;
  reject: any;
  available?: boolean;
}

class ActivityManager {
  private pendingActivityChangeItemKey = `pendingActivityChange_${
    Manager.getInstance().serviceConfiguration.account_sid
  }`;

  private currentRequests: Array<CallbackPromise>;

  private runningRequests: number;

  private maxConcurrentRequests: number;

  constructor(maxConcurrentRequests = 1) {
    this.currentRequests = [];
    this.runningRequests = 0;
    this.maxConcurrentRequests = maxConcurrentRequests;
    this.enforceEvaluatedState();
  }

  // expose method to cache an activity to change to
  storePendingActivityChange = (activityName: string) => {
    // Pulling out only the relevant activity properties to avoid
    // a circular structure error in JSON.stringify()
    const pendingActivityChange = {
      name: activityName,
    } as PendingActivity;

    localStorage.setItem(this.pendingActivityChangeItemKey, JSON.stringify(pendingActivityChange));
  };

  // exposed method to evaluate which state
  // we should be in and whether we should update it.
  // overrideAvailability is passed only when we want to
  // change the availability we are currently in. For example
  // when in a reserved system state but want to go unavailable
  // this method uses a semaphore to enforce a single execution
  // at a time.
  enforceEvaluatedState = async () => {
    return new Promise(async (resolve, reject) => {
      this.currentRequests.push({
        resolve,
        reject,
      } as CallbackPromise);
      await this.#tryNext();
    });
  };

  enforceStateAfterSelectingActivity = async (available: boolean) => {
    return new Promise(async (resolve, reject) => {
      this.currentRequests.push({
        resolve,
        reject,
        available,
      } as CallbackPromise);
      await this.#tryNext();
    });
  };

  // externally exposed for use in StartOutboundCall
  setWorkerActivity = async (activityName: string) => {
    if (activityName === this.getPendingActivity()?.name) this.#clearPendingActivity();
    Actions.invokeAction('SetActivity', {
      activityName,
      isInvokedByPlugin: true,
      options: {
        rejectPendingReservations: true,
      },
    });

    await this.#waitForWorkerActivityChange(activityName);
  };

  // externally exposed for PendingActivityComponent
  getPendingActivity = (): PendingActivity => {
    const item = localStorage.getItem(this.pendingActivityChangeItemKey);
    const pendingActivity: PendingActivity = item && JSON.parse(item);
    return pendingActivity;
  };

  #tryNext = async () => {
    if (!this.currentRequests.length) {
    } else if (this.runningRequests < this.maxConcurrentRequests) {
      const { resolve, reject, available } = this.currentRequests.shift() as CallbackPromise;
      this.runningRequests += 1;
      const req = this.#enforceEvaluatedState(available);
      req
        .then((res) => resolve(res))
        .catch((err) => reject(err))
        .finally(() => {
          this.runningRequests -= 1;
          this.#tryNext();
        });
    }
  };

  // performs the algorithm to evaluate whether we should switch Activity and
  // moves them if neccessary
  #enforceEvaluatedState = async (availability?: boolean) => {
    const { available } = systemActivityNames;

    const currentWorkerActivity = await FlexHelper.getWorkerActivity();

    // when evaluating the next state, we need to know whether we want to be on or off acd
    // availability is used when manually selecting the activity from the agent drop down
    const acdAvailabilityStatus = availability === undefined ? currentWorkerActivity?.available || false : availability;

    // evaluate what the new activity/state should be
    const newActivity = await this.#evaluateNewState(acdAvailabilityStatus);

    // determine if we need to cache the state we are leaving
    // we only cache non reserved system states and evaluations that would
    // put is in a different state.
    const onSystemActivity = await isWorkerCurrentlyInASystemActivity();
    const currentActivity = currentWorkerActivity?.name || 'UNKNOWN';

    // if leaving the current activity save the current state for later
    // as long as we are not oon a system activity
    if (newActivity !== currentActivity && !onSystemActivity)
      this.storePendingActivityChange(currentWorkerActivity?.name || available);

    // update the activity/state only if we are not currently in that activity/state.
    if (newActivity !== currentWorkerActivity?.name) await this.setWorkerActivity(newActivity);
  };

  // evaluates which state we should be in given an availability status
  #evaluateNewState = async (newAvailabilityStatus: boolean): Promise<string> => {
    const { available, onATask, onATaskNoAcd, wrapup, wrapupNoAcd } = systemActivityNames;

    const selectedTaskStatus = FlexHelper.getSelectedTaskStatus();
    const pendingActivity = this.getPendingActivity();
    const isInSystemActivity = await isWorkerCurrentlyInASystemActivity();

    const hasPendingTasks = await FlexHelper.doesWorkerHaveReservationsInState(FlexHelper.RESERVATION_STATUS.PENDING);
    const hasAcceptedTasks = await FlexHelper.doesWorkerHaveReservationsInState(FlexHelper.RESERVATION_STATUS.ACCEPTED);
    const hasWrappingTasks = await FlexHelper.doesWorkerHaveReservationsInState(FlexHelper.RESERVATION_STATUS.WRAPPING);

    // flex won't let us change activity while on a pending task
    // other than to an offline activity which will reject the task
    // for this reason it is recommended to have auto accept configured
    // as part of the agent automation feature and take note that
    // selecting a task while a pending task is out there
    // will fail to switch to the appropriate "on a task" or "wrapup" state.
    if (hasPendingTasks && newAvailabilityStatus) return FlexHelper.getWorkerActivityName();
    if (hasPendingTasks && (await FlexHelper.doesWorkerHaveAPendingOutboundCall()))
      return FlexHelper.getWorkerActivityName();

    if (selectedTaskStatus === FlexHelper.RESERVATION_STATUS.ACCEPTED) {
      if (newAvailabilityStatus) return onATask;
      if (!newAvailabilityStatus) return onATaskNoAcd;
    } else if (selectedTaskStatus === FlexHelper.RESERVATION_STATUS.WRAPPING) {
      if (newAvailabilityStatus) return wrapup;
      if (!newAvailabilityStatus) return wrapupNoAcd;
    } else {
      // fallback behavior if no task is selected but
      // tasks are in flight
      if (hasAcceptedTasks && newAvailabilityStatus) return onATask;
      if (hasAcceptedTasks && !newAvailabilityStatus) return onATaskNoAcd;
      if (hasWrappingTasks && newAvailabilityStatus) return wrapup;
      if (hasWrappingTasks && !newAvailabilityStatus) return wrapupNoAcd;
      if (pendingActivity) return pendingActivity.name;
      if (!hasAcceptedTasks && !hasWrappingTasks && !hasPendingTasks && isInSystemActivity) return available;
    }

    // if none of the above iss true, no state change neccessary
    return FlexHelper.getWorkerActivityName();
  };

  #clearPendingActivity = (): void => {
    localStorage.removeItem(this.pendingActivityChangeItemKey);
  };

  #waitForWorkerActivityChange = async (activityName: string | undefined, workerSid?: string) =>
    new Promise(async (resolve) => {
      if (activityName && activityName === (await FlexHelper.getWorkerActivityName(workerSid))) {
        resolve(null);
      } else {
        console.debug('WorkerState, waitForWorkerActivityChange, waiting for worker activity SID to be', activityName);
        // Arbitrary maxWaitTime value. Trying to balance allowing for an unexpected
        // delay updating worker activity while not holding up the calling function too long
        const maxWaitTime = 3000;
        const waitBetweenChecks = 100;
        let activityCheckCount = 0;
        const activityCheckInterval = setInterval(async () => {
          if (waitBetweenChecks * activityCheckCount > maxWaitTime) {
            console.warn('Timed out waiting for worker activity SID to be', activityName);
            clearInterval(activityCheckInterval);
            resolve(null);
          } else if (activityName === (await FlexHelper.getWorkerActivityName(workerSid))) {
            clearInterval(activityCheckInterval);
            resolve(null);
          }
          activityCheckCount += 1;
        }, waitBetweenChecks);
      }
    });
}

const ActivityManagerSingleton = new ActivityManager();

export default ActivityManagerSingleton;
