import * as Flex from '@twilio/flex-ui';
import * as React from 'react';
import { ITask, TaskHelper, StateHelper } from '@twilio/flex-ui';

import { reduxNamespace } from '../../../../utils/state';
import { isColdTransferEnabled, isMultiParticipantEnabled } from '../../config';
import TransferButton from '../../custom-components/TransferButton';
import LeaveChatButton from '../../custom-components/LeaveChatButton';
import { countOfOutstandingInvitesForConversation } from '../../helpers/inviteTracker';
import { FlexComponent } from '../../../../types/feature-loader';

interface Props {
  task: ITask;
}
export const componentName = FlexComponent.TaskCanvasHeader;
export const componentHook = function addConvTransferButtons(flex: typeof Flex, props: any) {
  if (!isColdTransferEnabled() && !isMultiParticipantEnabled()) return;

  flex.TaskCanvasHeader.Content.add(<TransferButton key="conversation-transfer-button" />, {
    sortOrder: 1,
    if: ({ task }) => TaskHelper.isCBMTask(task) && task.taskStatus === 'assigned',
  });

  if (!isMultiParticipantEnabled()) return;

  const replaceEndTaskButton = (task: ITask) => {
    if (TaskHelper.isCBMTask(task) && task.taskStatus === 'assigned') {
      const interactionParticipants =
        props?.store?.getState()?.[reduxNamespace]?.supervisorBargeCoach?.interactionParticipants;
      // more than two participants or are there any active invites?
      const conversationState = StateHelper.getConversationStateForTask(task);
      if (
        conversationState &&
        (interactionParticipants > 2 || countOfOutstandingInvitesForConversation(conversationState))
      ) {
        return true;
      }
    }
    return false;
  };

  flex.TaskCanvasHeader.Content.add(<LeaveChatButton key="leave-chat" />, {
    if: ({ task }: Props) => replaceEndTaskButton(task),
  });

  flex.TaskCanvasHeader.Content.remove('actions', { if: ({ task }: Props) => replaceEndTaskButton(task) });
};
