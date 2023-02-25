import * as Flex from "@twilio/flex-ui";
import ConferenceService from "../../../conference/utils/ConferenceService";
import { isInternalCall } from '../../helpers/internalCall';
import { FlexActionEvent, FlexAction } from "../../../../types/feature-loader/FlexAction";

export const actionEvent = FlexActionEvent.before;
export const actionName = FlexAction.UnholdCall;
export const actionHook = function handleInternalUnholdCall(flex: typeof Flex, manager: Flex.Manager) {
  flex.Actions.addListener("beforeUnholdCall", async (payload, abortFunction) => {
    if (!isInternalCall(payload.task)) {
      return;
    }
    
    const { task } = payload;
    const conference = task.conference
      ? task.conference.conferenceSid
      : task.attributes.conferenceSid;
    
    const participant = task.attributes.conference.participants
      ? task.attributes.conference.participants.worker
      : task.attributes.worker_call_sid;
    
    await ConferenceService.unholdParticipant(conference, participant);
    abortFunction();
  });
}
