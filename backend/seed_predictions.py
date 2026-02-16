"""Script to seed random predictions for Matchday 12 for all test users."""
import asyncio
import random
from datetime import datetime, timezone
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from motor.motor_asyncio import AsyncIOMotorClient
import os

# Connect to MongoDB
mongo_url = os.environ['MONGO_URL']
db_name = os.environ.get('DB_NAME', 'fantapronostic')
client = AsyncIOMotorClient(mongo_url)
db = client[db_name]

# Collections
users_col = db.users
matchdays_col = db.matchdays
matches_col = db.matches
predictions_col = db.predictions


def new_id():
    import uuid
    return str(uuid.uuid4())


def now_utc():
    return datetime.now(timezone.utc).isoformat()


async def seed_predictions():
    """Seed random predictions for all non-admin users for Matchday 12."""
    
    print("=" * 60)
    print("SEED PREDICTIONS - GIORNATA 12")
    print("=" * 60)
    
    # 1. Find Matchday 12 (by number)
    matchday = await matchdays_col.find_one({"number": 12}, {"_id": 0})
    
    if not matchday:
        # Try to find by label
        matchday = await matchdays_col.find_one(
            {"$or": [
                {"label": {"$regex": "12", "$options": "i"}},
                {"label": {"$regex": "Giornata 12", "$options": "i"}}
            ]}, 
            {"_id": 0}
        )
    
    if not matchday:
        print("ERROR: Giornata 12 non trovata!")
        # List available matchdays
        matchdays = await matchdays_col.find({}, {"_id": 0, "id": 1, "number": 1, "label": 1}).to_list(50)
        print("\nGiornate disponibili:")
        for md in matchdays:
            print(f"  - Number: {md.get('number')}, Label: {md.get('label')}, ID: {md['id']}")
        return
    
    matchday_id = matchday["id"]
    print(f"\n✓ Trovata Giornata 12:")
    print(f"  ID: {matchday_id}")
    print(f"  Number: {matchday.get('number')}")
    print(f"  Label: {matchday.get('label')}")
    print(f"  Status: {matchday.get('status')}")
    
    # 2. Get all matches for this matchday
    matches = await matches_col.find({"matchday_id": matchday_id}, {"_id": 0}).to_list(20)
    
    if not matches:
        print(f"\nERROR: Nessuna partita trovata per Giornata 12!")
        return
    
    print(f"\n✓ Trovate {len(matches)} partite:")
    for i, m in enumerate(matches, 1):
        print(f"  {i}. {m['home_team']} vs {m['away_team']} (ID: {m['id'][:8]}...)")
    
    # 3. Get all non-admin users
    users = await users_col.find({"role": {"$ne": "admin"}}, {"_id": 0, "id": 1, "username": 1, "email": 1}).to_list(1000)
    
    if not users:
        print("\nERROR: Nessun utente non-admin trovato!")
        return
    
    print(f"\n✓ Trovati {len(users)} utenti test:")
    for u in users:
        print(f"  - {u['username']} ({u.get('email', 'N/A')})")
    
    # 4. Seed predictions
    predictions_created = 0
    predictions_skipped = 0
    prediction_values = ["1", "X", "2"]  # Per market type 1X2
    
    print(f"\n--- Creazione predizioni random ---")
    
    for user in users:
        user_id = user["id"]
        user_predictions = 0
        
        for match in matches:
            match_id = match["id"]
            
            # Check if prediction already exists
            existing = await predictions_col.find_one({
                "user_id": user_id, 
                "match_id": match_id
            })
            
            if existing:
                predictions_skipped += 1
                continue
            
            # Create random prediction
            random_prediction = random.choice(prediction_values)
            ts = now_utc()
            
            prediction = {
                "id": new_id(),
                "user_id": user_id,
                "match_id": match_id,
                "matchday_id": matchday_id,
                "market_type": "1X2",
                "prediction_value": random_prediction,
                "points": None,
                "is_correct": None,
                "locked": False,
                "created_at": ts,
                "updated_at": ts,
            }
            
            await predictions_col.insert_one(prediction)
            predictions_created += 1
            user_predictions += 1
        
        print(f"  ✓ {user['username']}: {user_predictions} predizioni create")
    
    print(f"\n" + "=" * 60)
    print("RIEPILOGO")
    print("=" * 60)
    print(f"Utenti processati: {len(users)}")
    print(f"Partite per giornata: {len(matches)}")
    print(f"Predizioni create: {predictions_created}")
    print(f"Predizioni saltate (esistenti): {predictions_skipped}")
    print(f"\n✅ SEED COMPLETATO!")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(seed_predictions())
