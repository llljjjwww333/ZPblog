import io
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
import PyPDF2

router = APIRouter()

@router.post("/parse-pdf")
async def parse_pdf(file: UploadFile = File(...)):
    """
    解析 PDF 文件并提取文本内容，保留原始格式
    """
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="请上传 PDF 文件")
    
    try:
        # 读取文件内容
        contents = await file.read()
        
        # 使用 PyPDF2 解析 PDF
        pdf_file = io.BytesIO(contents)
        pdf_reader = PyPDF2.PdfReader(pdf_file)
        
        full_text = ""
        num_pages = len(pdf_reader.pages)
        
        # 提取每一页的文本
        for page_num in range(num_pages):
            page = pdf_reader.pages[page_num]
            page_text = page.extract_text()
            
            if page_text:
                # 保留原始格式，只移除行尾多余的空格
                lines = page_text.split('\n')
                cleaned_lines = []
                for line in lines:
                    # 移除行尾空格，但保留空行
                    cleaned_line = line.rstrip()
                    cleaned_lines.append(cleaned_line)
                
                # 重新组合文本
                page_text = '\n'.join(cleaned_lines)
                page_text = page_text.strip()
                
                if page_text:
                    if full_text:
                        full_text += "\n\n"
                    full_text += page_text
        
        return JSONResponse({
            "success": True,
            "text": full_text,
            "pages": num_pages,
            "filename": file.filename
        })
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF 解析失败: {str(e)}")
