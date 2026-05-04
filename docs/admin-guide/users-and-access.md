# Users and Access

## Account Creation Paths
1. Standard Username/Password (Local).
2. LinkedIn OAuth (If configured via `LINKEDIN_CLIENT_ID`).

## Project Membership Model
We do not use standard Django Groups for multi-tenancy. Access is strictly mapped via `ProjectMembership` with explicit Roles: `admin`, `member`, `reader`. 

## Django Groups and Roles
Django `Group` and `Permission` models are retained ONLY for granting staff/Superuser global abilities (e.g., viewing standard Django Admin), NOT for managing newsletter workspaces.

## Service Accounts
If you need scripts to push data, you can generate a Long Lived API token attached to a standard User account flagged programmatically.

## LinkedIn OAuth Admin Steps
To enable LinkedIn SSO:
1. Create a LinkedIn Developer Application.
2. Whitelist your `NEWSLETTER_PUBLIC_URL/api/v1/auth/linkedin/callback` endpoint.
3. Inject the ID and Secret into your `.env` configuration.
