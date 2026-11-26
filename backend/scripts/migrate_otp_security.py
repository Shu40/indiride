import sqlite3
import sys

def migrate():
    sys.stdout.reconfigure(encoding='utf-8')
    print("Running migration: Adding OTP security columns to ride_bookings table...")
    conn = sqlite3.connect("backend/ride_hailing.db")
    cursor = conn.cursor()

    cursor.execute("PRAGMA table_info(ride_bookings)")
    existing_cols = [r[1] for r in cursor.fetchall()]

    new_columns = [
        ("otp_encrypted", "TEXT"),
        ("otp_max_attempts", "INTEGER DEFAULT 3"),
        ("otp_expires_at", "DATETIME"),
        ("otp_verified_at", "DATETIME"),
        ("otp_locked", "INTEGER DEFAULT 0"),
    ]

    for col_name, col_type in new_columns:
        if col_name not in existing_cols:
            print(f"Adding column '{col_name}' ({col_type})...")
            cursor.execute(f"ALTER TABLE ride_bookings ADD COLUMN {col_name} {col_type}")
        else:
            print(f"Column '{col_name}' already exists.")

    conn.commit()
    conn.close()
    print("Migration completed successfully!")

if __name__ == "__main__":
    migrate()
