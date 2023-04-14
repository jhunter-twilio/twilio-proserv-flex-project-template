const { prepareStudioFunction, extractStandardResponse } = require(Runtime.getFunctions()[
  'common/helpers/function-helper'
].path);
const ChatOperations = require(Runtime.getFunctions()['features/chat-transfer/common/chat-operations'].path);

const requiredParameters = [
  { key: 'taskSid', purpose: 'taskSid to add to channel attributes' },
  { key: 'channelSid', purpose: 'channelSid to add task information to' },
];

exports.handler = prepareStudioFunction(requiredParameters, async (context, event, callback, response, handleError) => {
  try {
    const { taskSid, channelSid } = event;
    const result = await ChatOperations.addTaskToChannel({
      context,
      taskSid,
      channelSid,
      attempts: 0,
    });

    response.setStatusCode(result.status);
    response.setBody({ ...extractStandardResponse(result) });
    return callback(null, response);
  } catch (error) {
    return handleError(error);
  }
});
