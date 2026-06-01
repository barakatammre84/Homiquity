# Test Accounts

Use these test accounts for development and testing purposes.

## Quick Access

Navigate to `/test-login` to access the test login page with one-click login buttons.

## Test Credentials

| Role | Email | Password | Dashboard |
|------|-------|----------|-----------|
| Admin | admin@test.com | admin123 | /admin |
| Broker | broker@test.com | broker123 | /broker-dashboard |
| Lender | lender@test.com | lender123 | /broker-dashboard |
| Borrower | borrower@test.com | borrower123 | /dashboard |

## Role Permissions

### Admin
- Full system access
- Manage users, rates, and content
- View all loan applications
- Access admin dashboard and compliance tools

### Broker
- Manage referrals and commissions
- View referred borrowers and loan status
- Track performance stats and earnings

### Lender
- Process loan applications
- Clear conditions and advance pipeline stages
- Manage commission approvals

### Borrower
- Apply for pre-approval
- Upload documents
- Track loan progress
- View loan options and estimates

## API Endpoint

```
POST /api/test-login
Content-Type: application/json

{
  "email": "admin@test.com",
  "password": "admin123"
}
```

Response:
```json
{
  "success": true,
  "user": {
    "id": "test-admin",
    "email": "admin@test.com",
    "role": "admin",
    "firstName": "Admin",
    "lastName": "User"
  }
}
```
