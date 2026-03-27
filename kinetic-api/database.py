from supabase import create_client, Client
from dotenv import load_dotenv
import os

load_dotenv()

# Use service key for server-side queries — auth is enforced by the JWT
# validation in get_current_user() before any protected route runs.
supabase: Client = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_KEY")
)