"""
Markdown处理工具
"""
import markdown
from typing import Optional

def markdown_to_html(markdown_text: str) -> Optional[str]:
    """
    将Markdown转换为HTML
    
    参数:
        markdown_text: Markdown格式的文本
    
    返回:
        HTML格式的文本，如果输入为空则返回None
    """
    if not markdown_text:
        return None
    
    # 使用Python-Markdown库
    html = markdown.markdown(
        markdown_text,
        extensions=[
            'extra',           # 额外扩展
            'codehilite',      # 代码高亮
            'toc',             # 目录生成
            'tables',          # 表格支持
            'fenced_code'      # 代码块
        ],
        output_format='html'
    )
    
    return html