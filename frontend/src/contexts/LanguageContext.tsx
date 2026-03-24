import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Language = 'zh' | 'en';

type Translations = {
  [key: string]: string;
};

const translations: Record<Language, Translations> = {
  zh: {
    // 通用
    'app.title': 'ZPblog',
    'app.title.forum': '发布，交流，连接',
    'app.welcome': '欢迎使用个人博客系统',
    'app.welcome.desc': '这是您的个人博客管理后台。下方是所有公开的文章。',
    'app.welcome.guest': '这是您的个人博客管理后台，您可以在这里创建、编辑和管理您的文章。',
    'common.login': '登录',
    'common.register': '注册',
    'common.explore': '探索',
    'common.logout': '退出登录',
    'common.confirm': '确定',
    'common.cancel': '取消',
    'common.save': '保存',
    'common.saving': '保存中...',
    'common.delete': '删除',
    'common.edit': '编辑',
    'common.create': '新建',
    'common.back': '返回',
    'common.loading': '加载中...',
    'common.error': '错误',
    'common.retry': '重试',
    'common.optional': '（可选）',
    'common.success': '成功',
    'common.settings': '设置',
    'common.language': '语言',
    'common.close': '关闭',

    // 导航
    'nav.home': '首页',
    'nav.articles': '我的文章',
    'nav.categories': '文章分类',
    'nav.recommended': '推荐',
    'nav.tags': '标签管理',
    'nav.comments': '评论管理',
    'nav.create_article': '新建文章',
    'nav.edit_article': '编辑文章',
    'nav.welcome_back': '欢迎回来',

    // 仪表盘
    'dashboard.welcome_message': '欢迎回来',
    'dashboard.total_articles': '文章总数',
    'dashboard.total_views': '总阅读量',
    'dashboard.categories': '分类数量',
    'dashboard.recent_articles': '最近文章',
    'dashboard.quick_actions': '快捷操作',
    'dashboard.no_articles': '暂无文章',
    'common.view_all': '查看全部',

    // 文章列表
    'article.list.title': '我的文章',
    'article.list.create': '新建文章',
    'article.list.empty': '暂无文章，点击"新建文章"创建第一篇文章吧！',
    'article.list.id': 'ID',
    'article.list.title_col': '标题',
    'article.list.status': '状态',
    'article.list.views': '阅读量',
    'article.list.created_at': '创建时间',
    'article.list.actions': '操作',

    'article.status.draft': '草稿',
    'article.status.published': '已发布',
    'article.status.private': '私密',

    'article.status.all': '全部状态',
    'article.delete.confirm': '确定要删除这篇文章吗？',

    // 文章编辑
    'article.editor.new': '新建文章',
    'article.editor.edit': '编辑文章',
    'article.editor.title': '标题 *',
    'article.editor.title.placeholder': '请输入文章标题',
    'article.editor.slug': 'URL别名',
    'article.editor.slug.placeholder': 'URL友好的标识符，如 my-article',
    'article.editor.content': '内容 (Markdown) *',
    'article.editor.content.placeholder': '使用Markdown格式编写文章内容',
    'article.editor.publish': '发布',
    'article.editor.status': '状态',
    'article.editor.save_draft': '保存草稿',
    'article.editor.excerpt': '摘要',
    'article.editor.excerpt.placeholder': '文章摘要，会在列表中显示',
    'article.editor.cover': '封面图',
    'article.editor.cover.placeholder': '封面图片URL',
    'article.editor.category': '分类',
    'article.editor.category.select': '选择分类...',

    // 分类管理
    'category.title': '文章分类',
    'category.create': '新建分类',
    'category.delete.confirm': '确定要删除分类 "{name}" 吗？',
    'category.form.name': '分类名称 *',
    'category.form.name.placeholder': '请输入分类名称',
    'category.form.slug': 'URL别名',
    'category.form.slug.placeholder': 'URL友好的标识符，如 my-category',
    'category.form.desc': '分类描述',
    'category.form.desc.placeholder': '请输入分类描述',
    'category.form.parent': '父分类',
    'category.form.parent.none': '无（根分类）',
    'category.form.order': '排序权重',
    'category.empty': '暂无分类，点击"新建分类"创建第一个分类吧！',
    'category.root': '根分类',
    'category.child': '子分类',
    'category.order': '排序',

    'public.cover_story': '封面故事',
    'public.continue_reading': '继续阅读',
    'public.latest': '最新文章',
    'public.latest_news': '最新文章',
    'public.category.uncategorized': '未分类',
    'public.prev_page': '上一页',
    'public.next_page': '下一页',
    'public.empty': '暂无公开文章',
    'public.read': '阅读',
    'public.read_more': '阅读全文',
    'public.author': '作者',

    // 文章详情
    'detail.back': '返回',
    'detail.published_at': '发布于',
    'detail.views': '阅读',
    'detail.category_id': '分类ID',
    'detail.excerpt': '摘要：',
    'detail.no_content': '无内容',
    'share.button': '分享',
    'share.title': '分享给好友',
    'share.send': '发送',
    'share.success': '分享成功',
    'share.failed': '分享失败',
    'share.error_fetch_friends': '获取好友列表失败',

    // 用户相关
    'user.info': '个人信息',
    'user.profile': '个人空间',
    'user.username': '用户名',
    'user.username_or_email': '用户名或邮箱',
    'user.password': '密码',
    'user.email': '邮箱',
    'user.nickname': '昵称',
    'user.no_nickname': '暂无昵称',
    'user.created_at': '注册时间',
    'user.change_avatar': '修改头像',
    'user.login.title': '登录',
    'user.login.subtitle': '欢迎回到ZPblog',
    'user.register.title': '注册',
    'user.register.subtitle': '创建您的账号',
    'user.login.username_placeholder': '请输入用户名或邮箱',
    'user.login.password_placeholder': '请输入密码',
    'user.register.username_placeholder': '请输入用户名',
    'user.register.email_placeholder': '请输入邮箱',
    'user.register.nickname_placeholder': '请输入昵称',
    'user.register.password_placeholder': '请输入密码',
    'user.register.confirm_password': '确认密码',
    'user.register.confirm_password_placeholder': '请再次输入密码',
    'user.login.submit': '登录',
    'user.register.submit': '注册',
    'user.login_register': '登录/注册',
    
    // 个人空间
    'profile.stats.articles': '文章',
    'profile.stats.comments': '评论',
    'profile.stats.likes': '获赞',
    'profile.edit.bio': '编辑简介',
    'profile.change_bg': '更换背景',

    // 搜索
    'search.placeholder': '搜索文章标题...',
    'search.button': '搜索',

    // 滚动提示
    'app.scroll.desc': '向下滚动查看文章',

    // 评论系统
    'comment.title': '评论 ({count})',
    'comment.placeholder': '写下你的评论...',
    'comment.anonymous': '匿名评论',
    'comment.submitting': '发送中...',
    'comment.submit': '发表评论',
    'comment.login_hint': '登录后发表评论',
    'comment.loading': '加载评论中...',
    'comment.empty': '暂无评论，快来抢沙发吧！',
    'comment.anonymous_user': '匿名用户',
    'comment.unknown_user': '未知用户',
    'comment.error.create': '发表评论失败',
    'comment.error.login': '请先登录',

    // 通知
    'notification.title': '消息通知',
    'notification.empty': '暂无新消息',
    'notification.mark_all_read': '一键已读',
    'notification.delete_all': '一键删除',
    'notification.confirm_delete_all': '确定要删除所有通知吗？',
    'notification.commented': '评论了你的文章',
    'notification.unknown_post': '未知文章',

    // 社交系统
    'nav.friends': '好友',
    'friends.title': '好友管理',
    'friends.my_friends': '我的好友',
    'friends.requests': '好友请求',
    'friends.find_friends': '查找好友',
    'friends.no_friends': '暂无好友，快去添加一些吧！',
    'friends.no_requests': '暂无好友请求',
    'friends.no_results': '未找到用户',
    'friends.search_placeholder': '输入用户名搜索...',
    'friends.add_friend': '添加好友',
    'friends.sent_request': '请求已发送',
    'friends.already_friends': '已是好友',
    
    // 聊天
    'chat.no_messages': '暂无消息',
    'chat.start_conversation': '发送第一条消息开始聊天吧！',
    'chat.placeholder': '输入消息...',
    'chat.send': '发送',
    'chat.sending': '发送中...',
    'chat.send_failed': '发送失败',

    // 页脚
    'footer.navigation': '站点导航',
    'footer.sitemap': '网站地图',
    'footer.rss': 'RSS 订阅',
    'footer.hosting': '托管与统计',
    'footer.hosting_on': '自托管服务',
    'footer.tech_stack': '技术栈',
    'footer.powered_by': '基于 FastAPI & React',
    'footer.contact': '联系我们',
    'footer.copyright': '版权所有',

    // 推荐模块
    'recommendation.title': '推荐文章',
    'recommendation.subtitle': '基于您的兴趣为您推荐的内容',
    'recommendation.algorithm': '推荐算法',
    'recommendation.ai': 'AI智能',
    'recommendation.hybrid': '混合推荐',
    'recommendation.popular': '热门文章',
    'recommendation.collaborative': '协同过滤',
    'recommendation.content': '内容推荐',
    'recommendation.ai_reason': '推荐理由',
    'recommendation.ai_model': 'AI模型',
    'recommendation.no_posts': '暂无推荐文章',
    'recommendation.loading': '加载推荐中...',
    'recommendation.view_count': '阅读量',
    'recommendation.read_more': '阅读全文',
    'recommendation.refresh': '刷新推荐',
    'recommendation.refresh_title': '清除缓存，重新获取AI推荐',
    'recommendation.cache_left': '缓存有效期还剩 {minutes} 分钟',
    'recommendation.cache_hint': '（切换其他算法再切回AI，不会重复调用API）',
    'recommendation.feedback_hint': '点击感兴趣的文章，AI 会学习您的偏好；未点击的文章将被记录为跳过，用于优化后续推荐',

    // AI写作功能
    'ai.writing.title': 'AI写作助手',
    'ai.polish.title': '✨ AI润色',
    'ai.polish.style': '润色风格',
    'ai.polish.style.fluent': '流畅易读',
    'ai.polish.style.professional': '专业正式',
    'ai.polish.style.concise': '精简凝练',
    'ai.polish.style.creative': '创意文学',
    'ai.polish.hint.selected': '将对选中的文本进行润色',
    'ai.polish.hint.full': '将对整篇文章进行润色',
    'ai.polish.start': '开始润色',
    'ai.polish.polishing': '润色中...',
    'ai.polish.result': '润色结果',
    'ai.polish.apply': '应用润色',
    'ai.polish.error.empty': '请先输入或选择一些内容',
    'ai.polish.error.failed': 'AI润色失败，请稍后重试',

    'ai.continue.title': '📝 AI续写',
    'ai.continue.context': '续写要求（可选）',
    'ai.continue.context.placeholder': '例如：详细展开第一段的观点',
    'ai.continue.hint': 'AI将根据已有内容智能续写约200-500字',
    'ai.continue.start': '开始续写',
    'ai.continue.continuing': '续写中...',
    'ai.continue.result': '续写内容',
    'ai.continue.insert': '插入续写',
    'ai.continue.error.empty': '请先输入一些内容',
    'ai.continue.error.failed': 'AI续写失败，请稍后重试',

    'ai.generating': 'AI生成中...',
    'ai.cancel': '取消',
    'ai.close': '关闭',

    // 读者评审
    'reader_review.title': '📚 AI 读者评审',
    'reader_review.description': '选择不同的读者角色，从多角度获得文章改进建议',
    'reader_review.select_roles': '选择评审角色',
    'reader_review.start_review': '开始评审',
    'reader_review.reviewing': '评审中...',
    'reader_review.selected_count': '已选择 {count} 个角色',
    'reader_review.summary': '评审摘要',
    'reader_review.issues': '发现问题',
    'reader_review.suggestions': '改进建议',
    'reader_review.full_review': '完整评审意见',
    'reader_review.error.empty_content': '请先输入文章标题和内容',
    'reader_review.error.failed': '评审失败，请稍后重试',
    'reader_review.error.add_persona_first': '请先添加至少一个自定义读者',
    'reader_review.custom_required': '（需自定义）',
    'reader_review.add_custom_persona': '添加自定义读者',
    'reader_review.persona_name_placeholder': '读者名称（如：产品经理）',
    'reader_review.persona_desc_placeholder': '描述读者的背景和需求...',
    'reader_review.loading_roles': '加载角色列表中...',
    'reader_review.multi_agent': '多智能体评审',

    // 多智能体协作评审
    'multi_agent.title': '多智能体协作评审',
    'multi_agent.select_llm': '选择大模型',
    'multi_agent.select_hint': '请选择两个或更多的大模型进行多轮讨论，从不同角度评审您的文章',
    'multi_agent.select_two_llm': '请至少选择两个大模型进行多智能体评审',
    'multi_agent.start_review': '开始协作评审',
    'multi_agent.reviewing': '评审中...',
    'multi_agent.initializing': '正在初始化多智能体评审...',
    'multi_agent.phase_initial': '独立评审阶段',
    'multi_agent.phase_discussion': '讨论阶段',
    'multi_agent.phase_consensus': '达成共识阶段',
    'multi_agent.type_review': '评审意见',
    'multi_agent.type_response': '回应',
    'multi_agent.type_consensus': '共识',
    'multi_agent.type_question': '提问',
    'multi_agent.rewrite_failed': '生成修改建议失败，请重试',
    'multi_agent.empty_content_error': '修改后的内容为空，无法应用',

    // AI 文章修改
    'ai_rewrite.config.title': 'AI 修改配置',
    'ai_rewrite.config.max_rounds': '修改轮次',
    'ai_rewrite.config.round': '轮',
    'ai_rewrite.config.rounds': '轮',
    'ai_rewrite.config.focus_areas': '重点优化方向',
    'ai_rewrite.start': '开始修改',
    'ai_rewrite.rewriting': '修改中...',
    'ai_rewrite.continue': '继续修改',
    'ai_rewrite.continuing': '继续修改中...',
    'ai_rewrite.apply': '应用修改',
    'ai_rewrite.cancel': '取消',
    'ai_rewrite.round_result': '第 {round} 轮修改结果',
    'ai_rewrite.explanation': '修改说明',
    'ai_rewrite.comparison': '修改对比',
    'ai_rewrite.original_title': '原标题',
    'ai_rewrite.new_title': '新标题',
    'ai_rewrite.original_content': '原文',
    'ai_rewrite.new_content': '修改后',
    'ai_rewrite.error.failed': '修改失败，请重试',
  },
  en: {
    // General
    'app.title': 'ZPblog',
    'app.title.forum': 'Publish, Share, Connect',
    'app.welcome': 'Welcome to Personal Blog System',
    'app.welcome.desc': 'This is your blog management dashboard. Below are all public articles.',
    'app.welcome.guest': 'This is your blog management dashboard where you can create, edit, and manage your articles.',
    'common.login': 'Login',
    'common.register': 'Register',
    'common.explore': 'Explore',
    'common.logout': 'Logout',
    'common.confirm': 'Confirm',
    'common.cancel': 'Cancel',
    'common.save': 'Save',
    'common.saving': 'Saving...',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.create': 'Create',
    'common.back': 'Back',
    'common.loading': 'Loading...',
    'common.error': 'Error',
    'common.retry': 'Retry',
    'common.optional': '(Optional)',
    'common.success': 'Success',
    'common.settings': 'Settings',
    'common.language': 'Language',
    'common.close': 'Close',

    // Navigation
    'nav.home': 'Home',
    'nav.articles': 'My Articles',
    'nav.categories': 'Article Categories',
    'nav.recommended': 'Recommended',
    'nav.tags': 'Tags',
    'nav.comments': 'Comments',
    'nav.create_article': 'New Article',
    'nav.edit_article': 'Edit Article',
    'nav.welcome_back': 'Welcome Back',

    // Dashboard
    'dashboard.welcome_message': 'Welcome Back',
    'dashboard.total_articles': 'Total Articles',
    'dashboard.total_views': 'Total Views',
    'dashboard.categories': 'Categories',
    'dashboard.recent_articles': 'Recent Articles',
    'dashboard.quick_actions': 'Quick Actions',
    'dashboard.no_articles': 'No articles found',
    'common.view_all': 'View All',

    // Article List
    'article.list.title': 'My Articles',
    'article.list.create': 'New Article',
    'article.list.empty': 'No articles yet. Click "New Article" to create one!',
    'article.list.id': 'ID',
    'article.list.title_col': 'Title',
    'article.list.status': 'Status',
    'article.list.views': 'Views',
    'article.list.created_at': 'Created At',
    'article.list.actions': 'Actions',
    'article.status.draft': 'Draft',
    'article.status.published': 'Published',
    'article.status.private': 'Private',

    'article.status.all': 'All Status',
    'article.delete.confirm': 'Are you sure you want to delete this article?',

    // Article Editor
    'article.editor.new': 'New Article',
    'article.editor.edit': 'Edit Article',
    'article.editor.title': 'Title *',
    'article.editor.title.placeholder': 'Enter article title',
    'article.editor.slug': 'URL Slug',
    'article.editor.slug.placeholder': 'URL friendly identifier, e.g. my-article',
    'article.editor.content': 'Content (Markdown) *',
    'article.editor.content.placeholder': 'Write content in Markdown',
    'article.editor.publish': 'Publish',
    'article.editor.status': 'Status',
    'article.editor.save_draft': 'Save Draft',
    'article.editor.excerpt': 'Excerpt',
    'article.editor.excerpt.placeholder': 'Article excerpt, shown in list',
    'article.editor.cover': 'Cover Image',
    'article.editor.cover.placeholder': 'Cover image URL',
    'article.editor.category': 'Category',
    'article.editor.category.select': 'Select category...',

    // Category Management
    'category.title': 'Article Categories',
    'category.create': 'New Category',
    'category.delete.confirm': 'Are you sure you want to delete category "{name}"?',
    'category.form.name': 'Name *',
    'category.form.name.placeholder': 'Enter category name',
    'category.form.slug': 'URL Slug',
    'category.form.slug.placeholder': 'URL friendly identifier, e.g. my-category',
    'category.form.desc': 'Description',
    'category.form.desc.placeholder': 'Enter category description',
    'category.form.parent': 'Parent Category',
    'category.form.parent.none': 'None (Root)',
    'category.form.order': 'Order Weight',
    'category.empty': 'No categories yet. Click "New Category" to create one!',
    'category.root': 'Root',
    'category.child': 'Child',
    'category.order': 'Order',

    'public.cover_story': 'COVER STORY',
    'public.continue_reading': 'CONTINUE READING',
    'public.latest': 'LATEST ARTICLES',
    'public.latest_news': 'LATEST NEWS',
    'public.category.uncategorized': 'Uncategorized',
    'public.prev_page': 'Previous',
    'public.next_page': 'Next',
    'public.empty': 'No public articles',
    'public.read': 'Views',
    'public.read_more': 'Read More',
    'public.author': 'Author',

    // Article Detail
    'detail.back': 'Back',
    'detail.published_at': 'Published at',
    'detail.views': 'Views',
    'detail.category_id': 'Category ID',
    'detail.excerpt': 'Excerpt:',
    'detail.no_content': 'No content',
    'share.button': 'Share',
    'share.title': 'Share to Friend',
    'share.send': 'Send',
    'share.success': 'Shared successfully',
    'share.failed': 'Share failed',
    'share.error_fetch_friends': 'Failed to fetch friends',

    // User Related
    'user.info': 'User Info',
    'user.profile': 'My Profile',
    'user.username': 'Username',
    'user.username_or_email': 'Username or Email',
    'user.password': 'Password',
    'user.email': 'Email',
    'user.nickname': 'Nickname',
    'user.no_nickname': 'No nickname',
    'user.created_at': 'Registered At',
    'user.change_avatar': 'Change Avatar',
    'user.login.title': 'Login',
    'user.login.subtitle': 'Welcome back to ZPblog',
    'user.register.title': 'Register',
    'user.register.subtitle': 'Create your account',
    'user.login.username_placeholder': 'Enter username or email',
    'user.login.password_placeholder': 'Enter password',
    'user.register.username_placeholder': 'Enter username',
    'user.register.email_placeholder': 'Enter email',
    'user.register.nickname_placeholder': 'Enter nickname (optional)',
    'user.register.password_placeholder': 'Enter password',
    'user.register.confirm_password': 'Confirm Password',
    'user.register.confirm_password_placeholder': 'Re-enter password',
    'user.login.submit': 'Login',
    'user.register.submit': 'Register',
    'user.login_register': 'Login/Register',

    // Profile
    'profile.stats.articles': 'Articles',
    'profile.stats.comments': 'Comments',
    'profile.stats.likes': 'Likes',
    'profile.edit.bio': 'Edit Bio',
    'profile.change_bg': 'Change Background',

    // Search
    'search.placeholder': 'Search article title...',
    'search.button': 'Search',

    // Scroll hint
    'app.scroll.desc': 'Scroll down to view articles',

    // Comment System
    'comment.title': 'Comments ({count})',
    'comment.placeholder': 'Write your comment...',
    'comment.anonymous': 'Anonymous',
    'comment.submitting': 'Sending...',
    'comment.submit': 'Post Comment',
    'comment.login_hint': 'Login to post comments',
    'comment.loading': 'Loading comments...',
    'comment.empty': 'No comments yet. Be the first to comment!',
    'comment.anonymous_user': 'Anonymous User',
    'comment.unknown_user': 'Unknown User',
    'comment.error.create': 'Failed to post comment',
    'comment.error.login': 'Please login first',

    // Notification
    'notification.title': 'Notifications',
    'notification.empty': 'No new notifications',
    'notification.mark_all_read': 'Read All',
    'notification.delete_all': 'Clear All',
    'notification.confirm_delete_all': 'Are you sure you want to delete all notifications?',
    'notification.commented': 'commented on your post',
    'notification.unknown_post': 'Unknown post',

    // Social System
    'nav.friends': 'Friends',
    'friends.title': 'Friends Management',
    'friends.my_friends': 'My Friends',
    'friends.requests': 'Friend Requests',
    'friends.find_friends': 'Find Friends',
    'friends.no_friends': 'No friends yet. Go add some!',
    'friends.no_requests': 'No friend requests',
    'friends.no_results': 'No users found',
    'friends.search_placeholder': 'Search by username...',
    'friends.add_friend': 'Add Friend',
    'friends.sent_request': 'Request Sent',
    'friends.already_friends': 'Already Friends',
    
    // Chat
    'chat.no_messages': 'No messages',
    'chat.start_conversation': 'Send a message to start chatting!',
    'chat.placeholder': 'Type a message...',
    'chat.send': 'Send',
    'chat.sending': 'Sending...',
    'chat.send_failed': 'Failed to send',

    // Footer
    'footer.navigation': 'Site Navigation',
    'footer.sitemap': 'SiteMap',
    'footer.rss': 'RSS Feed',
    'footer.hosting': 'Hosting & Stats',
    'footer.hosting_on': 'Self-Hosted Service',
    'footer.tech_stack': 'Tech Stack',
    'footer.powered_by': 'Powered by FastAPI & React',
    'footer.contact': 'Contact Us',
    'footer.copyright': 'All Rights Reserved',

    // Recommendation Module
    'recommendation.title': 'Recommended Articles',
    'recommendation.subtitle': 'Content recommended based on your interests',
    'recommendation.algorithm': 'Algorithm',
    'recommendation.ai': 'AI Smart',
    'recommendation.hybrid': 'Hybrid',
    'recommendation.popular': 'Popular',
    'recommendation.collaborative': 'Collaborative',
    'recommendation.content': 'Content-Based',
    'recommendation.ai_reason': 'Why recommended',
    'recommendation.ai_model': 'AI Model',
    'recommendation.no_posts': 'No recommended articles yet',
    'recommendation.loading': 'Loading recommendations...',
    'recommendation.view_count': 'Views',
    'recommendation.read_more': 'Read More',
    'recommendation.refresh': 'Refresh',
    'recommendation.refresh_title': 'Clear cache and get new AI recommendations',
    'recommendation.cache_left': 'Cache valid for {minutes} minutes',
    'recommendation.cache_hint': '(Switch to other algorithms and back to AI will not call API again)',
    'recommendation.feedback_hint': 'Click articles you are interested in, AI will learn your preferences; articles not clicked will be recorded as skipped to optimize future recommendations',

    // AI Writing Features
    'ai.writing.title': 'AI Writing Assistant',
    'ai.polish.title': '✨ AI Polish',
    'ai.polish.style': 'Style',
    'ai.polish.style.fluent': 'Fluent',
    'ai.polish.style.professional': 'Professional',
    'ai.polish.style.concise': 'Concise',
    'ai.polish.style.creative': 'Creative',
    'ai.polish.hint.selected': 'Will polish selected text',
    'ai.polish.hint.full': 'Will polish entire article',
    'ai.polish.start': 'Start Polish',
    'ai.polish.polishing': 'Polishing...',
    'ai.polish.result': 'Polished Result',
    'ai.polish.apply': 'Apply',
    'ai.polish.error.empty': 'Please enter or select some content',
    'ai.polish.error.failed': 'AI polish failed, please try again',

    'ai.continue.title': '📝 AI Continue',
    'ai.continue.context': 'Context (Optional)',
    'ai.continue.context.placeholder': 'e.g., Expand on the first paragraph',
    'ai.continue.hint': 'AI will continue writing about 200-500 words',
    'ai.continue.start': 'Start Continue',
    'ai.continue.continuing': 'Continuing...',
    'ai.continue.result': 'Continued Content',
    'ai.continue.insert': 'Insert',
    'ai.continue.error.empty': 'Please enter some content first',
    'ai.continue.error.failed': 'AI continue failed, please try again',

    'ai.generating': 'AI Generating...',
    'ai.cancel': 'Cancel',
    'ai.close': 'Close',

    // Reader Review
    'reader_review.title': '📚 AI Reader Review',
    'reader_review.description': 'Select different reader roles to get multi-angle article improvement suggestions',
    'reader_review.select_roles': 'Select Review Roles',
    'reader_review.start_review': 'Start Review',
    'reader_review.reviewing': 'Reviewing...',
    'reader_review.selected_count': '{count} roles selected',
    'reader_review.summary': 'Review Summary',
    'reader_review.issues': 'Issues Found',
    'reader_review.suggestions': 'Suggestions',
    'reader_review.full_review': 'Full Review',
    'reader_review.error.empty_content': 'Please enter article title and content first',
    'reader_review.error.failed': 'Review failed, please try again later',
    'reader_review.error.add_persona_first': 'Please add at least one custom reader first',
    'reader_review.custom_required': '(Custom required)',
    'reader_review.add_custom_persona': 'Add Custom Reader',
    'reader_review.persona_name_placeholder': 'Reader name (e.g., Product Manager)',
    'reader_review.persona_desc_placeholder': 'Describe the reader\'s background and needs...',
    'reader_review.loading_roles': 'Loading roles...',
    'reader_review.multi_agent': 'Multi-Agent Review',

    // Multi-Agent Collaborative Review
    'multi_agent.title': 'Multi-Agent Collaborative Review',
    'multi_agent.select_llm': 'Select LLMs',
    'multi_agent.select_hint': 'Please select two or more LLMs for multi-round discussion to review your article from different angles',
    'multi_agent.select_two_llm': 'Please select at least two LLMs for multi-agent review',
    'multi_agent.start_review': 'Start Review',
    'multi_agent.reviewing': 'Reviewing...',
    'multi_agent.initializing': 'Initializing multi-agent review...',
    'multi_agent.phase_initial': 'Initial Review Phase',
    'multi_agent.phase_discussion': 'Discussion Phase',
    'multi_agent.phase_consensus': 'Consensus Phase',
    'multi_agent.type_review': 'Review Opinion',
    'multi_agent.type_response': 'Response',
    'multi_agent.type_consensus': 'Consensus',
    'multi_agent.type_question': 'Question',
    'multi_agent.rewrite_failed': 'Failed to generate rewrite suggestions, please try again',
    'multi_agent.empty_content_error': 'The rewritten content is empty and cannot be applied',

    // AI Rewrite
    'ai_rewrite.config.title': 'AI Rewrite Config',
    'ai_rewrite.config.max_rounds': 'Rewrite Rounds',
    'ai_rewrite.config.round': 'round',
    'ai_rewrite.config.rounds': 'rounds',
    'ai_rewrite.config.focus_areas': 'Focus Areas',
    'ai_rewrite.start': 'Start Rewrite',
    'ai_rewrite.rewriting': 'Rewriting...',
    'ai_rewrite.continue': 'Continue',
    'ai_rewrite.continuing': 'Continuing...',
    'ai_rewrite.apply': 'Apply Changes',
    'ai_rewrite.cancel': 'Cancel',
    'ai_rewrite.round_result': 'Round {round} Result',
    'ai_rewrite.explanation': 'Explanation',
    'ai_rewrite.comparison': 'Comparison',
    'ai_rewrite.original_title': 'Original Title',
    'ai_rewrite.new_title': 'New Title',
    'ai_rewrite.original_content': 'Original',
    'ai_rewrite.new_content': 'Rewritten',
    'ai_rewrite.error.failed': 'Rewrite failed, please try again',
  }
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('zh');

  useEffect(() => {
    const savedLang = localStorage.getItem('language') as Language;
    if (savedLang && (savedLang === 'zh' || savedLang === 'en')) {
      setLanguageState(savedLang);
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('language', lang);
  };

  const t = (key: string, params?: Record<string, string | number>) => {
    let text = translations[language][key] || key;
    
    if (params) {
      Object.entries(params).forEach(([paramKey, value]) => {
        text = text.replace(`{${paramKey}}`, String(value));
      });
    }
    
    return text;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
