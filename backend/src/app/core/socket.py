class ConnectionManager:
    def __init__(self):
        # 存储活动连接: {user_id: websocket}
        self.active_connections = {}
    
    async def connect(self, websocket, user_id: int):
        await websocket.accept()
        self.active_connections[user_id] = websocket
    
    def disconnect(self, user_id: int):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
    
    async def send_personal_message(self, message: dict, user_id: int):
        if user_id in self.active_connections:
            # message 应该是一个字典，send_json 会自动将其转换为 JSON 字符串发送
            # 如果传入的是字符串（json.dumps后的），应该使用 send_text 或者确保前端能处理
            # 这里保持与原有逻辑一致，使用 send_json，所以调用方不应该自己 json.dumps
            import json
            if isinstance(message, str):
                # 如果已经是字符串，尝试解析回对象，或者直接发送文本
                try:
                    msg_obj = json.loads(message)
                    await self.active_connections[user_id].send_json(msg_obj)
                except:
                    await self.active_connections[user_id].send_text(message)
            else:
                await self.active_connections[user_id].send_json(message)

manager = ConnectionManager()
