import * as Flex from "@twilio/flex-ui";
import ChatTransferOrchestration from '../../feature-extensions/chat-transfer/flex-hooks/chat-orchestrator'

export default (flex: typeof Flex, manager: Flex.Manager) => {
  ChatTransferOrchestration(flex, manager);
}

