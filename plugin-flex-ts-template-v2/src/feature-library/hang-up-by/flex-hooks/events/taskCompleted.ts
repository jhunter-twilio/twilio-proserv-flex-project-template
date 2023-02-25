import * as Flex from "@twilio/flex-ui";
import * as HangUpByHelper from "../../helpers/hangUpBy";
import { HangUpBy } from '../../enums/hangUpBy';
import { FlexEvent } from "../../../../types/feature-loader/FlexEvent";

export const eventName = FlexEvent.taskCompleted;
export const eventHook = async (flex: typeof Flex, manager: Flex.Manager, task: Flex.ITask) => {
  let currentHangUpBy = HangUpByHelper.getHangUpBy()[task.sid];
  
  if (currentHangUpBy === HangUpBy.ColdTransfer || currentHangUpBy === HangUpBy.WarmTransfer) {
    // reset task attribute to Customer, as the task lives on after this transfer
    // Insights has grabbed the [Cold/Warm]Transfer value already at this point
    
    // Double-check that the customer is still here
    if (await HangUpByHelper.hasAnotherNonWorkerJoined(task)) {
      currentHangUpBy = HangUpBy.Customer;
      await HangUpByHelper.setHangUpByAttribute(task.taskSid, task.attributes, currentHangUpBy);
    }
  }
  
  // prevent ballooning of storage
  HangUpByHelper.clearHangUpBy(task.sid);
};
