import * as Flex from "@twilio/flex-ui";
import taskEndedHandler from "../../helpers/taskEndedHandler";
import { FlexEvent } from "../../../../types/feature-loader/FlexEvent";

export const eventName = FlexEvent.taskRescinded;
export const eventHook = (flex: typeof Flex, manager: Flex.Manager, task: Flex.ITask) => {
  taskEndedHandler(task, eventName);
};
