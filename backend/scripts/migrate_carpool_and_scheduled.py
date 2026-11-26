import sqlite3
import sys

def migrate():
    sys.stdout.reconfigure(encoding='utf-8')
    print("Running migration: Carpool route matching, atomic seat reservations, and scheduled rides...")
    conn = sqlite3.connect("backend/ride_hailing.db")
    cursor = conn.cursor()

    # 1. Update community_rides
    cursor.execute("PRAGMA table_info(community_rides)")
    existing_community_cols = [r[1] for r in cursor.fetchall()]

    new_community_cols = [
        ("pickup_latitude", "FLOAT"),
        ("pickup_longitude", "FLOAT"),
        ("destination_latitude", "FLOAT"),
        ("destination_longitude", "FLOAT"),
        ("departure_datetime", "DATETIME"),
        ("pickup_flexibility_km", "FLOAT DEFAULT 2.5"),
        ("dropoff_flexibility_km", "FLOAT DEFAULT 3.0"),
        ("vehicle_type", "VARCHAR(50) DEFAULT 'Car'"),
        ("instant_booking", "INTEGER DEFAULT 1"),
        ("luggage_policy", "VARCHAR(100) DEFAULT 'Standard'"),
        ("platform_fee_percent", "FLOAT DEFAULT 15.0"),
    ]

    for col_name, col_type in new_community_cols:
        if col_name not in existing_community_cols:
            print(f"Adding column '{col_name}' ({col_type}) to community_rides...")
            cursor.execute(f"ALTER TABLE community_rides ADD COLUMN {col_name} {col_type}")
        else:
            print(f"community_rides: Column '{col_name}' already exists.")

    # 2. Update community_ride_bookings
    cursor.execute("PRAGMA table_info(community_ride_bookings)")
    existing_booking_cols = [r[1] for r in cursor.fetchall()]

    new_booking_cols = [
        ("price_per_seat", "FLOAT DEFAULT 0.0"),
        ("total_price", "FLOAT DEFAULT 0.0"),
        ("platform_fee", "FLOAT DEFAULT 0.0"),
        ("net_host_earnings", "FLOAT DEFAULT 0.0"),
        ("pickup_notes", "VARCHAR(255)"),
        ("passenger_pickup_lat", "FLOAT"),
        ("passenger_pickup_lng", "FLOAT"),
        ("cancelled_at", "DATETIME"),
        ("cancellation_reason", "VARCHAR(255)"),
    ]

    for col_name, col_type in new_booking_cols:
        if col_name not in existing_booking_cols:
            print(f"Adding column '{col_name}' ({col_type}) to community_ride_bookings...")
            cursor.execute(f"ALTER TABLE community_ride_bookings ADD COLUMN {col_name} {col_type}")
        else:
            print(f"community_ride_bookings: Column '{col_name}' already exists.")

    # 3. Update ride_bookings
    cursor.execute("PRAGMA table_info(ride_bookings)")
    existing_ride_cols = [r[1] for r in cursor.fetchall()]

    new_ride_cols = [
        ("scheduled_for", "DATETIME"),
    ]

    for col_name, col_type in new_ride_cols:
        if col_name not in existing_ride_cols:
            print(f"Adding column '{col_name}' ({col_type}) to ride_bookings...")
            cursor.execute(f"ALTER TABLE ride_bookings ADD COLUMN {col_name} {col_type}")
        else:
            print(f"ride_bookings: Column '{col_name}' already exists.")

    conn.commit()
    conn.close()
    print("Migration finished successfully!")

if __name__ == "__main__":
    migrate()
