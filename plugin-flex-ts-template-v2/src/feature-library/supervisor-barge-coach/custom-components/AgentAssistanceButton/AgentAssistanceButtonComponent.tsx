import * as React from 'react';
import { TaskHelper, useFlexSelector, ITask, IconButton } from '@twilio/flex-ui';
import { useDispatch, useSelector } from 'react-redux';
import { AppState, reduxNamespace } from '../../../../flex-hooks/states'
import { Actions } from "../../flex-hooks/states/SupervisorBargeCoach"
import { Flex, Stack } from "@twilio-paste/core";

// Used for Sync Docs
import { SyncDoc } from '../../utils/sync/Sync'

type AgentAssistanceButton = {
  task: ITask
}

export const AgentAssistanceButton = ({task}: AgentAssistanceButton) => {
  const dispatch = useDispatch();

  const {
    agentAssistanceButton, 
  } = useSelector((state: AppState) => state[reduxNamespace].supervisorBargeCoach);

  const agentWorkerSID = useFlexSelector(state => state?.flex?.worker?.worker?.sid);
  const agentFN = useFlexSelector(state => state?.flex?.worker?.attributes?.full_name);
  const selectedTaskSID = useFlexSelector(state => state?.flex?.view?.selectedTaskSid);

  // On click we will be pulling the conference SID, toggling the agent assistance button respectively,
  // and updating the sync doc with the agent's asssistance status (either adding or removing them)
  const agentAssistanceClick = () => {
    const conference = task && task.conference;
    const conferenceSID = conference?.conferenceSid;
    if (agentAssistanceButton) {
      dispatch(Actions.setBargeCoachStatus({ 
        agentAssistanceButton: false
      }));
      // Caching this to help with browser refresh recovery
      localStorage.setItem('cacheAgentAssistState','false');

      // Updating the Sync Doc to remove the agent from the assistance array
      SyncDoc.initSyncDocAgentAssistance(
        agentWorkerSID, 
        agentFN, 
        conferenceSID, 
        selectedTaskSID, 
        'remove'
      );
    } else {
      dispatch(Actions.setBargeCoachStatus({ 
        agentAssistanceButton: true
      }));

      // Caching this if the browser is refreshed while the agent actively had agent assistance up
      // We will use this to clear up the Sync Doc and the Agent Alert
      localStorage.setItem('cacheAgentAssistState',"true");

      // Updating the Sync Doc to add the agent from the assistance array
      SyncDoc.initSyncDocAgentAssistance(
        agentWorkerSID, 
        agentFN, 
        conferenceSID, 
        selectedTaskSID, 
        'add'
      );
    }
  }

  // Return the agent assistance button, disable if the call isn't live
  // Toggle the icon based on agent assistance status
  const isLiveCall = TaskHelper.isLiveCall(task);
  return (
    <Flex hAlignContent="center" vertical>
      <Stack orientation="horizontal" spacing="space30" element="AGENT_ASSISTANCE_BUTTON_BOX">
        <IconButton
          icon={ agentAssistanceButton ? 'HelpBold' : 'Help' }
          disabled={!isLiveCall}
          onClick={agentAssistanceClick}
          title={ agentAssistanceButton ? "Turn off Assistance" : "Ask for Assistance" }
          variant="secondary"
          style={{width:'44px',height:'44px'}}
        >{ agentAssistanceButton ? "Assistance Required" : "" }</IconButton>
        { !isLiveCall ? "" : agentAssistanceButton && isLiveCall ? 'Turn off Assistance' : 'Ask for Assistance'}
      </Stack>
    </Flex>
  );
}
