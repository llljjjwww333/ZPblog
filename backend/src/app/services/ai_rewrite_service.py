"""
AI 文章修改润色服务 - 根据评审结果自动修改文章
"""
from typing import List, Dict, Optional, Tuple
import json

from app.config import settings


class AIRewriteService:
    """AI 文章修改服务类"""
    
    def __init__(self):
        self.ai_provider = settings.AI_PROVIDER
        self.api_key = settings.AI_API_KEY
        self.api_base = settings.AI_API_BASE
        self.model = settings.AI_MODEL
    
    def rewrite_article(
        self,
        title: str,
        content: str,
        review_results: List[Dict],
        round_num: int = 1,
        max_rounds: int = 3,
        focus_areas: Optional[List[str]] = None
    ) -> Tuple[str, str, str]:
        """
        根据评审结果修改文章
        
        Args:
            title: 原标题
            content: 原文内容
            review_results: 评审结果列表
            round_num: 当前轮次
            max_rounds: 总轮次
            focus_areas: 重点优化方向
            
        Returns:
            (新标题, 新内容, 修改说明)
        """
        try:
            prompt = self._build_rewrite_prompt(
                title, content, review_results, round_num, max_rounds, focus_areas
            )
            
            ai_response = self._call_ai_model(prompt)
            new_title, new_content, explanation = self._parse_rewrite_response(ai_response)
            
            return new_title, new_content, explanation
            
        except Exception as e:
            print(f"AI 修改失败: {e}")
            return title, content, f"修改失败: {str(e)}"
    
    def _build_rewrite_prompt(
        self,
        title: str,
        content: str,
        review_results: List[Dict],
        round_num: int,
        max_rounds: int,
        focus_areas: Optional[List[str]]
    ) -> str:
        """构建文章修改提示词"""
        review_summary = self._summarize_reviews(review_results)
        
        focus_desc = ""
        if focus_areas and len(focus_areas) > 0:
            focus_map = {
                "logic": "逻辑结构",
                "style": "写作风格",
                "seo": "SEO优化",
                "readability": "可读性",
                "facts": "事实准确性"
            }
            focus_names = [focus_map.get(f, f) for f in focus_areas]
            focus_desc = f"\n【重点优化方向】{', '.join(focus_names)}"
        else:
            focus_desc = "\n【重点优化方向】根据评审意见自动判断优化方向"
        
        max_content_len = 2000
        max_review_len = 800
        
        truncated_content = content[:max_content_len] + "..." if len(content) > max_content_len else content
        truncated_review = review_summary[:max_review_len] + "..." if len(review_summary) > max_review_len else review_summary
        
        # 提取文章主题
        topic = self._extract_topic(content)
        
        # 根据主题生成示例内容
        topic_examples = {
            '综艺娱乐': '可以分析《乘风破浪的姐姐》《披荆斩棘的哥哥》等热门综艺',
            '体育赛事': '可以分析奥运会、世界杯、NBA等经典赛事',
            '技术分享': '可以分享具体的编程技巧、工具使用经验',
            '生活感悟': '可以分享真实的生活经历和感悟',
            '职场经验': '可以分享具体的职场案例和解决方案',
            '学习方法': '可以分享具体的学习技巧和效率提升方法',
            '写作技巧': '可以分享标题写作、文案创作的实用技巧',
            '综合话题': '可以深入分析具体的案例和现象'
        }
        
        example_content = topic_examples.get(topic, '可以添加具体的案例和数据支撑')
        
        prompt = f"""根据评审意见修改文章。

【文章主题】{topic}
【原文标题】{title}

【原文内容】
{truncated_content}

【评审意见】
{truncated_review}

【修改要求】
1. 必须针对评审意见中的每个问题进行实质性修改
2. 内容空洞 → 添加具体案例、数据、细节（{example_content}）
3. 标题与内容不符 → 修改内容使其匹配标题，或修改标题使其匹配内容
4. 标题笼统 → 使其具体化，包含关键信息
5. 删除所有空话套话（如"在本文中我们将探讨..."）
6. 修改后的内容必须比原文更充实、更具体

【重要】修改必须实质性，不能只是微调！

【必须返回JSON】
{{
    "new_title": "修改后的具体标题",
    "new_content": "修改后的充实内容（HTML格式）",
    "explanation": "具体说明针对哪些评审意见进行了什么修改"
}}"""
        
        return prompt
    
    def _summarize_reviews(self, review_results: List[Dict]) -> str:
        """汇总评审意见"""
        print(f"[DEBUG] _summarize_reviews 被调用，评审数量: {len(review_results)}")
        
        summary_parts = []
        
        for i, review in enumerate(review_results, 1):
            print(f"[DEBUG] 处理评审 {i}: {review}")
            reviewer_name = review.get('reviewer_name', f'评审者{i}')
            content = review.get('content', '')
            
            print(f"[DEBUG] 评审者: {reviewer_name}, 内容长度: {len(content)}")
            print(f"[DEBUG] 内容前100字: {content[:100]}")
            
            # 提取关键问题
            summary_parts.append(f"\n【{reviewer_name}的评审】")
            summary_parts.append(content[:500] if len(content) > 500 else content)
        
        result = "\n".join(summary_parts)
        print(f"[DEBUG] 汇总后的评审意见长度: {len(result)}")
        return result
    
    def _parse_rewrite_response(self, ai_response: str) -> Tuple[str, str, str]:
        """解析 AI 修改响应 - 增强版，处理各种格式"""
        print(f"[DEBUG] 开始解析 AI 响应，长度: {len(ai_response)}")
        print(f"[DEBUG] AI 响应前500字: {ai_response[:500]}")
        
        try:
            # 清理响应内容
            cleaned_response = ai_response.strip()
            
            # 移除 markdown 代码块标记
            if cleaned_response.startswith('```json'):
                cleaned_response = cleaned_response[7:]
            elif cleaned_response.startswith('```'):
                cleaned_response = cleaned_response[3:]
            if cleaned_response.endswith('```'):
                cleaned_response = cleaned_response[:-3]
            cleaned_response = cleaned_response.strip()
            
            # 尝试提取 JSON 内容
            import re
            json_match = re.search(r'\{[\s\S]*\}', cleaned_response)
            if json_match:
                cleaned_response = json_match.group(0)
                print(f"[DEBUG] 提取到 JSON 内容，长度: {len(cleaned_response)}")
            
            # 尝试解析 JSON
            result = json.loads(cleaned_response)
            new_title = result.get('new_title', '')
            new_content = result.get('new_content', '')
            explanation = result.get('explanation', '')
            
            print(f"[DEBUG] JSON 解析成功")
            print(f"[DEBUG] 新标题: {new_title}")
            print(f"[DEBUG] 新内容长度: {len(new_content)}")
            print(f"[DEBUG] 修改说明: {explanation[:100]}...")
            
            # 验证返回的内容是否为空
            if not new_content or new_content.strip() == '':
                print(f"[ERROR] AI 返回的内容为空")
                return "", "", "AI 返回的内容为空，请重试"
            
            return new_title, new_content, explanation
            
        except json.JSONDecodeError as e:
            print(f"[ERROR] JSON 解析失败: {e}")
            print(f"[ERROR] 尝试使用备用方法提取内容...")
            
            # 备用方法：尝试从 HTML 内容中提取
            try:
                # 如果 AI 返回的是纯 HTML，尝试构造一个合理的响应
                if '<' in ai_response and '>' in ai_response:
                    print(f"[DEBUG] 检测到 HTML 内容，使用备用提取方法")
                    
                    # 尝试提取标题（从 h1 标签或第一个段落）
                    import re
                    title_match = re.search(r'<h1[^>]*>(.*?)</h1>', ai_response, re.DOTALL)
                    if not title_match:
                        title_match = re.search(r'<p[^>]*>(.*?)</p>', ai_response, re.DOTALL)
                    
                    extracted_title = title_match.group(1).strip() if title_match else "优化后的文章"
                    # 移除 HTML 标签
                    extracted_title = re.sub(r'<[^>]+>', '', extracted_title)
                    
                    # 使用完整的 HTML 作为内容
                    extracted_content = ai_response.strip()
                    
                    explanation = "已根据评审意见优化文章结构和内容"
                    
                    print(f"[DEBUG] 备用提取成功")
                    print(f"[DEBUG] 提取的标题: {extracted_title}")
                    print(f"[DEBUG] 提取的内容长度: {len(extracted_content)}")
                    
                    return extracted_title, extracted_content, explanation
                else:
                    # 如果不是 HTML，返回错误
                    return "", "", f"AI 返回格式异常，无法解析"
                    
            except Exception as extract_error:
                print(f"[ERROR] 备用提取也失败: {extract_error}")
                return "", "", f"AI 返回格式异常，请检查响应格式"
                
        except Exception as e:
            print(f"[ERROR] 解析响应失败: {e}")
            import traceback
            traceback.print_exc()
            return "", "", f"解析失败: {str(e)}"
    
    def _call_ai_model(self, prompt: str) -> str:
        """调用 AI 模型"""
        print(f"[DEBUG] 调用 AI 模型，provider: '{self.ai_provider}', model: {self.model}")
        print(f"[DEBUG] provider 类型: {type(self.ai_provider)}")
        print(f"[DEBUG] provider 长度: {len(self.ai_provider) if self.ai_provider else 0}")
        
        # 清理 provider 值（去除空格和换行）
        provider = self.ai_provider.strip().lower() if self.ai_provider else ''
        print(f"[DEBUG] 清理后的 provider: '{provider}'")
        
        try:
            # 支持多种 provider 名称
            if provider in ['openai', 'deepseek']:
                print(f"[DEBUG] 调用 OpenAI/DeepSeek API (provider: {provider})")
                return self._call_openai(prompt)
            elif provider == 'azure':
                print("[DEBUG] 调用 Azure OpenAI")
                return self._call_azure_openai(prompt)
            elif provider == 'local':
                print("[DEBUG] 调用本地模型（mock）")
                return self._call_local_model(prompt)
            else:
                print(f"[DEBUG] 未知的 provider: '{provider}'，使用 mock")
                return self._mock_rewrite(prompt)
        except Exception as e:
            print(f"[ERROR] AI 调用失败: {e}")
            import traceback
            traceback.print_exc()
            return self._mock_rewrite(prompt)
    
    def _call_openai(self, prompt: str) -> str:
        """调用 OpenAI API"""
        import openai
        
        print(f"[DEBUG] _call_openai 开始调用")
        print(f"[DEBUG] API Key: {self.api_key[:20]}..." if self.api_key else "[DEBUG] API Key: 空")
        print(f"[DEBUG] API Base: {self.api_base}")
        print(f"[DEBUG] Model: {self.model}")
        
        client = openai.OpenAI(
            api_key=self.api_key,
            base_url=self.api_base if self.api_base else None,
            timeout=60
        )
        
        print(f"[DEBUG] 发送请求到 DeepSeek API...")
        
        response = client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": "你是一位专业的文章编辑，擅长根据评审意见优化文章。请严格按照要求返回JSON格式。"},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=2000
        )
        
        result = response.choices[0].message.content
        print(f"[DEBUG] API 返回结果长度: {len(result)}")
        print(f"[DEBUG] API 返回结果前500字: {result[:500]}")
        
        return result
    
    def _call_azure_openai(self, prompt: str) -> str:
        """调用 Azure OpenAI"""
        # 这里可以实现 Azure OpenAI 的调用
        return self._mock_rewrite(prompt)
    
    def _call_local_model(self, prompt: str) -> str:
        """调用本地模型"""
        # 这里可以实现本地模型的调用
        return self._mock_rewrite(prompt)
    
    def _mock_rewrite(self, prompt: str) -> str:
        """模拟修改（用于测试）- 根据评审意见智能修改文章"""
        try:
            # 尝试从 prompt 中提取原文标题和内容
            import re
            
            # 提取标题
            title_match = re.search(r'【原文标题】\s*\n(.+?)\n', prompt)
            original_title = title_match.group(1).strip() if title_match else "文章标题"
            
            # 提取内容
            content_match = re.search(r'【原文内容】\s*\n(.+?)\n\s*【评审意见', prompt, re.DOTALL)
            original_content = content_match.group(1).strip() if content_match else ""
            
            # 提取评审意见
            review_match = re.search(r'【评审意见汇总】\s*\n(.+?)\n\s*【修改要求', prompt, re.DOTALL)
            review_content = review_match.group(1).strip() if review_match else ""
            
            print(f"[DEBUG] Mock rewrite - 原文标题: {original_title}")
            print(f"[DEBUG] Mock rewrite - 原文内容长度: {len(original_content)}")
            print(f"[DEBUG] Mock rewrite - 评审意见长度: {len(review_content)}")
            
            # 根据评审意见智能修改内容
            new_content = self._smart_rewrite_content(original_content, review_content)
            
            # 生成修改说明
            explanation = self._generate_explanation_from_review(review_content)
            
            # 优化标题
            new_title = self._optimize_title(original_title, review_content)
            
            print(f"[DEBUG] Mock rewrite - 新标题: {new_title}")
            print(f"[DEBUG] Mock rewrite - 新内容长度: {len(new_content)}")
            
            return json.dumps({
                "new_title": new_title,
                "new_content": new_content,
                "explanation": explanation
            }, ensure_ascii=False)
            
        except Exception as e:
            print(f"[ERROR] Mock rewrite failed: {e}")
            import traceback
            traceback.print_exc()
            # 如果解析失败，返回一个基本的响应
            return json.dumps({
                "new_title": "文章标题",
                "new_content": "<p>文章内容处理失败，请检查配置</p>",
                "explanation": f"处理失败: {str(e)}"
            }, ensure_ascii=False)
    
    def _smart_rewrite_content(self, content: str, review_content: str) -> str:
        """根据评审意见智能修改内容 - 使用AI生成有意义的修改"""
        import re
        
        print(f"[DEBUG] _smart_rewrite_content 被调用")
        print(f"[DEBUG] 原文长度: {len(content)}")
        print(f"[DEBUG] 评审意见长度: {len(review_content)}")
        print(f"[DEBUG] 评审意见前200字: {review_content[:200]}")
        
        # 首先将 markdown 转换为 HTML
        html_content = self._markdown_to_html(content)
        
        # 提取文章主题（从内容中找关键词）
        topic = self._extract_topic(content)
        print(f"[DEBUG] 提取的主题: {topic}")
        
        # 构建改写提示词 - 更强调根据评审意见修改
        rewrite_prompt = f"""你是一位专业的文章编辑。请根据评审意见对文章进行实质性修改。

【评审意见】（必须针对这些问题进行修改）
{review_content[:800]}

【原文】
{content[:1500]}

【文章主题】
{topic}

【修改要求】
1. **仔细阅读上面的评审意见，理解指出的每一个问题**
2. **针对评审意见中的每一个问题进行实质性改进**：
   - 如果评审说"内容空洞"，请添加具体的例子、数据或细节
   - 如果评审说"逻辑不清"，请重新组织段落结构，添加过渡句
   - 如果评审说"不够深入"，请添加深度分析和见解
   - 如果评审说"标题不好"，请优化标题使其更吸引人
3. **不要只是添加过渡句，要真正改进内容的质量**
4. 保持文章主题和核心观点不变
5. 直接输出修改后的完整文章内容
6. 使用HTML格式（<p>标签包裹段落）

请生成修改后的文章（必须针对评审意见进行修改）："""

        # 调用AI进行改写
        try:
            if self.api_key:
                print(f"[DEBUG] 调用AI进行改写...")
                rewritten = self._call_ai_for_rewrite(rewrite_prompt)
                print(f"[DEBUG] AI改写完成，返回内容长度: {len(rewritten)}")
                print(f"[DEBUG] AI改写返回前200字: {rewritten[:200]}")
                
                # 确保返回的内容是HTML格式
                if not rewritten.startswith('<'):
                    # 如果不是HTML，转换为HTML
                    rewritten = self._markdown_to_html(rewritten)
                return rewritten
            else:
                print(f"[DEBUG] 未配置API Key，使用规则改写")
        except Exception as e:
            print(f"[WARN] AI改写失败: {e}，使用规则改写")
        
        # 如果AI调用失败，使用规则-based改写
        return self._rule_based_rewrite(html_content, review_content, topic)
    
    def _extract_topic(self, content: str) -> str:
        """从内容中提取文章主题"""
        # 简单的主题提取逻辑
        if '体育' in content or '竞技' in content or '运动' in content:
            return '体育赛事'
        elif '综艺' in content or '节目' in content or '娱乐' in content:
            return '综艺娱乐'
        elif '技术' in content or '编程' in content or '代码' in content:
            return '技术分享'
        elif '生活' in content or '日常' in content:
            return '生活感悟'
        elif '工作' in content or '职场' in content:
            return '职场经验'
        elif '学习' in content or '教育' in content:
            return '学习方法'
        elif '标题' in content and ('写作' in content or '文案' in content):
            return '写作技巧'
        else:
            return '综合话题'
    
    def _call_ai_for_rewrite(self, prompt: str) -> str:
        """调用AI进行改写"""
        import openai
        
        client = openai.OpenAI(
            api_key=self.api_key,
            base_url=self.api_base if self.api_base else None,
            timeout=30.0
        )
        
        response = client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": "你是一位专业的文章编辑。你的任务是根据评审意见对文章进行实质性修改，使文章更具体、更有深度、更有逻辑性。直接输出修改后的文章内容，使用HTML格式。"},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=1500,
            top_p=1.0
        )
        
        return response.choices[0].message.content
    
    def _rule_based_rewrite(self, html_content: str, review_content: str, topic: str) -> str:
        """基于规则的改写（当AI不可用时使用）"""
        import re
        
        new_html = html_content
        
        # 根据主题生成具体的扩展内容
        topic_expansions = {
            '体育赛事': [
                '运动员们在赛场上挥洒汗水，每一次冲刺、每一次跳跃都展现着人类对极限的挑战。',
                '比赛不仅是对体能的考验，更是对意志力的磨练。观众们的欢呼声此起彼伏，为每一个精彩瞬间喝彩。',
                '从热身到比赛结束，每一个环节都凝聚着运动员多年的训练和准备。'
            ],
            '技术分享': [
                '在实际项目中，我们需要考虑各种边界情况和异常处理，确保代码的健壮性。',
                '通过性能测试可以发现，优化后的算法在处理大数据量时效率提升了数倍。',
                '这个技术方案已经在多个生产环境中得到验证，证明其稳定性和可扩展性。'
            ],
            '生活感悟': [
                '生活中的每一个细节都值得用心体会，正是这些看似平凡的瞬间构成了我们独特的人生经历。',
                '在忙碌的工作之余，我们不妨放慢脚步，感受身边的美好。',
                '回顾过去的经历，我深刻体会到坚持和耐心的重要性。'
            ],
            '职场经验': [
                '在团队协作中，有效的沟通往往比个人的技术能力更加重要。',
                '通过数据分析，我们发现优化工作流程可以显著提升团队效率。',
                '面对挑战时，保持积极的心态和灵活的思维方式是解决问题的关键。'
            ],
            '学习方法': [
                '通过制定合理的学习计划，我们可以更系统地掌握知识体系。',
                '实践是检验学习效果的最好方式，将理论应用到实际项目中能加深理解。',
                '与他人的交流和讨论往往能带来新的视角和启发。'
            ],
            '综合话题': [
                '深入思考这个问题，我们发现背后蕴含着更复杂的因素和关联。',
                '从多个角度分析，可以得出更加全面和客观的结论。',
                '这一现象在现实生活中有着广泛的应用和启示。'
            ]
        }
        
        # 根据评审意见进行针对性修改
        if '空洞' in review_content or '笼统' in review_content or '具体' in review_content:
            # 找到内容空洞的段落并添加具体描述
            expansions = topic_expansions.get(topic, topic_expansions['综合话题'])
            import random
            
            # 在第一个实质性段落后面添加扩展
            def add_specific_content(match):
                original = match.group(1)
                expansion = random.choice(expansions)
                return f'<p>{original}</p>\n<p>{expansion}</p>'
            
            new_html = re.sub(r'<p>([^<]{10,50})</p>', add_specific_content, new_html, count=1)
        
        if '逻辑' in review_content or '结构' in review_content:
            # 添加逻辑连接词和过渡
            logical_connectors = [
                '首先，我们需要明确问题的核心。',
                '其次，让我们分析具体的表现形式。',
                '此外，这一现象还引发了更深层次的思考。',
                '最后，我们可以得出以下结论。'
            ]
            
            # 在段落之间插入逻辑连接
            paragraphs = new_html.split('</p>\n<p>')
            if len(paragraphs) > 2:
                new_paragraphs = [paragraphs[0]]
                for i, p in enumerate(paragraphs[1:-1]):
                    if i < len(logical_connectors):
                        new_paragraphs.append(f'</p>\n<p>{logical_connectors[i]}')
                    new_paragraphs.append(p)
                new_paragraphs.append(paragraphs[-1])
                new_html = '</p>\n<p>'.join(new_paragraphs)
        
        if '深度' in review_content or '深入' in review_content:
            # 添加深度分析段落
            depth_analysis = f'<p>深入分析{topic}，我们可以发现这一现象背后反映了更广泛的社会趋势和深层原因。这不仅是一个孤立的事件，而是与我们所处的时代背景密切相关。</p>'
            # 在文章中间插入深度分析
            mid_pos = len(new_html) // 2
            new_html = new_html[:mid_pos] + depth_analysis + new_html[mid_pos:]
        
        return new_html
    
    def _generate_expansion(self, original_text: str) -> str:
        """根据原文生成扩展内容"""
        # 根据原文长度和关键词生成相关的扩展
        expansions = [
            "这一现象背后蕴含着更深层的意义，值得我们细细品味和深入思考。",
            "通过具体实例可以更好地理解这一观点，让我们进一步探讨其中的细节。",
            "从实践角度来看，这一内容具有重要的指导价值和现实意义。",
            "深入分析这一问题，我们能够发现更多有价值的见解和启示。"
        ]
        import random
        return random.choice(expansions)
    
    def _generate_opening(self, content: str) -> str:
        """生成引人入胜的开头"""
        openings = [
            "<p>在当今快速发展的时代，我们面临着诸多值得深入探讨的话题。</p>",
            "<p>探索未知、追求真理是人类永恒的主题，今天让我们一同深入了解这个有趣的话题。</p>",
            "<p>每一个故事背后都有其独特的价值和意义，接下来要分享的内容相信会给你带来新的思考。</p>",
            "<p>生活中处处充满着值得记录的瞬间，而以下内容正是对这些珍贵时刻的呈现与思考。</p>"
        ]
        import random
        return random.choice(openings)
    
    def _generate_ending(self, content: str) -> str:
        """生成总结性的结尾"""
        endings = [
            "<p>通过以上的探讨，我们对这个话题有了更加全面和深入的认识。希望这些内容能够给你带来启发和帮助。</p>",
            "<p>总结而言，深入理解和把握这些要点，对于我们的实践具有重要的指导意义。期待你能在实际中灵活运用。</p>",
            "<p>每一次思考和探索都是成长的机会。愿这篇文章能成为你前行路上的一盏明灯，照亮未来的方向。</p>",
            "<p>知识的海洋无穷无尽，而这只是其中的一朵浪花。保持好奇心，继续探索，你会发现更多精彩。</p>"
        ]
        import random
        return random.choice(endings)
    
    def _improve_wording(self, html_content: str) -> str:
        """改进措辞，使表达更加优美"""
        # 同义词替换映射
        improvements = {
            '很好': ['非常出色', '令人赞叹', '表现优异'],
            '不错': ['令人印象深刻', '值得肯定', '表现良好'],
            '很多': ['丰富多样', '数量众多', '不胜枚举'],
            '很大': ['相当显著', '不容忽视', '影响深远'],
            '重要': ['至关重要', '意义重大', '不可或缺'],
            '简单': ['简洁明了', '通俗易懂', '深入浅出'],
            '困难': ['充满挑战', '需要克服', '考验重重'],
            '开心': ['心情愉悦', '倍感欣慰', '喜不自胜'],
            '难过': ['心情沉重', '令人惋惜', '深感遗憾']
        }
        
        import random
        new_content = html_content
        for old_word, new_words in improvements.items():
            if old_word in new_content:
                new_content = new_content.replace(old_word, random.choice(new_words), 1)
        
        return new_content
    
    def _markdown_to_html(self, content: str) -> str:
        """将 markdown 内容转换为 HTML"""
        import re
        
        # 处理图片标记 ![alt](url) -> <img src="url" alt="alt">
        content = re.sub(r'!\[([^\]]*)\]\(([^\)]+)\)', r'<img src="\2" alt="\1" style="max-width:100%;border-radius:8px;margin:16px 0;">', content)
        
        # 处理标题 # 标题 -> <h1>标题</h1>
        content = re.sub(r'^### (.+)$', r'<h3>\1</h3>', content, flags=re.MULTILINE)
        content = re.sub(r'^## (.+)$', r'<h2>\1</h2>', content, flags=re.MULTILINE)
        content = re.sub(r'^# (.+)$', r'<h1>\1</h1>', content, flags=re.MULTILINE)
        
        # 处理段落 - 将空行分隔的文本包装在 <p> 标签中
        paragraphs = content.split('\n\n')
        html_paragraphs = []
        for p in paragraphs:
            p = p.strip()
            if p and not p.startswith('<h') and not p.startswith('<img'):
                html_paragraphs.append(f'<p>{p}</p>')
            elif p:
                html_paragraphs.append(p)
        
        return '\n'.join(html_paragraphs)
    
    def _generate_explanation_from_review(self, review_content: str) -> str:
        """根据评审内容生成修改说明"""
        explanations = []
        
        # 根据评审内容的关键词生成说明
        if '逻辑' in review_content or '结构' in review_content:
            explanations.append("优化了文章结构和逻辑连贯性")
        if '标题' in review_content or '表达' in review_content:
            explanations.append("改进了标题和表达方式，使其更具吸引力")
        if '段落' in review_content or '排版' in review_content:
            explanations.append("调整了段落结构，提升可读性")
        if '细节' in review_content or '具体' in review_content:
            explanations.append("增加了具体细节和描述")
        if '开头' in review_content:
            explanations.append("优化了开头段落，增强吸引力")
        if '结尾' in review_content:
            explanations.append("改进了结尾，使文章更有收尾感")
        
        if not explanations:
            explanations = ["根据评审意见进行了整体优化", "改进了语言表达", "提升了文章可读性"]
        
        return "；".join(explanations)
    
    def _optimize_title(self, title: str, review_content: str) -> str:
        """根据评审意见优化标题 - 使用AI生成更好的标题"""
        # 尝试使用AI生成标题
        try:
            if self.api_key:
                title_prompt = f"""请根据以下信息优化文章标题。

原标题：{title}
评审意见：{review_content[:300]}

要求：
1. 标题要吸引人、有悬念
2. 包含文章核心主题
3. 长度在10-20字之间
4. 直接输出优化后的标题，不要解释

优化后的标题："""
                
                import openai
                client = openai.OpenAI(
                    api_key=self.api_key,
                    base_url=self.api_base if self.api_base else None,
                    timeout=10.0
                )
                
                response = client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": "你是一位专业的标题编辑。你的任务是优化文章标题，使其更吸引人、更有传播力。只输出标题，不要其他内容。"},
                        {"role": "user", "content": title_prompt}
                    ],
                    temperature=0.8,
                    max_tokens=50,
                    top_p=1.0
                )
                
                new_title = response.choices[0].message.content.strip()
                # 清理可能的引号
                new_title = new_title.strip('"""')
                if new_title and len(new_title) > 5:
                    return new_title
        except Exception as e:
            print(f"[WARN] AI标题优化失败: {e}")
        
        # 如果AI失败，使用规则-based优化
        import random
        new_title = title
        
        # 如果评审中提到标题问题，尝试改进
        if '标题' in review_content or '表达' in review_content or '吸引' in review_content:
            prefixes = ['我的', '一次难忘的', '探索', '关于']
            suffixes = ['的深度思考', '：一次难忘的经历', '之旅', '的实践与反思']
            
            prefix = random.choice(prefixes)
            suffix = random.choice(suffixes)
            
            if not any(p in new_title for p in prefixes):
                new_title = prefix + new_title
            
            if not any(s in new_title for s in ['：', '之旅', '思考', '反思']):
                new_title = new_title + suffix
        
        if len(title) < 10:
            natural_prefixes = ['关于', '我的', '探索']
            natural_suffixes = ['的思考', '的记录', '分享']
            prefix = random.choice(natural_prefixes)
            suffix = random.choice(natural_suffixes)
            if not any(p in new_title for p in natural_prefixes):
                new_title = prefix + new_title
            if not any(s in new_title for s in ['思考', '记录', '分享']):
                new_title = new_title + suffix
        
        return new_title


# 单例模式
_rewrite_service = None

def get_rewrite_service() -> AIRewriteService:
    """获取 AI 修改服务实例"""
    global _rewrite_service
    if _rewrite_service is None:
        _rewrite_service = AIRewriteService()
    return _rewrite_service
