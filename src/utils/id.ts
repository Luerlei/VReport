/**
 * 生成唯一 ID
 * 优先使用加密安全的 randomUUID，避免同一毫秒内多次调用产生碰撞；
 * 在不支持的环境下回退到时间戳 + 双段高熵随机。
 */
export function uid(prefix = ''): string {
  const cryptoObj = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto
  if (cryptoObj?.randomUUID) {
    return `${prefix}${cryptoObj.randomUUID()}`
  }
  const time = Date.now().toString(36)
  const rand =
    Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10)
  return `${prefix}${time}${rand}`
}
