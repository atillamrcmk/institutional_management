export const messageQueryKeys = {
  inbox: (userId: string) => ['messages', 'inbox', userId] as const,
  sent: (userId: string) => ['messages', 'sent', userId] as const,
  unread: (userId: string) => ['messages', 'unread', userId] as const,
  detail: (messageId: string) => ['messages', 'detail', messageId] as const,
};
