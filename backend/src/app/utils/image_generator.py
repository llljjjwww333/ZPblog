import os
import io
from PIL import Image, ImageDraw, ImageFont
import random


def generate_cover_image(title, content, size="1024x1024"):
    """
    根据文章标题和内容生成封面图片（本地生成，无需API调用）
    
    Args:
        title: 文章标题
        content: 文章内容
        size: 图片尺寸，默认为1024x1024
    
    Returns:
        图片URL或本地路径
    """
    try:
        # 解析尺寸
        width, height = map(int, size.split('x'))
        
        # 生成随机背景色
        background_color = generate_random_color()
        
        # 创建图片
        image = Image.new('RGB', (width, height), background_color)
        draw = ImageDraw.Draw(image)
        
        # 尝试加载字体，如果没有则使用默认字体
        try:
            # 尝试使用系统字体
            font = ImageFont.truetype("arial.ttf", 48)
        except:
            # 使用默认字体
            font = ImageFont.load_default()
        
        # 计算标题位置
        title_bbox = draw.textbbox((0, 0), title, font=font)
        title_width = title_bbox[2] - title_bbox[0]
        title_height = title_bbox[3] - title_bbox[1]
        title_x = (width - title_width) // 2
        title_y = height // 3
        
        # 绘制标题
        draw.text((title_x, title_y), title, font=font, fill=(255, 255, 255))
        
        # 提取文章内容的前100个字符作为副标题
        if content:
            content_snippet = content[:100] + "..." if len(content) > 100 else content
            
            try:
                subtitle_font = ImageFont.truetype("arial.ttf", 24)
            except:
                subtitle_font = ImageFont.load_default()
            
            # 计算副标题位置
            subtitle_bbox = draw.textbbox((0, 0), content_snippet, font=subtitle_font)
            subtitle_width = subtitle_bbox[2] - subtitle_bbox[0]
            subtitle_x = (width - subtitle_width) // 2
            subtitle_y = title_y + title_height + 40
            
            # 绘制副标题
            draw.text((subtitle_x, subtitle_y), content_snippet, font=subtitle_font, fill=(240, 240, 240))
        
        # 创建图片保存目录
        image_dir = "static/images/covers"
        os.makedirs(image_dir, exist_ok=True)
        
        # 生成唯一的文件名
        import uuid
        filename = f"cover_{uuid.uuid4()}.png"
        image_path = os.path.join(image_dir, filename)
        
        # 保存图片
        image.save(image_path)
        
        # 返回相对路径，用于存储在数据库中
        return f"/static/images/covers/{filename}"
        
    except Exception as e:
        print(f"图片生成失败: {e}")
        return None


def generate_random_color():
    """
    生成随机的背景颜色
    
    Returns:
        (r, g, b) 颜色元组
    """
    # 生成柔和的背景色
    r = random.randint(50, 150)
    g = random.randint(50, 150)
    b = random.randint(50, 150)
    return (r, g, b)


def generate_image_from_prompt(prompt, size="1024x1024"):
    """
    根据自定义提示词生成图片（本地生成，无需API调用）
    
    Args:
        prompt: 图片生成提示词
        size: 图片尺寸，默认为1024x1024
    
    Returns:
        图片URL或本地路径
    """
    try:
        # 解析尺寸
        width, height = map(int, size.split('x'))
        
        # 生成随机背景色
        background_color = generate_random_color()
        
        # 创建图片
        image = Image.new('RGB', (width, height), background_color)
        draw = ImageDraw.Draw(image)
        
        # 尝试加载字体
        try:
            font = ImageFont.truetype("arial.ttf", 36)
        except:
            font = ImageFont.load_default()
        
        # 计算文本位置
        text_bbox = draw.textbbox((0, 0), prompt, font=font)
        text_width = text_bbox[2] - text_bbox[0]
        text_height = text_bbox[3] - text_bbox[1]
        text_x = (width - text_width) // 2
        text_y = (height - text_height) // 2
        
        # 绘制文本
        draw.text((text_x, text_y), prompt, font=font, fill=(255, 255, 255))
        
        # 创建图片保存目录
        image_dir = "static/images/generated"
        os.makedirs(image_dir, exist_ok=True)
        
        # 生成唯一的文件名
        import uuid
        filename = f"generated_{uuid.uuid4()}.png"
        image_path = os.path.join(image_dir, filename)
        
        # 保存图片
        image.save(image_path)
        
        # 返回相对路径
        return f"/static/images/generated/{filename}"
        
    except Exception as e:
        print(f"图片生成失败: {e}")
        return None