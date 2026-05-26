# Supabase database setup

## Run the migration

1. Open your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project → **SQL Editor**
3. Paste the contents of `supabase/migrations/001_initial_schema.sql`
4. Click **Run**
5. Run `supabase/migrations/002_whatsapp_evolution.sql` for WhatsApp + Realtime support
6. Run `supabase/migrations/003_whatsapp_message_dedup.sql` to prevent duplicate AI replies

## Evolution API (WhatsApp)

1. Set env vars in `.env.local` (see `supabase.env.example`)
2. Run migration `002_whatsapp_evolution.sql`
3. In Evolution API, configure the instance webhook:

```
URL: https://your-domain.com/api/webhooks/evolution?secret=YOUR_SECRET
Events: MESSAGES_UPSERT
```

4. Set `WHATSAPP_DEFAULT_USER_ID` to your Supabase auth user UUID

**Flow:** WhatsApp message → webhook → create/find lead → save client message → OpenAI reply → save AI message → send via Evolution API → dashboard updates live via Supabase Realtime.

This creates:

| Table | Purpose |
|-------|---------|
| `profiles` | User profile (auto-created on signup) |
| `leads` | Real estate leads per user |
| `conversations` | WhatsApp messages linked to leads |

## Security

- **Row Level Security** is enabled on all tables
- Users can only read/write their own `profiles` and `leads`
- `conversations` are scoped via the parent lead's `user_id`
- A trigger on `auth.users` automatically inserts a `profiles` row on signup

## Optional: seed sample data

Replace `YOUR_USER_ID` with your auth user UUID from **Authentication → Users**:

```sql
insert into public.leads (user_id, client_name, phone, interest, status)
values
  ('YOUR_USER_ID', 'Maria Silva', '+351912345678', 'Ocean Drive 3-bed', 'scheduled'),
  ('YOUR_USER_ID', 'James Chen', '+14155550123', 'Downtown loft', 'qualified'),
  ('YOUR_USER_ID', 'Ana Costa', '+351987654321', 'Weekend rental', 'contacted');

insert into public.conversations (lead_id, message, sender)
select id, 'Hi! Is the listing still available?', 'client'
from public.leads where client_name = 'Maria Silva' limit 1;

insert into public.conversations (lead_id, message, sender)
select id, 'Yes! Would you like to schedule a visit this Saturday?', 'ai'
from public.leads where client_name = 'Maria Silva' limit 1;
```

## TypeScript

Types live in `src/types/database.ts`.  
Data helpers live in `src/lib/data/`.
