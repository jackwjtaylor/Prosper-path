# Partner Collaboration & Recurring Check-ins Flow

## Purpose
This document outlines end-to-end product flows for two related experiences within Prosper:

1. Inviting a partner to join so a couple can manage their Prosper plan together.
2. Creating and maintaining recurring progress check-ins with customizable cadence.

Each flow is written for the voice-forward Prosper workspace but maps cleanly to touch interactions. The goal is to reduce friction, set clear expectations, and build trust through transparent progress sharing.

---

## 1. Partner Invitation & Shared Plan Management

### 1.1 Experience Goals
- Make it obvious that Prosper supports couples and clearly communicate the value (shared visibility, coordinated actions).
- Keep the invite lightweight, secure, and reversible.
- Provide guidance on what the invited partner will see and how data is shared.

### 1.2 Entry Points
- **Primary CTA in Simple Workspace header:** "Invite your partner" button once the primary user completes initial onboarding.
- **Voice prompt:** Coach suggests inviting a partner after detecting household fields such as marital status.
- **Plan completion celebration:** After building a plan, a post-success module highlights collaborative planning.

### 1.3 Flow Overview

| Stage | Owner | Key Moments |
| --- | --- | --- |
| 1. Discoverability | Primary user | CTA explains benefits, clarifies that partner gets their own secure login. |
| 2. Send invite | Primary user | Enter partner email/phone, customize welcome message, confirm permissions. |
| 3. Partner onboarding | Partner | Accepts invite, guided through lightweight onboarding prefilled with shared data. |
| 4. Shared workspace | Both | See shared plan, tasks, and snapshots with activity indicators. |

### 1.4 Detailed Steps

1. **CTA Tap / Voice Confirmation**
   - UI: Side panel slides in with "Plan together" headline, benefits list, and privacy blurb.
   - Voice: "Would you like me to invite Alex to co-manage your Prosper plan?" with yes/no intents.
2. **Partner Details Form**
   - Inputs: Name (optional), email, optional SMS number.
   - Toggle: "Allow partner to edit plan" (default on) vs. view only.
   - Copy clarifies that partner will see shared finances and tasks.
3. **Review & Send**
   - Summary card: who you're inviting, access level, optional personal note.
   - Confirmation modal warns that invite expires in 7 days and can be rescinded from settings.
4. **Success State**
   - Banner: "Invite sent to alex@email.com" with status chip (Pending).
   - Next steps: Encourage sharing context or recording a quick intro voice note.
5. **Settings Management**
   - New "Household" section lists members, statuses (Pending, Active), and controls to resend, revoke, or change access level.
6. **Partner Accepts**
   - Email/SMS deep link routes to `/join?invite=<token>`.
   - Partner reviews data-sharing summary, sets up account credentials, and completes a condensed onboarding (confirm household info, voice preference).
7. **Shared Workspace Features**
   - Activity feed: shows who completed tasks or updated numbers with timestamps.
   - Action ownership: tasks can be assigned to either partner with reminders.
   - Coach phrasing shifts to include both names and prompts collaborative decisions.

### 1.5 Edge Cases & Safeguards
- **Expired invite:** Invite shows "Expired" state; primary user can resend.
- **Revoked access:** Partner sees notice on next login and loses plan visibility immediately.
- **Plan conflicts:** When both edit simultaneously, Prosper surfaces the latest change and provides a reconciliation dialog.
- **Privacy controls:** Sensitive fields (e.g., salary) can be masked until both agree to share.

### 1.6 Success Metrics
- % of eligible users who send an invite within 7 days of plan creation.
- Invite acceptance rate and time-to-accept.
- Engagement of partner post-accept (sessions/week, tasks completed).
- Retention lift for households with two active members vs. solo.

---

## 2. Recurring Process & Update Check-ins

### 2.1 Experience Goals
- Help households build a steady habit of reviewing progress without overwhelming them.
- Provide a flexible cadence: weekly, biweekly, monthly, or custom.
- Make check-ins actionable by surfacing plan changes, wins, and next best actions.

### 2.2 Entry Points
- **After plan creation:** Prompt: "Keep your momentum—set a check-in cadence."
- **Voice coach suggestion:** Detects when goals remain incomplete for two weeks and recommends scheduling check-ins.
- **Settings → Check-ins** module for ongoing management.

### 2.3 Flow Overview

| Stage | Owner | Key Moments |
| --- | --- | --- |
| 1. Configure cadence | Primary user (optionally partner) | Pick frequency, day/time, delivery channel. |
| 2. Prepare agenda | Prosper automation | Curated summary of progress, blockers, and questions. |
| 3. Conduct check-in | Both | Voice-guided or self-serve review with ability to update metrics and tasks. |
| 4. Log outcomes | Prosper automation | Capture decisions, update plan, schedule next check-in. |

### 2.4 Detailed Steps

1. **Cadence Setup Modal**
   - Options: Weekly, Every 2 Weeks, Monthly, Custom (user selects interval in weeks or months).
   - Time picker and preferred delivery: in-app notification, email recap, or SMS reminder.
   - Optional: rotate reminders between partners.
2. **Agenda Preview**
   - Sample agenda with upcoming tasks, goal progress, cash flow updates.
   - Toggle: "Include reflection prompts" (gratitude, worries) to encourage emotional check-ins.
3. **Confirmation**
   - Summary screen with next check-in date/time and how reminders will appear.
   - CTA to "Add to calendar" (Google, Apple, Outlook) and "Start first check-in now".
4. **Automated Prep (Background)**
   - 24 hours prior, Prosper compiles data (latest snapshot deltas, pending tasks, savings progress) and drafts agenda.
   - Sends partner notification if they need to update numbers beforehand.
5. **Check-in Session**
   - **Voice Mode:** Coach opens with highlights, asks if numbers changed, guides through updates (income, balances) and records decisions.
   - **Touch Mode:** Interactive checklist with collapsible sections (Wins, Money Moves, Tasks, Upcoming Bills).
   - Inline ability to assign tasks to each partner and set due dates.
6. **Wrap-up & Logging**
   - Summary card confirms updates saved, tasks assigned, and celebratory note.
   - Prompt to adjust cadence if meetings feel too frequent/infrequent.
   - Archive of past check-ins with notes and audio transcripts.

### 2.5 Management & Iteration
- **Settings screen** shows upcoming schedule, allows skipping the next session, pausing, or changing frequency.
- **Smart cadence suggestions:** After three missed check-ins, suggest a lighter cadence; after consistent completion, offer to stretch interval or layer in new goals.
- **Partner coordination:** Both partners can mark availability; Prosper offers overlapping times.

### 2.6 Success Metrics
- % of plans with an active recurring check-in within first month.
- Check-in completion rate (completed vs. scheduled).
- Net change in task completion velocity after enabling check-ins.
- Self-reported confidence scores after three completed sessions.

---

## Implementation Notes
- **Backend:** Extend household model with `members[]`, `roles`, and `checkInSchedule` object (frequency, next occurrence, channels).
- **Notifications:** Use existing `pp:send_chat` event to trigger in-app reminders; integrate email/SMS via notification service.
- **Analytics:** Track funnel events (`partner_invite_view`, `partner_invite_sent`, `checkin_cadence_set`, `checkin_completed`).
- **Security:** Invitation tokens should be single-use and expire; audit log all role changes.
- **Voice Scripts:** Update onboarding and coach scripts to include collaborative language and check-in prompts.

