export const selectRecentAiMessages = (messages, options = {}) => {
  const maxMessages = Math.max(1, Number(options.maxMessages) || 16);
  const maxChars = Math.max(1000, Number(options.maxChars) || 18_000);
  const maxMessageChars = Math.max(200, Number(options.maxMessageChars) || 3500);
  const eligible = Array.isArray(messages)
    ? messages.filter(message => ["user", "assistant"].includes(message?.role) && message?.content)
    : [];
  const selected = [];
  let usedChars = 0;

  for (let index = eligible.length - 1; index >= 0 && selected.length < maxMessages; index -= 1) {
    const message = eligible[index];
    const available = maxChars - usedChars;
    if (available <= 0) break;
    const content = String(message.content).slice(0, Math.min(maxMessageChars, available));
    if (!content) continue;
    selected.unshift({ role:message.role, content });
    usedChars += content.length;
  }
  return selected;
};
