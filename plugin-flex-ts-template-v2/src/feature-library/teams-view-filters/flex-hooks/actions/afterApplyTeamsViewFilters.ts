import * as Flex from '@twilio/flex-ui';
import { shouldLogFilters } from "../../config";
import { AppliedFilter } from '@twilio/flex-ui/src/state/Supervisor/SupervisorState.definitions';
import { FlexActionEvent, FlexAction } from "../../../../types/feature-loader";

export interface ApplyTeamsViewFiltersPayload {
  extraFilterQuery?:	string	
  filters:	Array<AppliedFilter>
}

export const actionEvent = FlexActionEvent.after;
export const actionName = FlexAction.ApplyTeamsViewFilters;
export const actionHook = function logApplyListFilters(flex: typeof Flex, manager: Flex.Manager) {
  if(!shouldLogFilters()) return;

  Flex.Actions.addListener(`${actionEvent}${actionName}`, async (payload, abortFunction) => {
    console.log("Team view filters applied", payload);
  })
}