import psycopg2

pw = "Book@9170#3$1"

configs = [
    {"host": "aws-0-ap-south-1.pooler.supabase.com", "port": 6543, "user": "postgres.jjsawllnjyfbzousmarh"},
    {"host": "aws-0-ap-south-1.pooler.supabase.com", "port": 5432, "user": "postgres.jjsawllnjyfbzousmarh"},
    {"host": "aws-0-us-east-1.pooler.supabase.com", "port": 6543, "user": "postgres.jjsawllnjyfbzousmarh"},
    {"host": "aws-0-us-east-1.pooler.supabase.com", "port": 5432, "user": "postgres.jjsawllnjyfbzousmarh"},
    {"host": "aws-0-eu-central-1.pooler.supabase.com", "port": 6543, "user": "postgres.jjsawllnjyfbzousmarh"},
    {"host": "aws-0-ap-southeast-1.pooler.supabase.com", "port": 6543, "user": "postgres.jjsawllnjyfbzousmarh"},
    {"host": "db.jjsawllnjyfbzousmarh.supabase.co", "port": 5432, "user": "postgres"},
]

for cfg in configs:
    try:
        conn = psycopg2.connect(
            host=cfg["host"],
            port=cfg["port"],
            user=cfg["user"],
            password=pw,
            dbname="postgres",
            connect_timeout=4
        )
        print("SUCCESS with config:", cfg)
        conn.close()
        break
    except Exception as e:
        print("Failed", cfg["host"], cfg["port"], "->", e)
