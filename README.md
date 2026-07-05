# TeamPulse

**A collaboration health monitor for student teams.**

Built as a prototype for **NYC CodeQuest 2026**, Track **EDU-04**.

Team: **Seedhe Code** (solo)

---

## The Problem Statement

> **EDU-04: Group Projects Still Suck**
> Teamwork remains difficult due to poor coordination, unequal effort, and communication issues.
> **Goal:** Improve collaboration and accountability.

Anyone who has done a group project has lived some version of this:

- You don't find out who's actually doing the work until the deadline is already here.
- One teammate carries 70% of the project, and everyone gets the same grade.
- Someone's stuck for days and says nothing, because nobody wants to be the one who admits they're behind.

Existing tools like Trello, Slack, and Google Docs are good at storing information. They're blind to the human problems underneath it: who's overwhelmed, who's coasting, who's too quiet to ask for help. That blind spot is where group projects quietly fall apart.

---

## How TeamPulse Solves It

TeamPulse looks like a simple task board on the surface, because it needs to be something a team will actually use. Underneath, it's constantly measuring the health of the team, not just the status of the tasks.

Every feature maps directly back to one line in the problem statement:

| Problem | Feature | How it helps |
|---|---|---|
| Poor coordination | **Task Board** (To do / In progress / Done) | One shared board and one shared truth. No more three different versions of "who's doing what" |
| Poor coordination | **Deadline Countdown** | A shared, visible timeline instead of everyone tracking it separately |
| Poor coordination | **Activity Feed** | A timestamped log of every action, so nobody has to ask what happened while they were gone |
| Unequal effort | **Contribution Fairness Score** | Turns "I feel like I do everything" into an actual measured number (0 to 100) |
| Unequal effort | **Workload Distribution** | A visual bar breakdown of who's carrying what, so imbalance becomes impossible to hide |
| Unequal effort | **"Below team average" nudge** | A quiet, individual flag when one member is meaningfully behind the group |
| Communication issues | **"I'm stuck on this" blocker flag** | One tap replaces the awkward group chat confession of falling behind |
| Communication issues | **"Someone is stuck" panel** | Automatically surfaces blockers to the whole team, so no one has to notice on their own |
| Communication issues | **Inactive Member Detection** | Flags a teammate who's gone quiet, using real task activity instead of guesswork, with a configurable threshold |
| Accountability (the goal) | **Team Health Score** | One composite number built from completion percentage, fairness, overdue tasks, and blocked tasks |
| Accountability (the goal) | **Project Risk Indicator** | A green, yellow, or red status with plain language reasons. It tells you why something's wrong, not just that it is |

---

## Core Innovation

Most collaboration tools answer one question: "What work exists?"

TeamPulse answers a different one: "Is this team actually okay?"

```
Team Health = f(completion %, fairness, overdue tasks, blocked tasks)
```

This score recalculates live, the moment any input changes. A task moves, a member goes quiet, a blocker gets flagged, and the score already knows. On top of it sits a Risk Engine that turns the score into an actionable reason:

> Example: High Risk. 3 overdue tasks, contribution imbalance detected.

It's not a dashboard you have to interpret. It's a diagnosis you can act on right away.

---

## Tech Stack

- **HTML, CSS, Vanilla JavaScript.** No frameworks, no build step, nothing to break mid demo
- **localStorage** for instant, zero setup persistence across sessions
- No external UI libraries or chart dependencies

Every scoring algorithm, including fairness, health, risk, and inactivity, is hand written logic, not a library doing the thinking. The whole thing runs entirely in the browser with no backend.

---

## Getting Started

This is a static, dependency free front end prototype. No build step, no installs.

1. Clone or download this repository.
2. Open `index.html` directly in a browser, or serve it locally (recommended, so relative paths and localStorage behave consistently):
3. Create a project, add teammates, add tasks, and watch the Team Health Score, Fairness Score, and Risk Indicator update live as you use the board.

### Project structure

```
index.html      App shell and all views and modals
app.js          All application logic: state, scoring, rendering
styles.css      Design system and component styles
logo.png        TeamPulse logo, the heartbeat mark
```

---

## Project Status

This is a hackathon prototype, built solo over a few days for NYC CodeQuest 2026. It's functional end to end, covering project, task, and member management, live scoring, and persistence, but it isn't production hardened. There's no backend, no multi device sync, and no authentication yet. Data lives in the browser's localStorage.

---

## Why "TeamPulse"

A pulse is the first thing a doctor checks. One signal, and you instantly know whether something needs attention. TeamPulse is built on the same idea: one honest reading of whether a team is actually functioning, not just whether tasks are checked off.

---

Built for NYC CodeQuest 2026, Track EDU-04, by **Seedhe Code**.
