import * as Flex from "@twilio/flex-ui";
import { isColdTransferEnabled } from "../../index";
import { TransferActionPayload } from "../../types/ActionPayloads";
import { FlexActionEvent, FlexAction } from "../../../../types/feature-loader/FlexAction";

export const actionEvent = FlexActionEvent.before;
export const actionName = FlexAction.TransferTask;
// invoke the custom chatTransferTask action if a cbm task otherwise carry on
export const actionHook = function handleChatTransfer(flex: typeof Flex, manager: Flex.Manager) {
  if (!isColdTransferEnabled()) return;

  flex.Actions.addListener(
    "beforeTransferTask",
    (payload: TransferActionPayload, abortFunction: any) => {
      if (flex.TaskHelper.isCBMTask(payload.task)) {
        // native action handler would fail for chat task so abort the action
        abortFunction();
        // Execute Chat Transfer Task
        flex.Actions.invokeAction("ChatTransferTask", payload);
      }
    }
  );
}
