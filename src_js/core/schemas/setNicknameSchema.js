export const setNicknameSchema = {
  type: 'object',
  properties: {
    newNickname: {
      type: 'string',
      description: 'The new nickname for the agent',
      minLength: 1,
      maxLength: 32
    }
  },
  required: ['newNickname']
};