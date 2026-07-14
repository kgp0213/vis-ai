const WEATHER_TOPIC = /(天气|气温|温度|降雨|下雨|weather|forecast|temperature)/i;
const WEATHER_QUERY = /(查|查询|看看|告诉|怎么样|如何|多少|预报|会不会|是否|今天|明天|后天|当前|现在|吗|么|几度|穿什么|带伞|in\s+|for\s+|today|tomorrow|current|what(?:'s| is))/i;
const WEATHER_LOCATION = /[\p{Script=Han}A-Za-z]{2,24}(?:的)?(?:天气|气温|温度|预报)/u;
const TECHNICAL_DISCUSSION = /(代码|编程|开发|实现|组件|函数|类|接口|\bapi\b|bug|调试|测试|文档|格式|提示词|skill|技能|wttr|open-meteo|源码|脚本)/i;
const VHOME_TOPIC = /(V\s*来家|企业钉钉|钉钉|DingTalk|\bdws\b)/i;
const VHOME_SPECIFIC_TOPIC = /(公司|企业)(?:通讯录|联系人|组织架构|日程|日历|待办|审批|邮箱|消息)|待我审批|待审批|钉盘|DING\s*消息|(?:AI|钉钉)听记|工号|组织架构|\bcompany\s+(?:contacts?|directory|calendar|todos?|tasks?|approvals?)\b/i;
const VHOME_ACTION = /(查|查询|搜索|读取|查看|看看|列出|汇总|总结|整理|找人|联系人|通讯录|同事|工号|部门|组织架构|日程|日历|会议室|待办|审批|考勤|打卡|日报|周报|日志|邮件|邮箱|消息|群聊|@我|发给|发送|通知|创建|新增|修改|更新|删除|完成|关闭|云盘|钉盘|听记|纪要|知识库|文档|表格|\bDING\b|\b(?:search|find|read|show|list|summarize|send|create|update|delete|complete|close|check|get|messages?|chats?|contacts?|directory|calendars?|meetings?|rooms?|todos?|tasks?|approvals?|reports?|mail|documents?|files?|sheets?|wiki|attendance|minutes)\b)/i;
const VHOME_TECHNICAL_DISCUSSION = /(代码|编程|开发|集成|实现|接口|逻辑|源码|脚本|程序|软件|\bui\b|\bapi\b|bug|调试|测试|安装|升级|版本|\b(?:code|coding|develop(?:ment)?|integration|implementation|debug|test|setup|install|upgrade|version)\b)/i;
const VHOME_SKILL_OBJECT = /(skill|技能|工作流|流程|自动化|模板|automation|workflow)/i;
const VHOME_SKILL_CREATE = /(创建|新建|制作|做一个|定制|自定义|保存成|保存为|封装成|生成一个|开发一个|create|build|make|customi[sz]e|save\s+as|turn\s+.+\s+into)/i;
const VHOME_SKILL_DIRECT = /(帮我|请|我想|我要|用于|用来|以后|每次|定期|每天|每周|每月|固定|反复|复用|如何|怎么|can you|i want|for me|reusable|weekly|daily)/i;
const VHOME_SKILL_REUSABLE = /(以后|每次|定期|每天|每周|每月|固定|反复|复用|长期|重复|reus(?:e|able)|recurring|every\s+(?:day|week|month)|weekly|daily|monthly)/i;
const VHOME_SKILL_PRODUCT_DISCUSSION = /(源码|代码|函数|组件|接口|架构|逻辑|路由|正则|关键词|bug|调试|测试|审查|评估|文档|说明书|实现方案|程序|软件|UI|交互卡片|弹窗|页面|前端|后端|source\s*code|architecture|router|regex|implementation|debug|test|review|documentation|UI)/i;
const PDF_PATH = /\.pdf(?=$|[\s"'“”‘’),;，。；、）\]}])/i;
const MARKDOWN_PATH = /\.(?:md|markdown)(?=$|[\s"'“”‘’),;，。；、）\]}])/i;
const MARKDOWN_TO_PDF = /(?:转(?:成|为|换成)|转换|导出|生成|制作).{0,24}(?:PDF|pdf)|(?:PDF|pdf).{0,24}(?:生成|导出)/i;
const PDF_CREATE = /(?:创建|生成|制作|输出|导出).{0,24}(?:PDF|pdf)|(?:PDF|pdf).{0,24}(?:报告|文档|文件)/i;
const PDF_TECHNICAL_DISCUSSION = /(源码|代码|函数|组件|接口|架构|逻辑|路由|正则|bug|调试|测试|审查|评估|实现方案|程序|软件|解析器|依赖|skill|技能|脚本|source\s*code|architecture|implementation|debug|test|review)/i;

export function classifyVHomeSkillAuthoringIntent(rawText) {
  const text = typeof rawText === "string" ? rawText.trim() : "";
  const threshold = 8;
  if (!text || text.length > 1200 || text.startsWith("/") || /@[A-Za-z0-9][A-Za-z0-9._-]*/.test(text)) {
    return { matched: false, score: 0, threshold, signals: [], reason: "ineligible-input" };
  }
  const signals = [];
  let score = 0;
  if (VHOME_TOPIC.test(text)) { score += 3; signals.push("vhome-domain"); }
  if (VHOME_SKILL_OBJECT.test(text)) { score += 2; signals.push("skill-object"); }
  if (VHOME_SKILL_CREATE.test(text)) { score += 3; signals.push("create-action"); }
  if (VHOME_SKILL_DIRECT.test(text)) { score += 1; signals.push("direct-intent"); }
  if (VHOME_SKILL_REUSABLE.test(text)) { score += 1; signals.push("reusable-workflow"); }
  if (VHOME_SKILL_PRODUCT_DISCUSSION.test(text)) { score -= 6; signals.push("product-discussion"); }
  const required = signals.includes("vhome-domain") && signals.includes("skill-object") && signals.includes("create-action");
  return {
    matched: required && score >= threshold,
    score,
    threshold,
    signals,
    reason: required && score >= threshold ? "explicit-vhome-skill-authoring" : "insufficient-or-technical",
  };
}

export function routeAutomaticSkill(rawText) {
  const text = typeof rawText === "string" ? rawText.trim() : "";
  if (!text || text.startsWith("/") || /@[A-Za-z0-9][A-Za-z0-9._-]*/.test(text)) return null;
  if (text.length > 1200) return null;
  if (classifyVHomeSkillAuthoringIntent(text).matched) {
    return { name: "vhome-skill-builder", task: text, source: "automatic" };
  }
  if (text.length <= 240 && (VHOME_TOPIC.test(text) || VHOME_SPECIFIC_TOPIC.test(text)) && VHOME_ACTION.test(text) && !VHOME_TECHNICAL_DISCUSSION.test(text)) {
    return { name: "dws", task: text, source: "automatic" };
  }
  if (MARKDOWN_PATH.test(text) && MARKDOWN_TO_PDF.test(text) && !PDF_TECHNICAL_DISCUSSION.test(text)) {
    return { name: "md-to-pdf-cjk", task: text, source: "automatic" };
  }
  if ((PDF_PATH.test(text) || PDF_CREATE.test(text)) && !PDF_TECHNICAL_DISCUSSION.test(text)) {
    return { name: "pdf", task: text, source: "automatic" };
  }
  if (text.length > 240) return null;
  if (!WEATHER_TOPIC.test(text) || TECHNICAL_DISCUSSION.test(text)) return null;
  if (!WEATHER_QUERY.test(text) && !WEATHER_LOCATION.test(text)) return null;
  return { name: "weather", task: text, source: "automatic" };
}
