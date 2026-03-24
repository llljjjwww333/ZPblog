from fastapi import APIRouter, Depends, Request
from fastapi.responses import Response
from sqlalchemy.orm import Session
from app.database import get_db
from app.model.post import Post
from app.model.category import Category
from app.schemas.post import PostStatus
from datetime import datetime

router = APIRouter(tags=["sitemap"])

@router.get("/sitemap.xml")
async def get_sitemap(request: Request, db: Session = Depends(get_db)):
    """
    Generate XML sitemap
    """
    base_url = str(request.base_url).rstrip("/")
    # If running locally or behind proxy, you might want to force a specific domain
    # base_url = "https://yourdomain.com" 
    
    # Start XML content
    xml_content = ['<?xml version="1.0" encoding="UTF-8"?>']
    xml_content.append('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    
    # Add static pages
    static_pages = [
        "/",
        "/#/login",
        "/#/register",
    ]
    
    for path in static_pages:
        xml_content.append(f"""
    <url>
        <loc>{base_url}{path}</loc>
        <changefreq>daily</changefreq>
        <priority>0.8</priority>
    </url>""")

    # Add posts
    posts = db.query(Post).filter(Post.status == PostStatus.PUBLISHED.value).all()
    for post in posts:
        last_mod = post.updated_at or post.created_at or datetime.now()
        xml_content.append(f"""
    <url>
        <loc>{base_url}/#/article/{post.id}</loc>
        <lastmod>{last_mod.date().isoformat()}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>1.0</priority>
    </url>""")
        
    # Add categories (if you have a category page)
    # categories = db.query(Category).all()
    # for category in categories:
    #     xml_content.append(f"""
    # <url>
    #     <loc>{base_url}/#/category/{category.id}</loc>
    #     <changefreq>weekly</changefreq>
    #     <priority>0.6</priority>
    # </url>""")

    xml_content.append('</urlset>')
    
    return Response(content="".join(xml_content), media_type="application/xml")
