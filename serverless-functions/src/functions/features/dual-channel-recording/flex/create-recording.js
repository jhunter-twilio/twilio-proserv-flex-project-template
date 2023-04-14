const { prepareFlexFunction, returnStandardResponse } = require(Runtime.getFunctions()['common/helpers/function-helper'].path);
const VoiceOperations = require(Runtime.getFunctions()['common/twilio-wrappers/programmable-voice'].path);

const requiredParameters = [{ key: 'callSid', purpose: 'unique ID of call to record' }];

exports.handler = prepareFlexFunction(requiredParameters, async (context, event, callback, response, handleError) => {
  try {
    const { callSid } = event;

    const result = await VoiceOperations.createRecording({
      context,
      callSid,
      params: {
        recordingChannels: 'dual',
      },
      attempts: 0,
    });

    const { success, recording, status, message, twilioDocPage, twilioErrorCode } = result;

    response.setStatusCode(status);
    response.setBody({ success, recording, message, twilioErrorCode, twilioDocPage });
    return callback(null, response);
  } catch (error) {
    return handleError(error);
  }
});
