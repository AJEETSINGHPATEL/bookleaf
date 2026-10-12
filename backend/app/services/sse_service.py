import asyncio
import json
from typing import Dict, Set
from fastapi.responses import StreamingResponse

class SSEBroadcaster:
    def __init__(self):
        # Set of active subscriber queues
        self.subscribers: Set[asyncio.Queue] = set()

    async def subscribe(self) -> asyncio.Queue:
        queue = asyncio.Queue()
        self.subscribers.add(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue):
        if queue in self.subscribers:
            self.subscribers.remove(queue)

    async def broadcast(self, event_type: str, data: dict):
        payload = f"event: {event_type}\ndata: {json.dumps(data, default=str)}\n\n"
        for queue in list(self.subscribers):
            try:
                await queue.put(payload)
            except Exception:
                pass

broadcaster = SSEBroadcaster()
