import sqlite3

def migrate():
    conn = sqlite3.connect("ride_hailing.db")
    c = conn.cursor()
    cols = [col[1] for col in c.execute("PRAGMA table_info(users)").fetchall()]
    if "profile_photo" not in cols:
        c.execute("ALTER TABLE users ADD COLUMN profile_photo VARCHAR(500)")
        print("Added profile_photo column to users table.")
    
    c.execute("UPDATE users SET profile_photo = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&q=80' WHERE role = 'RIDER' OR role = 'rider'")
    c.execute("UPDATE users SET profile_photo = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80' WHERE role = 'PASSENGER' OR role = 'passenger'")
    conn.commit()
    conn.close()
    print("Profile photo migration completed successfully.")

if __name__ == "__main__":
    migrate()
