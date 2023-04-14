const { prepareFlexFunction, returnStandardResponse } = require(Runtime.getFunctions()['common/helpers/function-helper'].path);
const ConferenceOperations = require(Runtime.getFunctions()['common/twilio-wrappers/conference-participant'].path);

const requiredParameters = [
  { key: 'conferenceSid', purpose: 'conference sid to target for changes' },
  {
    key: 'participantSid',
    purpose: 'participant sid to target for conference changes',
  },
  {
    key: 'muted',
    purpose: 'boolean to determine the muted status of the participant in the conference',
  },
  {
    key: 'coaching',
    purpose: 'boolean to determine the coaching status of the participant in the conference',
  },
];

exports.handler = prepareFlexFunction(requiredParameters, async (context, event, callback, response, handleError) => {
  try {
    const { conferenceSid, participantSid, agentSid, muted, coaching } = event;

    // If agentSid isn't null/blank, we know we are updating the conference coaching status
    if (agentSid && agentSid !== '') {
      const result = await ConferenceOperations.coachToggle({
        context,
        conferenceSid,
        participantSid,
        agentSid,
        muted,
        coaching,
        attempts: 0,
      });
      response.setStatusCode(result.status);
      response.setBody({
        success: result.success,
        conference: result.conferenceSid,
      });
    }
    // If the agentSid is null/blank, we know we are updating the conference muted status
    if (agentSid === '') {
      const result = await ConferenceOperations.bargeToggle({
        context,
        conferenceSid,
        participantSid,
        muted,
        attempts: 0,
      });

      const { status, success, conferenceSid: conference, message, twilioErrorCode, twilioDocPage } = result;
      response.setStatusCode(status);
      response.setBody({
        success,
        conference,
        message,
        twilioErrorCode,
        twilioDocPage,
      });
    }
    return callback(null, response);
  } catch (error) {
    return handleError(error);
  }
});
