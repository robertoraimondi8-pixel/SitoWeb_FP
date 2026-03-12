"""MongoDB connection and index management for FantaPronostic."""
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path
import os
import logging

logger = logging.getLogger(__name__)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
db_name = os.environ.get('DB_NAME', 'fantapronostic')

client = AsyncIOMotorClient(mongo_url)
db = client[db_name]

# Collection references
users_col = db.users
seasons_col = db.seasons
leagues_col = db.leagues
memberships_col = db.memberships
payments_col = db.payment_transactions
matchdays_col = db.matchdays
matches_col = db.matches
predictions_col = db.predictions
joker_usages_col = db.joker_usages
champion_picks_col = db.champion_picks
score_summaries_col = db.score_summaries
standings_cache_col = db.standings_cache
audit_logs_col = db.audit_logs
notifications_col = db.notifications
push_tokens_col = db.push_tokens
roles_col = db.roles
password_resets_col = db.password_resets

# Tournament collections
tournaments_col = db.tournaments
tournament_registrations_col = db.tournament_registrations
tournament_groups_col = db.tournament_groups
tournament_rounds_col = db.tournament_rounds
tournament_matchups_col = db.tournament_matchups


async def create_indexes():
    """Create all required indexes for the database."""
    try:
        # Users
        await users_col.create_index("email", unique=True)
        await users_col.create_index("username", unique=True)

        # Seasons
        await seasons_col.create_index("id", unique=True)

        # Leagues
        await leagues_col.create_index("id", unique=True)
        await leagues_col.create_index("invite_code", unique=True, sparse=True)

        # Memberships - unique user per league
        await memberships_col.create_index("id", unique=True)
        await memberships_col.create_index(
            [("user_id", 1), ("league_id", 1)], unique=True
        )

        # Payments
        await payments_col.create_index("id", unique=True)
        await payments_col.create_index("session_id", unique=True, sparse=True)

        # Matchdays
        await matchdays_col.create_index("id", unique=True)
        # Include league_id to allow same matchday number across different leagues
        await matchdays_col.create_index([("season_id", 1), ("number", 1), ("league_id", 1)], unique=True, name="season_id_number_league_id_unique")

        # Matches
        await matches_col.create_index("id", unique=True)
        await matches_col.create_index("matchday_id")

        # Predictions - unique per user+match
        await predictions_col.create_index("id", unique=True)
        await predictions_col.create_index(
            [("user_id", 1), ("match_id", 1), ("league_id", 1)], unique=True,
            name="user_match_league_unique"
        )
        await predictions_col.create_index([("user_id", 1), ("matchday_id", 1)])

        # JokerUsage - UNIQUE per user+season+half
        await joker_usages_col.create_index("id", unique=True)
        await joker_usages_col.create_index(
            [("user_id", 1), ("season_id", 1), ("half", 1)], unique=True
        )

        # ChampionPicks
        await champion_picks_col.create_index("id", unique=True)
        await champion_picks_col.create_index(
            [("user_id", 1), ("season_id", 1), ("competition", 1), ("league_id", 1)], unique=True
        )

        # ScoreSummary - unique per user+matchday+league
        await score_summaries_col.create_index("id", unique=True)
        await score_summaries_col.create_index(
            [("user_id", 1), ("matchday_id", 1), ("league_id", 1)], unique=True,
            name="user_matchday_league_unique"
        )

        # StandingsCache
        await standings_cache_col.create_index("id", unique=True)
        await standings_cache_col.create_index(
            [("user_id", 1), ("league_id", 1), ("matchday_id", 1), ("type", 1)], unique=True
        )

        # AuditLog
        await audit_logs_col.create_index("id", unique=True)
        await audit_logs_col.create_index("created_at")

        # Notifications
        await notifications_col.create_index("id", unique=True)
        await notifications_col.create_index([("user_id", 1), ("read", 1)])

        # Push Tokens
        await push_tokens_col.create_index([("user_id", 1), ("token", 1)], unique=True)
        await push_tokens_col.create_index("user_id")

        # Roles (RBAC)
        await roles_col.create_index("id", unique=True)
        await roles_col.create_index("name", unique=True)

        # Tournaments
        await tournaments_col.create_index("id", unique=True)
        await tournament_registrations_col.create_index("id", unique=True)
        await tournament_registrations_col.create_index(
            [("tournament_id", 1), ("user_id", 1)], unique=True
        )
        await tournament_groups_col.create_index("id", unique=True)
        await tournament_groups_col.create_index("tournament_id")
        await tournament_rounds_col.create_index("id", unique=True)
        await tournament_rounds_col.create_index("tournament_id")
        await tournament_matchups_col.create_index("id", unique=True)
        await tournament_matchups_col.create_index("tournament_id")

        logger.info("All database indexes created successfully")
    except Exception as e:
        logger.error(f"Error creating indexes: {e}")
        raise
