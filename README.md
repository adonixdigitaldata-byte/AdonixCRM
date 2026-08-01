## Adonix CRM

A full-stack Meta Ads CRM + Quotation/Invoicing Platform.

### Tech Stack
- **Next.js 16** (App Router, TypeScript)
- **Supabase** (Postgres, Auth, RLS)
- **Vanilla CSS** (custom design system, Linear/Attio aesthetic)
- **dnd-kit** (Kanban drag-and-drop)
- **date-fns** (date formatting)

### Getting Started

1. **Run the database schema** in Supabase SQL Editor:
   - Open `supabase/schema.sql`
   - Paste the entire content into Supabase > SQL Editor > New Query
   - Click Run

2. **Create your admin user** in Supabase > Authentication > Users > Add user
   - After creating the user, run this SQL to set their role:
   ```sql
   UPDATE profiles SET role = 'ADMIN' WHERE email = 'your-email@example.com';
   ```

3. **Set up Meta webhook** (after deploying):
   - In Meta Developer Console > Webhooks
   - Callback URL: `https://your-domain.com/api/webhooks/meta`
   - Verify token: ` `
   - Subscribe to: `leadgen`

4. **Install dependencies:**
   ```bash
   npm install
   ```

5. **Run development server:**
   ```bash
   npm run dev
   ```

### Features
- 🎯 **Lead Management** — Kanban + List view, drag-and-drop stage changes
- 📊 **Dashboard** — Funnel analytics, conversion rates, source breakdown
- 📱 **Meta Ads Integration** — Webhook for auto lead capture, ad attribution
- 📁 **XLSX Import** — Bulk lead import with dedup preview
- 💼 **Quotations** — Full builder with line items, tax, PDF-ready
- 🧾 **Invoices** — Payment recording, status tracking, balance
- 👥 **Agents** — Invite, activate, auto-assignment (round-robin)
- 🔒 **Role-based access** — Admin (full access) / Agent (own leads)
