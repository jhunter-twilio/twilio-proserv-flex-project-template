import * as Flex from "@twilio/flex-ui";
import { FlexEvent } from "../../../types/manager/FlexEvent";
import ActivityReservationHandlerLoaded from "../../../feature-library/activity-reservation-handler/flex-hooks/events/pluginsLoaded";
import CallbackAndVoicemailLoaded from "../../../feature-library/callback-and-voicemail/flex-hooks/events/pluginsLoaded";
import CallerIdLoaded from "../../../feature-library/caller-id/flex-hooks/events/pluginsLoaded";
import ConferenceLoaded from "../../../feature-library/conference/flex-hooks/events/pluginsLoaded";
import OmniChannelCapacityManagementLoaded from "../../../feature-library/omni-channel-capacity-management/flex-hooks/events/pluginsLoaded";
import ScrollableActivitiesLoaded from "../../../feature-library/scrollable-activities/flex-hooks/events/pluginsLoaded";
import EnhancedCRMContainer from "../../../feature-library/enhanced-crm-container/flex-hooks/events/pluginsLoaded";


export default (manager: Flex.Manager) => {
  manager.events.addListener(FlexEvent.pluginsLoaded, () =>{
    ActivityReservationHandlerLoaded(FlexEvent.pluginsLoaded);
    CallbackAndVoicemailLoaded(FlexEvent.pluginsLoaded);
    CallerIdLoaded(FlexEvent.pluginsLoaded);
    ConferenceLoaded(FlexEvent.pluginsLoaded);
    OmniChannelCapacityManagementLoaded(FlexEvent.pluginsLoaded);
    ScrollableActivitiesLoaded(FlexEvent.pluginsLoaded);
    EnhancedCRMContainer(FlexEvent.pluginsLoaded);
  });
};
