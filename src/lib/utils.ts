export function formatRelativeTime(timestamp: number | string): string {
  const now = Date.now();
  const time = typeof timestamp === 'string' ? parseInt(timestamp, 10) : timestamp;
  const diff = now - time;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  if (days === 1) return '昨天';
  if (days < 7) return `${days} 天前`;

  return new Date(time).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
