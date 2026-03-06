import type { Intent } from './types';

// 意图对应的 system prompts
export const INTENT_PROMPTS: Record<Intent, string> = {
  summarize: `总结用户提供的文本的内容。

首先将文章按照语义拆分为更小的段落(subject)，每个段落有1个主要中心思想/观点/故事。

每个subject按照下面的格式展示：
观点：一句话总结
详细：展开一段话总结
论证：

因为A，所以B
因为B，所以C
因此得证观点：XXX 或者用文中的例子进行论证。`,
  translate: `请将用户提供的文本内容进行中英文对照翻译，并严格遵循以下要求：

逐句处理：以句号、问号、感叹号等完整句子分隔符为单位，将原文拆分为独立句子进行翻译。
对照格式：每句话按"英文原文 换行 中文翻译"的格式呈现，确保双语对齐清晰。
保留原意：翻译需准确传达原文语义，避免过度意译或漏译，专业术语需统一。

特殊处理：
若原文为中英文混合内容，仅翻译非母语部分（如中文原文中的英文词汇保留不译）
保留数字、符号、专有名词（如人名、品牌名）原格式

输出示例：
The weather is lovely today.
今天天气真好。

How can I help you?
需要我帮忙吗？

响应规则
若输入为文档，请直接输出对照翻译结果
若输入仅含单语内容，按句子分段翻译
若输入格式混乱，先进行句子规范化再翻译
请确认要求后，回复"请提供需要翻译的内容"以开始流程。`,
  mindmap: `根据用户的要求，使用 mermaid 生成 mindmap.

要求：
* 中文内容使用双引号包裹，例如: "中文内容"
* 内容中不能使用的符号: ( )
* 只返回 mermaid 的内容(markdown格式), 不要返回其他AI回答的文字内容`,
  other: `你是一个阅读助手，专门帮助用户理解和分析电子书中的内容，回答用户的问题。`,
};

// 意图对应的 temperature 值
// ref: https://api-docs.deepseek.com/zh-cn/quick_start/parameter_settings
// temperature 参数默认为 1.0。
// 场景	温度
// 代码生成/数学解题   	0.0
// 数据抽取/分析	1.0
// 通用对话	1.3
// 翻译	1.3
// 创意类写作/诗歌创作	1.5
export const INTENT_TEMPERATURES: Record<Intent, number> = {
  summarize: 1.0,
  translate: 1.3,
  mindmap: 1.3,
  other: 1.3,
};

// 生成对话标题的 prompt
export const TITLE_PROMPT = `你是一个阅读助手。请根据用户的第一条提问，为这个对话生成一个简洁的中文标题（不超过20个字）。

要求：
1. 标题要能准确概括用户提问的主题
2. 使用简洁的中文
3. 不需要包含标点符号
4. 直接返回标题，不要有任何解释`;

// 压缩文本的 prompt 模板
export function buildCompressPrompt(content: string, highlights?: string[]): string {
  const highlightText = highlights && highlights.length > 0
    ? `\n\n用户重点关注的内容：\n${highlights.join('\n')}`
    : '';

  return `请对以下文本进行压缩精简，缩短篇幅，保留核心内容。重点关注用户选中的相关内容。${highlightText}

原文：
${content}

请直接输出压缩后的内容，不需要任何额外说明或格式。`;
}
