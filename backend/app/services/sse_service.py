import asyncio
import json
from typing import Dict, Set
from fastapi.responses import StreamingResponse

class SSESubscriber:
    def __init__(self, queue: asyncio.Queue, user_id: int, role: str):
        self.queue = queue
        self.user_id = user_id
        self.role = role

class SSEBroadcaster:
    def __init__(self):
        # Set of active subscribers with identity
        self.subscribers: Set[SSESubscriber] = set()

    async def subscribe(self, user_id: int, role: str) -> SSESubscriber:
        queue = asyncio.Queue()
        sub = SSESubscriber(queue, user_id, role)
        self.subscribers.add(sub)
        return sub

    def unsubscribe(self, sub: SSESubscriber):
        if sub in self.subscribers:
            self.subscribers.remove(sub)

    async def broadcast(self, event_type: str, data: dict, target_user_id: int = None):
        """
        Broadcasts an event.
        - If target_user_id is provided, delivers only to that user and admins.
        - Admins always receive operational updates.
        """
        payload = f"event: {event_type}\ndata: {json.dumps(data, default=str)}\n\n"
        for sub in list(self.subscribers):
            try:
                # Admins get everything; authors only get events targeted to them or general
                if sub.role == "admin" or target_user_id is None or str(sub.user_id) == str(target_user_id):
                    await sub.queue.put(payload)
            except Exception:
                pass

broadcaster = SSEBroadcaster()
