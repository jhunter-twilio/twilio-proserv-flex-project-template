import * as Flex from "@twilio/flex-ui";
import ActivityReservationHandler from "../../feature-library/activity-reservation-handler/flex-hooks/notifications/ActivityReservationHandler";
import ActivitySkillFilter from "../../feature-library/activity-skill-filter/flex-hooks/notifications/ActivitySkillFilter";
import Conference from "../../feature-library/conference/flex-hooks/notifications/Conference";
import ChatTransfer from "../../feature-library/chat-transfer/flex-hooks/notifications/TransferResult";
import TeamsViewfilters from "../../feature-library/teams-view-filters/flex-hooks/notifications/TeamViewQueueFilter"

const notificationsToRegister: ((
  flex: typeof Flex,
  manager: Flex.Manager
) => void)[] = [ActivityReservationHandler, ActivitySkillFilter, Conference, ChatTransfer, TeamsViewfilters];

export default notificationsToRegister;
