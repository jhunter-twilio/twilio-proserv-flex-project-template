import * as Flex from '@twilio/flex-ui';
import ChatTransfer from '../../feature-library/chat-transfer/flex-hooks/notifications/ChatTransfer'

export default (flex: typeof Flex, manager: Flex.Manager) => {
  ChatTransfer(flex, manager);
}
