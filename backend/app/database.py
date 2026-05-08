import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise Exception("Supabase credentials not found in .env")

# Anon client — used only for auth token verification
supabase_anon: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Service role client — bypasses RLS, used for all data operations
if SUPABASE_SERVICE_KEY:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
else:
    print("WARNING: SUPABASE_SERVICE_KEY not set, falling back to anon key")
    supabase: Client = supabase_anon
