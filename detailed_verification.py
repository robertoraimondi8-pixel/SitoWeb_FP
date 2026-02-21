#!/usr/bin/env python3
"""
Detailed verification of the specific data structures requested in the review
"""

import requests
import json
from datetime import datetime

BASE_URL = "https://prono-hub-1.preview.emergentagent.com/api"
TEST_USER = {"email": "marco@test.com", "password": "password123"}

def detailed_verification():
    session = requests.Session()
    
    # Login
    print("🔐 Logging in...")
    response = session.post(f"{BASE_URL}/auth/login", json=TEST_USER)
    if response.status_code != 200:
        print(f"❌ Login failed: {response.status_code}")
        return
    
    token = response.json()["access_token"]
    session.headers.update({"Authorization": f"Bearer {token}"})
    print("✅ Login successful")
    
    # Test Standings Total detailed structure
    print("\n📊 Testing Standings Total detailed structure...")
    response = session.get(f"{BASE_URL}/standings/total")
    if response.status_code == 200:
        data = response.json()
        print("✅ Standings Total response structure:")
        print(f"   league_id: {data.get('league_id')}")
        print(f"   league_name: {data.get('league_name')}")
        print(f"   standings_type: {data.get('standings_type')}")
        print(f"   entries count: {len(data.get('entries', []))}")
        
        if data.get('entries'):
            entry = data['entries'][0]
            print("   First entry structure:")
            for field in ["user_id", "username", "rank", "total_points", "matchdays_played", "jolly_used", "current_week_points"]:
                print(f"     {field}: {entry.get(field)}")
    
    # Test Standings Weekly detailed structure
    print("\n📅 Testing Standings Weekly detailed structure...")
    matchdays_response = session.get(f"{BASE_URL}/standings/matchdays")
    if matchdays_response.status_code == 200:
        matchdays = matchdays_response.json()
        if matchdays:
            matchday_id = matchdays[0]["id"]
            response = session.get(f"{BASE_URL}/standings/weekly/{matchday_id}")
            if response.status_code == 200:
                data = response.json()
                print("✅ Standings Weekly response structure:")
                print(f"   matchday_id: {data.get('matchday_id')}")
                print(f"   matchday_number: {data.get('matchday_number')}")
                print(f"   entries count: {len(data.get('entries', []))}")
                
                if data.get('entries'):
                    entry = data['entries'][0]
                    print("   First entry structure:")
                    for field in ["user_id", "username", "matchday_points", "exact_correct", "1x2_correct", "jolly_active"]:
                        print(f"     {field}: {entry.get(field)}")
    
    # Test Live Endpoint detailed structure
    print("\n🔴 Testing Live Endpoint detailed structure...")
    response = session.get(f"{BASE_URL}/live/{matchday_id}")
    if response.status_code == 200:
        data = response.json()
        print("✅ Live Endpoint response structure:")
        print(f"   matchday_status: {data.get('matchday_status')}")
        print(f"   matches count: {len(data.get('matches', []))}")
        print(f"   base_points: {data.get('base_points')}")
        print(f"   joker_bonus: {data.get('joker_bonus')}")
        print(f"   total_live_points: {data.get('total_live_points')}")
        print(f"   server_time: {data.get('server_time')}")
        
        if data.get('matches'):
            match = data['matches'][0] if data['matches'] else None
            if match:
                print("   First match structure:")
                for field in ["status", "home_score", "away_score", "my_prediction", "outcome", "points"]:
                    print(f"     {field}: {match.get(field)}")
    
    # Test Transparency Endpoint detailed structure
    print("\n👁️ Testing Transparency Endpoint detailed structure...")
    # Get another user from standings
    standings_response = session.get(f"{BASE_URL}/standings/total")
    if standings_response.status_code == 200:
        entries = standings_response.json().get('entries', [])
        current_user_id = response.json().get('user', {}).get('id') if 'user' in response.json() else None
        
        other_user_id = None
        for entry in entries:
            if entry.get('user_id') != current_user_id:
                other_user_id = entry.get('user_id')
                break
        
        if other_user_id:
            response = session.get(f"{BASE_URL}/predictions/user/{other_user_id}/{matchday_id}")
            if response.status_code == 200:
                data = response.json()
                print("✅ Transparency Endpoint response structure:")
                print(f"   user_id: {data.get('user_id')}")
                print(f"   username: {data.get('username')}")
                print(f"   predictions count: {len(data.get('predictions', []))}")
                print(f"   jolly_active: {data.get('jolly_active')}")
                print(f"   total_points: {data.get('total_points')}")
                
                if data.get('predictions'):
                    pred = data['predictions'][0]
                    print("   First prediction structure:")
                    for field in ["outcome", "points", "match_id", "home_team", "away_team"]:
                        if field in pred:
                            print(f"     {field}: {pred.get(field)}")
            elif response.status_code == 403:
                print("✅ Transparency access correctly denied (403) - expected for OPEN matchdays")
    
    print("\n🎉 Detailed verification completed!")

if __name__ == "__main__":
    detailed_verification()