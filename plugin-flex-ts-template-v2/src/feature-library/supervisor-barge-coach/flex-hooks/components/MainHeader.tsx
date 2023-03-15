import * as Flex from '@twilio/flex-ui';
import SupervisorAlertButton from "../../custom-components/SupervisorAlertButton"
import { isSupervisorAlertToggleEnabled } from '../..';

export function addSupervisorAlert (flex: typeof Flex, manager: Flex.Manager) {

  if(!isSupervisorAlertToggleEnabled()) return;
  // Pull back the user roles disable this component if it exists
  const myWorkerRoles = manager.store.getState().flex?.worker?.worker?.attributes?.roles;
  // Update the role names if you wish to inlude this feature for more role types
  if(myWorkerRoles.includes('admin' || 'supervisor')) {
    flex.MainHeader.Content.add(
      <SupervisorAlertButton key="agent-assistance-button"/>, {
        align: 'start'
    });
  }
}

