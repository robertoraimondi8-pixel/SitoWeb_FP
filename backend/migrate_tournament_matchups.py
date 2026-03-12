"""One-time migration: fix tournament matchup points from float to int."""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os

async def migrate_tournament_matchups():
    client = AsyncIOMotorClient(os.environ.get('MONGO_URL'))
    db = client[os.environ.get('DB_NAME')]
    col = db['tournament_matchups']
    
    count = 0
    cursor = col.find({})
    async for mu in cursor:
        a_pts = mu.get('user_a_points', 0)
        b_pts = mu.get('user_b_points', 0)
        
        if isinstance(a_pts, float) or isinstance(b_pts, float):
            new_a = int(round(a_pts))
            new_b = int(round(b_pts))
            
            update = {'user_a_points': new_a, 'user_b_points': new_b}
            
            # Recalculate result for completed matchups
            if mu.get('status') == 'completed':
                if new_a > new_b:
                    update['result'] = 'user_a_win'
                elif new_b > new_a:
                    update['result'] = 'user_b_win'
                else:
                    update['result'] = 'draw'
            
            await col.update_one({'_id': mu['_id']}, {'$set': update})
            count += 1
            print(f'  Fixed: round={mu.get("round_number")}, {a_pts}->{new_a}, {b_pts}->{new_b}, status={mu.get("status")}')
    
    print(f'Total matchups fixed: {count}')
    client.close()

asyncio.run(migrate_tournament_matchups())
