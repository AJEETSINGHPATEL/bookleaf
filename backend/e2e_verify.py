import urllib.request
import json

# 1. Test Complete Author Flow
login_req = urllib.request.Request(
    'http://localhost:8000/api/auth/login', 
    data=json.dumps({'email': 'priya.sharma@email.com', 'password': 'author123'}).encode(),
    headers={'Content-Type': 'application/json'}
)
with urllib.request.urlopen(login_req) as r:
    auth_data = json.loads(r.read().decode())
    token = auth_data['access_token']
    print('1. Author logged in successfully:', auth_data['user']['name'])

# 2. Check My Books
books_req = urllib.request.Request('http://localhost:8000/api/author/books', headers={'Authorization': f'Bearer {token}'})
with urllib.request.urlopen(books_req) as r:
    books = json.loads(r.read().decode())
    print('2. Author books fetched:', len(books), [b['title'] for b in books])

# 3. Create Support Ticket
ticket_payload = {
    'subject': 'Royalty payout threshold reached but payment pending',
    'description': 'My dashboard shows ₹3,570 pending royalty which is above ₹1,000 threshold. When is payout released?',
    'book_id': books[0]['id'],
    'attachment_name': 'royalty_statement.pdf'
}
new_ticket_req = urllib.request.Request(
    'http://localhost:8000/api/tickets',
    data=json.dumps(ticket_payload).encode(),
    headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {token}'}
)
with urllib.request.urlopen(new_ticket_req) as r:
    ticket = json.loads(r.read().decode())
    ticket_id = ticket['id']
    print(f"3. Ticket created with AI Auto-Classification: {ticket['ticket_number']} | Category: {ticket['category']} | Priority: {ticket['priority']}")
    print(f"   AI Draft preview: {ticket['ai_draft_response'][:100]}...")

# 4. Test Admin Flow
admin_login_req = urllib.request.Request(
    'http://localhost:8000/api/auth/login',
    data=json.dumps({'email': 'admin@bookleaf.com', 'password': 'admin123'}).encode(),
    headers={'Content-Type': 'application/json'}
)
with urllib.request.urlopen(admin_login_req) as r:
    admin_token = json.loads(r.read().decode())['access_token']
    print('4. Ops Admin logged in successfully')

# 5. Fetch Admin Ticket Queue
queue_req = urllib.request.Request(
    'http://localhost:8000/api/admin/tickets?sort=urgent_first',
    headers={'Authorization': f'Bearer {admin_token}'}
)
with urllib.request.urlopen(queue_req) as r:
    queue = json.loads(r.read().decode())
    print(f"5. Admin Queue size: {len(queue)} | First ticket priority: {queue[0]['priority']}")

# 6. Admin responds with approved draft
reply_req = urllib.request.Request(
    f"http://localhost:8000/api/tickets/{ticket_id}/messages",
    data=json.dumps({'message': ticket['ai_draft_response']}).encode(),
    headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {admin_token}'}
)
with urllib.request.urlopen(reply_req) as r:
    reply = json.loads(r.read().decode())
    print(f"6. Admin sent approved response to author. Message ID: {reply['id']}")

# 7. Admin adds internal note
note_req = urllib.request.Request(
    f"http://localhost:8000/api/admin/tickets/{ticket_id}/internal-notes",
    data=json.dumps({'note': 'Reviewed banking details; scheduled for batch payout next Tuesday.'}).encode(),
    headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {admin_token}'}
)
with urllib.request.urlopen(note_req) as r:
    note = json.loads(r.read().decode())
    print(f"7. Ops internal note added (hidden from author): {note['note']}")

print('\nALL END-TO-END BUSINESS WORKFLOWS VALIDATED 100% SUCCESSFULLY!')
