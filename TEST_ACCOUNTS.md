# Test Accounts

Use these test accounts for development and testing purposes.

Test accounts exist **only in non-production**: `/api/test-login` returns 404 in
production, and the accounts have no password hash (they cannot log in through
the normal `/api/auth/login` password flow).

## Quick Access

Navigate to `/test-login` to access the test login page with one-click login buttons.

## Password

All test accounts share a single password sourced from the environment — set
`DEV_TEST_PASSWORD` in your `.env`. No credentials live in source or docs; if
test login returns 503, the variable is unset.

## Test Accounts

| Role | Email | Dashboard |
|------|-------|-----------|
| Admin | admin@test.com | /admin |
| Loan Officer | lo@test.com | /broker-dashboard |
| LO Assistant | loa@test.com | /broker-dashboard |
| Processor | processor@test.com | /broker-dashboard |
| Underwriter | underwriter@test.com | /broker-dashboard |
| Closer | closer@test.com | /broker-dashboard |
| Broker | broker@test.com | /broker-dashboard |
| Lender | lender@test.com | /broker-dashboard |
| Aspiring Owner (renter) | renter@test.com | /renter-home |
| Active Buyer | buyer@test.com | /dashboard |

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

### Borrower (aspiring owner / active buyer)
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
  "password": "<DEV_TEST_PASSWORD>"
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
