import psycopg2
import urllib.parse

pw = urllib.parse.unquote("book%40321%232%24134")
print("Decoded password:", repr(pw))

targets = [
    {"host": "aws-0-ap-southeast-1.pooler.supabase.com", "port": 6543, "user": "postgres.jjsawllnjyfbzousmarh"},
    {"host": "aws-0-ap-southeast-1.pooler.supabase.com", "port": 5432, "user": "postgres.jjsawllnjyfbzousmarh"},
    {"host": "db.jjsawllnjyfbzousmarh.supabase.co", "port": 6543, "user": "postgres"},
    {"host": "db.jjsawllnjyfbzousmarh.supabase.co", "port": 5432, "user": "postgres"},
]

for t in targets:
    try:
        conn = psycopg2.connect(
            host=t["host"],
            port=t["port"],
            user=t["user"],
            password=pw,
            dbname="postgres",
            connect_timeout=4
        )
        print("SUCCESS! Connected to Supabase with target:", t)
        cur = conn.cursor()
        cur.execute("SELECT version();")
        print("Version:", cur.fetchone()[0])
        conn.close()
        break
    except Exception as e:
        print("Failed", t["host"], t["port"], "->", e)
