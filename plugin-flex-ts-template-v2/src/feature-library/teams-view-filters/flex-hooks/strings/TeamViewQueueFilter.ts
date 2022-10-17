// Export the template names as an enum for better maintainability when accessing them elsewhere
export enum StringTemplates {
  ErrorParsingQueueExpression = 'QueueFilterParseNotification',
  ErrorParsingQueueExpressionWithOR = 'QueueFilterParseORsNotification'
}

export default {
  [StringTemplates.ErrorParsingQueueExpression]: 'Failed to parse queue expression, ignoring queue filter.',
  [StringTemplates.ErrorParsingQueueExpressionWithOR]: 'Unable to apply queue filters to queues containing OR\'d expressions. Ignoring queue filter.',
}
