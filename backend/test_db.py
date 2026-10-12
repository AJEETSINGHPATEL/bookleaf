import psycopg2

passwords = [
    "Book@9170#3$1",
    "[Book@9170#3$1]",
    "Book@9170#3",
    "Book@9170"
]

host = "db.jjsawllnjyfbzousmarh.supabase.co"
user = "postgres"
dbname = "postgres"
port = 5432

for pw in passwords:
    try:
        conn = psycopg2.connect(
            host=host,
            user=user,
            password=pw,
            dbname=dbname,
            port=port,
            connect_timeout=6
        )
        print("CONNECTED SUCCESSFULLY WITH:", repr(pw))
        conn.close()
        break
    except Exception as e:
        print("Failed for", repr(pw), ":", e)
