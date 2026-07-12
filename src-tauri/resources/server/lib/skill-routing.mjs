const WEATHER_TOPIC = /(天气|气温|温度|降雨|下雨|weather|forecast|temperature)/i;
const WEATHER_QUERY = /(查|查询|看看|告诉|怎么样|如何|多少|预报|会不会|是否|今天|明天|后天|当前|现在|吗|么|几度|穿什么|带伞|in\s+|for\s+|today|tomorrow|current|what(?:'s| is))/i;
const WEATHER_LOCATION = /[\p{Script=Han}A-Za-z]{2,24}(?:的)?(?:天气|气温|温度|预报)/u;
const TECHNICAL_DISCUSSION = /(代码|编程|开发|实现|组件|函数|类|接口|\bapi\b|bug|调试|测试|文档|格式|提示词|skill|技能|wttr|open-meteo|源码|脚本)/i;

export function routeAutomaticSkill(rawText) {
  const text = typeof rawText === "string" ? rawText.trim() : "";
  if (!text || text.length > 240 || text.startsWith("/") || /@[A-Za-z0-9][A-Za-z0-9._-]*/.test(text)) return null;
  if (!WEATHER_TOPIC.test(text) || TECHNICAL_DISCUSSION.test(text)) return null;
  if (!WEATHER_QUERY.test(text) && !WEATHER_LOCATION.test(text)) return null;
  return { name: "weather", task: text, source: "automatic" };
}
