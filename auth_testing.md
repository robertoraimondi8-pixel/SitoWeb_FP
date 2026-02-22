# Auth Testing Playbook for FantaPronostic

## Step 1: Create Test User & Session (for Google Auth testing)
```bash
mongosh --eval "
use('fantapronostic');
var userId = 'test-user-' + Date.now();
var sessionToken = 'test_session_' + Date.now();
db.users.insertOne({
  id: userId,
  email: 'test.google.' + Date.now() + '@example.com',
  username: 'TestGoogleUser',
  password: '',
  role: 'user',
  language: 'it',
  auth_provider: 'google',
  created_at: new Date().toISOString()
});
print('User ID: ' + userId);
print('Session token: ' + sessionToken);
"
```

## Step 2: Test Backend Google OAuth API
```bash
# Test Google session endpoint (will fail without real session_id from Emergent Auth)
curl -X POST "https://p0-bugfix-sprint.preview.emergentagent.com/api/auth/google/session" \
  -H "Content-Type: application/json" \
  -d '{"session_id": "test_invalid_session"}'
# Expected: 401 Invalid Google session

# Test email login (should still work)
curl -X POST "https://p0-bugfix-sprint.preview.emergentagent.com/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "marco@test.com", "password": "password123"}'
# Expected: 200 with JWT tokens
```

## Step 3: Browser Testing
```python
# Set auth cookie and navigate
await page.context.add_cookies([{
    "name": "session_token",
    "value": "YOUR_SESSION_TOKEN",
    "domain": "matchday-hub-29.preview.emergentagent.com",
    "path": "/",
    "httpOnly": True,
    "secure": True,
    "sameSite": "None"
}])
await page.goto("https://p0-bugfix-sprint.preview.emergentagent.com")
```

## Checklist
- [ ] Login screen shows official logo
- [ ] Email+Password login works
- [ ] Google OAuth button is visible and clickable
- [ ] "Password dimenticata?" link visible
- [ ] "Registrati" link visible and navigates to register
- [ ] Google auth redirects to Emergent auth
- [ ] After Google auth, session_id is processed and user is logged in
- [ ] Backend verifies session with Emergent API
- [ ] User is created/updated in MongoDB after Google auth
