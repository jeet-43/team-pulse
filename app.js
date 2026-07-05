// teampulse app

// storage key
const STORAGE_KEY = "teampulse_data_v1";

// all app data
let state = { projects: [] };

// screen state, not saved
let ui = {
  currentProjectId: null,
  detailTaskId: null,
  editTaskId: null
};

// load saved data
function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      state = JSON.parse(raw);
      for (let p = 0; p < state.projects.length; p++) {
        const project = state.projects[p];
        for (let t = 0; t < project.tasks.length; t++) delete project.tasks[t].comments;
        for (let m = 0; m < project.members.length; m++) {
          delete project.members[m].checkin;
          // default to active
          if (!project.members[m].lastActiveAt) project.members[m].lastActiveAt = Date.now();
        }
        if (!project.inactivityThresholdDays) project.inactivityThresholdDays = 3;
        delete project.healthHistory;
      }
    } catch (e) {
      state = { projects: [] };
    }
  }
}

// save data
function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  // console.log(state);
}

// random id
function uid() {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
}

// find project
function getProject(id) {
  for (let i = 0; i < state.projects.length; i++) {
    if (state.projects[i].id === id) return state.projects[i];
  }
  return null;
}

// currently open project
function currentProject() {
  return getProject(ui.currentProjectId);
}

// get initials
function initials(name) {
  const parts = name.trim().split(/\s+/);
  let result = "";
  for (let i = 0; i < parts.length && i < 2; i++) {
    result += parts[i][0].toUpperCase();
  }
  return result;
}

// format date short
function formatShortDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// days left
function daysUntil(iso) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(iso + "T00:00:00");
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
}

// days to text
function daysLabel(days, todayWord, unitWord) {
  if (days < 0) return Math.abs(days) + "d overdue";
  if (days === 0) return todayWord;
  return days + unitWord;
}

// is task overdue
function isOverdue(task) {
  if (task.status === "done") return false;
  return daysUntil(task.dueDate) < 0;
}

// time ago text
function timeAgo(timestamp) {
  const diffMs = Date.now() - timestamp;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return mins + "m ago";
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + "h ago";
  return Math.floor(hrs / 24) + "d ago";
}

// days since
function daysSince(timestamp) {
  return Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24));
}

// log activity
function logActivity(project, message) {
  if (!project.activity) project.activity = [];
  project.activity.unshift({ message: message, timestamp: Date.now() });
  project.activity = project.activity.slice(0, 50);
}

// mark active now
function touchMemberActivity(project, memberId) {
  const member = project.members.find(function (m) {
    return m.id === memberId;
  });
  if (member) member.lastActiveAt = Date.now();
}

// show toast
let toastTimer = null;
function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.remove("tp-hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () {
    toast.classList.add("tp-hidden");
  }, 2200);
}

// stats for one member
function memberStats(project, memberId) {
  const assignedTasks = project.tasks.filter(function (t) {
    return t.assignedTo === memberId;
  });
  const completedTasks = assignedTasks.filter(function (t) {
    return t.status === "done";
  });
  let pct = 0;
  if (assignedTasks.length > 0) {
    pct = Math.round((completedTasks.length / assignedTasks.length) * 100);
  }
  return { completed: completedTasks.length, assigned: assignedTasks.length, pct: pct };
}

// team average
function teamAveragePct(project) {
  const withTasks = project.members.filter(function (m) {
    return memberStats(project, m.id).assigned > 0;
  });
  if (withTasks.length === 0) return 0;

  let total = 0;
  for (let i = 0; i < withTasks.length; i++) {
    total += memberStats(project, withTasks[i].id).pct;
  }
  return Math.round(total / withTasks.length);
}

// percent done
function projectCompletionPct(project) {
  if (project.tasks.length === 0) return 0;
  const done = project.tasks.filter(function (t) {
    return t.status === "done";
  });
  return Math.round((done.length / project.tasks.length) * 100);
}

// workload share
function contributionShares(project) {
  const total = project.tasks.length;
  const shares = [];
  for (let i = 0; i < project.members.length; i++) {
    const m = project.members[i];
    const stats = memberStats(project, m.id);
    const pct = total > 0 ? Math.round((stats.assigned / total) * 100) : 0;
    shares.push({ member: m, share: pct });
  }
  return shares;
}

// fairness score
function fairnessScore(project) {
  const n = project.members.length;
  if (n < 2 || project.tasks.length === 0) {
    return { score: null, uneven: false };
  }

  const shares = contributionShares(project);
  const ideal = 100 / n;

  // add up how far everyone is from an equal split
  let deviation = 0;
  for (let i = 0; i < shares.length; i++) {
    deviation += Math.abs(shares[i].share - ideal);
  }

  // one person's extra is always someone else's shortfall, so /2
  // avoids double counting the same imbalance twice
  const misallocated = deviation / 2;

  let score = Math.round(100 - misallocated);
  if (score < 0) score = 0;

  return { score: score, uneven: score < 70 };
}

// score to label
function fairnessLabel(score) {
  if (score >= 90) return "Excellent distribution";
  if (score >= 70) return "Acceptable distribution";
  if (score >= 50) return "Uneven workload";
  return "Critical imbalance";
}

// who's inactive
function inactiveMembers(project) {
  const thresholdDays = project.inactivityThresholdDays || 3;
  const result = [];
  for (let i = 0; i < project.members.length; i++) {
    const m = project.members[i];
    const stats = memberStats(project, m.id);
    if (stats.assigned === 0) continue; // no tasks yet
    const idleDays = daysSince(m.lastActiveAt || 0);
    if (idleDays >= thresholdDays) {
      result.push({ member: m, days: idleDays });
    }
  }
  return result;
}

// health score
function teamHealth(project) {
  let overdueCount = 0;
  let blockedCount = 0;
  for (let i = 0; i < project.tasks.length; i++) {
    const t = project.tasks[i];
    if (isOverdue(t)) overdueCount++;
    if (t.blocked && t.status !== "done") blockedCount++;
  }

  const fairness = fairnessScore(project);
  const fairnessPart = fairness.score === null ? 100 : fairness.score;

  let score = Math.round(projectCompletionPct(project) * 0.6 + fairnessPart * 0.4);
  score -= overdueCount * 8;
  score -= blockedCount * 5;
  if (score < 0) score = 0;
  if (score > 100) score = 100;

  let level = "red";
  let label = "🔴 Critical";
  if (score >= 70) { level = "green"; label = "🟢 Healthy"; }
  else if (score >= 40) { level = "yellow"; label = "🟡 At Risk"; }

  return { score: score, level: level, label: label, overdue: overdueCount, blocked: blockedCount };
}

// risk score
function projectRisk(project) {
  const health = teamHealth(project);
  const fairness = fairnessScore(project);
  const inactive = inactiveMembers(project);
  const reasons = [];
  let points = 0;

  if (health.overdue > 0) {
    points += health.overdue * 2;
    reasons.push(health.overdue + (health.overdue === 1 ? " overdue task" : " overdue tasks"));
  }
  if (health.blocked > 0) {
    points += health.blocked * 2;
    reasons.push(health.blocked + (health.blocked === 1 ? " blocked task" : " blocked tasks"));
  }
  if (fairness.score !== null && fairness.score < 70) {
    points += 3;
    reasons.push("Contribution imbalance detected");
  }
  if (health.level === "red") {
    points += 3;
    reasons.push("Team health is critical");
  } else if (health.level === "yellow") {
    points += 1;
  }
  if (inactive.length > 0) {
    points += inactive.length * 2;
    reasons.push(inactive.length + (inactive.length === 1 ? " inactive member" : " inactive members"));
  }

  let level = "low";
  if (points >= 7) level = "high";
  else if (points >= 3) level = "medium";

  return { level: level, points: points, reasons: reasons };
}

// nudge text
function nudgeFor(project, member) {
  const stats = memberStats(project, member.id);
  if (stats.assigned === 0) return null;
  const avg = teamAveragePct(project);
  if (avg - stats.pct >= 20) {
    const firstName = member.name.split(" ")[0];
    return firstName + " is at " + stats.pct + "% while the team average is " + avg + "%. Consider reassigning a task.";
  }
  return null;
}

// escape html
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

// switch screen
function showView(viewId) {
  const views = document.querySelectorAll(".tp-view");
  for (let i = 0; i < views.length; i++) {
    views[i].classList.add("tp-hidden");
  }
  document.getElementById(viewId).classList.remove("tp-hidden");
  document.getElementById("backBtn").classList.toggle("tp-hidden", viewId === "view-dashboard");
}

// draw dashboard
function renderDashboard() {
  const grid = document.getElementById("projectGrid");
  const empty = document.getElementById("dashEmptyState");
  grid.innerHTML = "";

  if (state.projects.length === 0) {
    empty.classList.remove("tp-hidden");
    return;
  }
  empty.classList.add("tp-hidden");

  for (let i = 0; i < state.projects.length; i++) {
    const project = state.projects[i];
    const pct = projectCompletionPct(project);
    const health = teamHealth(project);
    const days = daysUntil(project.deadline);
    const deadlineLabel = daysLabel(days, "Due today", "d left");

    const card = document.createElement("div");
    card.className = "tp-project-card";
    card.innerHTML =
      '<button class="tp-card-delete" title="Delete project" aria-label="Delete project">✕</button>' +
      "<h3>" + escapeHtml(project.name) + "</h3>" +
      '<p class="tp-card-desc">' + escapeHtml(project.description || "No description yet.") + "</p>" +
      '<div class="tp-card-row">' +
        '<span class="tp-card-health" data-level="' + health.level + '">' + health.label + "</span>" +
        "<span>" + deadlineLabel + "</span>" +
      "</div>" +
      '<div class="tp-mini-progress"><div class="tp-mini-progress-fill" style="width:0%"></div></div>' +
      '<div class="tp-card-row"><span>' + pct + "% complete</span><span>" +
        project.members.length + " member" + (project.members.length === 1 ? "" : "s") + "</span></div>";

    card.addEventListener("click", function (e) {
      if (e.target.closest(".tp-card-delete")) return;
      openProject(project.id);
    });

    card.querySelector(".tp-card-delete").addEventListener("click", function (e) {
      e.stopPropagation();
      if (confirm('Delete "' + project.name + '"? This cannot be undone.')) {
        state.projects = state.projects.filter(function (p) {
          return p.id !== project.id;
        });
        saveData();
        renderDashboard();
        showToast("Project deleted");
      }
    });

    grid.appendChild(card);

    setTimeout(function () {
      card.querySelector(".tp-mini-progress-fill").style.width = pct + "%";
    }, 30);
  }
}

// draw project view
function renderProjectView() {
  const project = currentProject();
  if (!project) return;

  document.getElementById("projectName").textContent = project.name;
  document.getElementById("projectDesc").textContent = project.description || "";

  const days = daysUntil(project.deadline);
  document.getElementById("deadlineCountdown").textContent = daysLabel(days, "Today", " days");
  document.querySelector(".tp-badge-deadline").dataset.urgent = String(days <= 2);

  saveData();

  document.getElementById("inactivityThreshold").value = project.inactivityThresholdDays || 3;

  renderInsights(project);
  renderBlocked(project);
  renderBoard(project);
  renderMembers(project);
  renderWorkloadDistribution(project);
  renderActivity(project);
  renderTabBadges(project);
}

// draw insights
function renderInsights(project) {
  const health = teamHealth(project);
  document.getElementById("healthValue").textContent = health.label;
  document.getElementById("healthDetail").textContent = health.score + "/100";
  document.getElementById("healthCard").dataset.level = health.level;

  const risk = projectRisk(project);
  let riskWord = "Low Risk";
  let riskEmoji = "🟢";
  if (risk.level === "medium") { riskWord = "Medium Risk"; riskEmoji = "🟡"; }
  if (risk.level === "high") { riskWord = "High Risk"; riskEmoji = "🔴"; }
  document.getElementById("riskValue").textContent = riskEmoji + " " + riskWord;
  document.getElementById("riskDetail").textContent =
    risk.reasons.length > 0 ? risk.reasons.join(" · ") : "Nothing to flag right now";
  document.getElementById("riskCard").dataset.level = risk.level;

  const fairness = fairnessScore(project);
  const fairnessValue = document.getElementById("fairnessValue");
  const fairnessDetail = document.getElementById("fairnessDetail");
  const fairnessCard = document.getElementById("fairnessCard");
  if (fairness.score === null) {
    fairnessValue.textContent = "—";
    fairnessDetail.textContent = "Needs 2+ members and tasks";
    fairnessCard.dataset.uneven = "false";
  } else {
    fairnessValue.textContent = fairness.score + "/100";
    if (fairness.uneven) {
      fairnessDetail.textContent = "⚠ Uneven contribution detected";
    } else {
      fairnessDetail.textContent = fairnessLabel(fairness.score);
    }
    fairnessCard.dataset.uneven = String(fairness.uneven);
  }
}

// draw blocked list
function renderBlocked(project) {
  const section = document.getElementById("blockedSection");
  const list = document.getElementById("blockedList");
  const blocked = project.tasks.filter(function (t) {
    return t.blocked && t.status !== "done";
  });

  if (blocked.length === 0) {
    section.classList.add("tp-hidden");
    list.innerHTML = "";
    return;
  }
  section.classList.remove("tp-hidden");

  let html = "";
  for (let i = 0; i < blocked.length; i++) {
    const task = blocked[i];
    const member = project.members.find(function (m) {
      return m.id === task.assignedTo;
    });
    const who = member ? member.name.split(" ")[0] : "Unassigned";
    html +=
      '<button class="tp-blocked-item" data-task-id="' + task.id + '">' +
        "<b>" + escapeHtml(who) + "</b> is stuck on “" + escapeHtml(task.title) + "”" +
        '<span class="tp-blocked-due">Due ' + formatShortDate(task.dueDate) + "</span>" +
      "</button>";
  }
  list.innerHTML = html;

  const items = list.querySelectorAll(".tp-blocked-item");
  for (let i = 0; i < items.length; i++) {
    items[i].addEventListener("click", function (e) {
      openTaskDetail(e.currentTarget.dataset.taskId);
    });
  }
}

// draw board
// TODO: drag and drop between columns would be nice, ran out of time
function renderBoard(project) {
  const columns = { todo: [], "in-progress": [], done: [] };
  for (let i = 0; i < project.tasks.length; i++) {
    columns[project.tasks[i].status].push(project.tasks[i]);
  }

  const statusNames = ["todo", "in-progress", "done"];
  for (let s = 0; s < statusNames.length; s++) {
    const status = statusNames[s];
    const list = columns[status];
    const container = document.getElementById("col-" + status);
    document.getElementById("count-" + status).textContent = list.length;
    container.innerHTML = "";

    list.sort(function (a, b) {
      return a.dueDate.localeCompare(b.dueDate);
    });

    for (let i = 0; i < list.length; i++) {
      container.appendChild(renderTaskCard(project, list[i]));
    }
  }
}

// build task card
function renderTaskCard(project, task) {
  const member = project.members.find(function (m) {
    return m.id === task.assignedTo;
  });
  const overdue = isOverdue(task);

  let cardClass = "tp-task";
  if (task.blocked) cardClass += " is-blocked";
  if (overdue) cardClass += " is-overdue-card";

  const card = document.createElement("div");
  card.className = cardClass;
  card.dataset.taskId = task.id;
  card.dataset.status = task.status;

  const memberFirst = member ? member.name.split(" ")[0] : "Unassigned";
  const memberInitials = member ? initials(member.name) : "?";

  card.innerHTML =
    '<div class="tp-task-flag"></div>' +
    '<button class="tp-task-done-toggle' + (task.status === "done" ? " is-checked" : "") + '" title="Mark done" aria-label="Toggle done">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>' +
    "</button>" +
    '<div class="tp-task-body">' +
      '<div class="tp-task-title">' + escapeHtml(task.title) + "</div>" +
      '<div class="tp-task-meta">' +
        '<span class="tp-task-assignee">' +
          '<span class="tp-avatar">' + memberInitials + "</span>" +
          escapeHtml(memberFirst) +
        "</span>" +
        '<span class="tp-task-due ' + (overdue ? "is-overdue" : "") + '">' + formatShortDate(task.dueDate) + "</span>" +
      "</div>" +
    "</div>";

  // open details
  card.querySelector(".tp-task-body").addEventListener("click", function () {
    openTaskDetail(task.id);
  });

  // toggle done
  card.querySelector(".tp-task-done-toggle").addEventListener("click", function (e) {
    e.stopPropagation();
    const wasDone = task.status === "done";
    task.status = wasDone ? "todo" : "done";
    touchMemberActivity(project, task.assignedTo);
    logActivity(project, "<b>" + escapeHtml(task.title) + "</b> " + (wasDone ? "was reopened" : "was marked done"));
    saveData();
    renderProjectView();
  });

  return card;
}

// draw members
// kinda long, could split this up but it works
function renderMembers(project) {
  const list = document.getElementById("memberList");
  list.innerHTML = "";

  if (project.members.length === 0) {
    list.innerHTML = '<p style="color:var(--tp-text-tertiary);font-size:12.5px;">Add teammates to start tracking contributions.</p>';
    return;
  }

  const shares = contributionShares(project);
  const inactiveList = inactiveMembers(project);

  for (let i = 0; i < project.members.length; i++) {
    const member = project.members[i];
    const stats = memberStats(project, member.id);
    const nudge = nudgeFor(project, member);
    const share = shares[i].share;

    let alertHtml = "";
    if (stats.assigned > 0 && stats.pct < teamAveragePct(project) - 20) {
      alertHtml = '<span class="tp-alert-pill">Below team average</span>';
    }

    let inactiveHtml = "";
    for (let j = 0; j < inactiveList.length; j++) {
      if (inactiveList[j].member.id === member.id) {
        const d = inactiveList[j].days;
        inactiveHtml = '<span class="tp-inactive-pill">⚠ Inactive ' + d + (d === 1 ? " day" : " days") + "</span>";
        break;
      }
    }

    let nudgeHtml = "";
    if (nudge) {
      nudgeHtml = '<div class="tp-nudge">' + escapeHtml(nudge) + "</div>";
    }

    const card = document.createElement("div");
    card.className = "tp-member-card";
    card.innerHTML =
      '<div class="tp-member-top">' +
        '<div class="tp-member-avatar">' + initials(member.name) + "</div>" +
        "<div>" +
          '<div class="tp-member-name">' + escapeHtml(member.name) + "</div>" +
          '<div class="tp-member-role">' + escapeHtml(member.role || "Team member") + "</div>" +
        "</div>" +
        '<span class="tp-share-pill" title="Share of team workload">' + share + "% of work</span>" +
      "</div>" +
      '<div class="tp-member-progress"><div class="tp-member-progress-fill" style="width:0%"></div></div>' +
      '<div class="tp-member-stat-line">' +
        "<span>" + stats.completed + "/" + stats.assigned + " tasks done</span>" +
        "<span>" + stats.pct + "%</span>" +
      "</div>" +
      alertHtml + inactiveHtml + nudgeHtml;

    list.appendChild(card);
    setTimeout(function () {
      card.querySelector(".tp-member-progress-fill").style.width = stats.pct + "%";
    }, 30);
  }
}

// draw workload bars
function renderWorkloadDistribution(project) {
  const container = document.getElementById("workloadList");
  container.innerHTML = "";

  if (project.members.length === 0 || project.tasks.length === 0) {
    container.innerHTML = '<p style="color:var(--tp-text-tertiary);font-size:12px;">Add tasks to see how work is spread across the team.</p>';
    return;
  }

  const shares = contributionShares(project).slice();
  shares.sort(function (a, b) {
    return b.share - a.share;
  });

  for (let i = 0; i < shares.length; i++) {
    const item = shares[i];
    const row = document.createElement("div");
    row.className = "tp-workload-row";
    row.innerHTML =
      '<span class="tp-workload-name">' + escapeHtml(item.member.name.split(" ")[0]) + "</span>" +
      '<div class="tp-workload-track"><div class="tp-workload-fill" style="width:0%"></div></div>' +
      '<span class="tp-workload-pct">' + item.share + "%</span>";
    container.appendChild(row);

    setTimeout(function (barEl, pct) {
      return function () {
        barEl.style.width = pct + "%";
      };
    }(row.querySelector(".tp-workload-fill"), item.share), 30);
  }
}

// draw activity
function renderActivity(project) {
  const log = document.getElementById("activityLog");
  const activity = project.activity || [];

  if (activity.length === 0) {
    log.innerHTML = '<p style="color:var(--tp-text-tertiary);font-size:12.5px;">Nothing yet — actions will show up here.</p>';
    return;
  }

  let html = "";
  for (let i = 0; i < activity.length; i++) {
    html +=
      '<div class="tp-activity-item">' +
        activity[i].message +
        '<span class="tp-activity-time">' + timeAgo(activity[i].timestamp) + "</span>" +
      "</div>";
  }
  log.innerHTML = html;
}

// update tab badges
function renderTabBadges(project) {
  const memberCount = project.members.length;
  const activityCount = (project.activity || []).length;

  document.getElementById("tabcount-contribution").textContent = memberCount;
  document.getElementById("tabcount-workload").textContent = memberCount;
  document.getElementById("tabcount-activity").textContent = activityCount;

  // flag if nudged
  let anyNudge = false;
  for (let i = 0; i < project.members.length; i++) {
    if (nudgeFor(project, project.members[i])) { anyNudge = true; break; }
  }
  document.querySelector('.tp-tab[data-tab="contribution"]').classList.toggle("has-alert", anyNudge);

  // flag if inactive
  const anyInactive = inactiveMembers(project).length > 0;
  document.querySelector('.tp-tab[data-tab="activity"]').classList.toggle("has-alert", anyInactive);
}

// fill member list
function fillMemberSelect(selectEl, project, selectedId) {
  if (project.members.length === 0) {
    selectEl.innerHTML = '<option value="">Add a member first</option>';
    return;
  }
  let html = "";
  for (let i = 0; i < project.members.length; i++) {
    const m = project.members[i];
    const selected = m.id === selectedId ? "selected" : "";
    html += '<option value="' + m.id + '" ' + selected + ">" + escapeHtml(m.name) + "</option>";
  }
  selectEl.innerHTML = html;
}

// reset tabs
function resetSidebarTabs() {
  const tabs = document.querySelectorAll(".tp-tab");
  const panels = document.querySelectorAll(".tp-tabpanel");
  for (let i = 0; i < tabs.length; i++) {
    tabs[i].classList.remove("is-active");
    tabs[i].setAttribute("aria-selected", "false");
  }
  for (let i = 0; i < panels.length; i++) panels[i].classList.add("tp-hidden");
  const contributionTab = document.querySelector('.tp-tab[data-tab="contribution"]');
  contributionTab.classList.add("is-active");
  contributionTab.setAttribute("aria-selected", "true");
  document.getElementById("tabpanel-contribution").classList.remove("tp-hidden");
}

// open a project
function openProject(id) {
  ui.currentProjectId = id;
  showView("view-project");
  resetSidebarTabs();
  renderProjectView();
}

document.getElementById("logoHome").addEventListener("click", function () {
  ui.currentProjectId = null;
  showView("view-dashboard");
  renderDashboard();
});
document.getElementById("backBtn").addEventListener("click", function () {
  document.getElementById("logoHome").click();
});

// new project button
document.getElementById("newProjectBtn").addEventListener("click", function () {
  document.getElementById("projectForm").reset();
  openModal("modal-project");
});
document.getElementById("projectForm").addEventListener("submit", function (e) {
  e.preventDefault();
  const project = {
    id: uid(),
    name: document.getElementById("pf-name").value.trim(),
    deadline: document.getElementById("pf-deadline").value,
    description: document.getElementById("pf-desc").value.trim(),
    members: [],
    tasks: [],
    activity: [],
    inactivityThresholdDays: 3
  };
  state.projects.push(project);
  saveData();
  closeModal("modal-project");
  renderDashboard();
  openProject(project.id);
  showToast("Project created");
});

// add member button
document.getElementById("addMemberBtn").addEventListener("click", function () {
  document.getElementById("memberForm").reset();
  openModal("modal-member");
});
document.getElementById("memberForm").addEventListener("submit", function (e) {
  e.preventDefault();
  const project = currentProject();
  const member = {
    id: uid(),
    name: document.getElementById("mf-name").value.trim(),
    role: document.getElementById("mf-role").value.trim(),
    lastActiveAt: Date.now()
  };
  project.members.push(member);
  logActivity(project, "<b>" + escapeHtml(member.name) + "</b> joined the project");
  saveData();
  closeModal("modal-member");
  renderProjectView();
  showToast("Member added");
});

// change threshold
document.getElementById("inactivityThreshold").addEventListener("change", function (e) {
  const project = currentProject();
  project.inactivityThresholdDays = parseInt(e.target.value, 10);
  saveData();
  renderProjectView();
});

// add task button
document.getElementById("addTaskBtn").addEventListener("click", function () {
  const project = currentProject();
  if (project.members.length === 0) {
    showToast("Add a team member before creating a task");
    return;
  }
  ui.editTaskId = null;
  document.getElementById("taskModalTitle").textContent = "New task";
  document.getElementById("taskForm").reset();
  document.getElementById("tf-id").value = "";
  document.getElementById("deleteTaskBtn").classList.add("tp-hidden");
  fillMemberSelect(document.getElementById("tf-assignee"), project);
  openModal("modal-task");
});

// open edit form
function openTaskEditForm(task) {
  const project = currentProject();
  ui.editTaskId = task.id;
  document.getElementById("taskModalTitle").textContent = "Edit task";
  document.getElementById("tf-id").value = task.id;
  document.getElementById("tf-title").value = task.title;
  document.getElementById("tf-due").value = task.dueDate;
  document.getElementById("tf-status").value = task.status;
  fillMemberSelect(document.getElementById("tf-assignee"), project, task.assignedTo);
  document.getElementById("deleteTaskBtn").classList.remove("tp-hidden");
  openModal("modal-task");
}

// save task
document.getElementById("taskForm").addEventListener("submit", function (e) {
  e.preventDefault();
  const project = currentProject();
  const title = document.getElementById("tf-title").value.trim();
  const assignedTo = document.getElementById("tf-assignee").value;
  const dueDate = document.getElementById("tf-due").value;
  const status = document.getElementById("tf-status").value;

  if (ui.editTaskId) {
    const task = project.tasks.find(function (t) {
      return t.id === ui.editTaskId;
    });
    task.title = title;
    task.assignedTo = assignedTo;
    task.dueDate = dueDate;
    task.status = status;
    touchMemberActivity(project, assignedTo);
    logActivity(project, "<b>" + escapeHtml(title) + "</b> was updated");
  } else {
    const task = {
      id: uid(),
      title: title,
      assignedTo: assignedTo,
      dueDate: dueDate,
      status: status,
      createdAt: Date.now(),
      blocked: false
    };
    project.tasks.push(task);
    touchMemberActivity(project, assignedTo);
    const member = project.members.find(function (m) {
      return m.id === assignedTo;
    });
    const memberName = member ? member.name : "someone";
    logActivity(project, "<b>" + escapeHtml(title) + "</b> was created and assigned to " + escapeHtml(memberName));
  }

  saveData();
  closeModal("modal-task");
  renderProjectView();
});

// delete task button
document.getElementById("deleteTaskBtn").addEventListener("click", function () {
  const project = currentProject();
  const task = project.tasks.find(function (t) {
    return t.id === ui.editTaskId;
  });
  if (!task) return;
  if (confirm("Delete this task?")) {
    project.tasks = project.tasks.filter(function (t) {
      return t.id !== ui.editTaskId;
    });
    logActivity(project, "<b>" + escapeHtml(task.title) + "</b> was deleted");
    saveData();
    closeModal("modal-task");
    renderProjectView();
  }
});

// open task detail
function openTaskDetail(taskId) {
  const project = currentProject();
  const task = project.tasks.find(function (t) {
    return t.id === taskId;
  });
  if (!task) return;
  ui.detailTaskId = taskId;

  const member = project.members.find(function (m) {
    return m.id === task.assignedTo;
  });
  const memberName = member ? member.name : "Unassigned";
  let statusText = "To do";
  if (task.status === "in-progress") statusText = "In progress";
  if (task.status === "done") statusText = "Done";

  document.getElementById("detailTitle").textContent = task.title;
  document.getElementById("detailMeta").innerHTML =
    "<span>" + escapeHtml(memberName) + "</span>" +
    "<span>Due " + formatShortDate(task.dueDate) + "</span>" +
    "<span>" + statusText + "</span>";

  const blockerBtn = document.getElementById("blockerBtn");
  blockerBtn.textContent = task.blocked ? "Unblock this task" : "I'm stuck on this";
  blockerBtn.classList.toggle("is-active", task.blocked);

  openModal("modal-detail");
}

// toggle blocked flag
document.getElementById("blockerBtn").addEventListener("click", function () {
  const project = currentProject();
  const task = project.tasks.find(function (t) {
    return t.id === ui.detailTaskId;
  });
  task.blocked = !task.blocked;
  touchMemberActivity(project, task.assignedTo);
  logActivity(project, "<b>" + escapeHtml(task.title) + "</b> " + (task.blocked ? "was flagged as blocked" : "was unblocked"));
  saveData();
  openTaskDetail(task.id);
  renderProjectView();
});

// edit from detail
document.getElementById("editFromDetailBtn").addEventListener("click", function () {
  const project = currentProject();
  const task = project.tasks.find(function (t) {
    return t.id === ui.detailTaskId;
  });
  closeModal("modal-detail");
  openTaskEditForm(task);
});

// modal helpers
function openModal(id) {
  document.getElementById(id).classList.remove("tp-hidden");
}
function closeModal(id) {
  document.getElementById(id).classList.add("tp-hidden");
}

const closeButtons = document.querySelectorAll("[data-close-modal]");
for (let i = 0; i < closeButtons.length; i++) {
  closeButtons[i].addEventListener("click", function (e) {
    closeModal(e.currentTarget.dataset.closeModal);
  });
}

const overlays = document.querySelectorAll(".tp-modal-overlay");
for (let i = 0; i < overlays.length; i++) {
  overlays[i].addEventListener("click", function (e) {
    if (e.target === e.currentTarget) e.currentTarget.classList.add("tp-hidden");
  });
}

// tab clicks
const tabButtons = document.querySelectorAll(".tp-tab");
for (let i = 0; i < tabButtons.length; i++) {
  tabButtons[i].addEventListener("click", function (e) {
    const target = e.currentTarget.dataset.tab;
    for (let j = 0; j < tabButtons.length; j++) {
      tabButtons[j].classList.remove("is-active");
      tabButtons[j].setAttribute("aria-selected", "false");
    }
    const panels = document.querySelectorAll(".tp-tabpanel");
    for (let j = 0; j < panels.length; j++) panels[j].classList.add("tp-hidden");
    e.currentTarget.classList.add("is-active");
    e.currentTarget.setAttribute("aria-selected", "true");
    document.getElementById("tabpanel-" + target).classList.remove("tp-hidden");
  });
}

// auto refresh
setInterval(function () {
  const projectHidden = document.getElementById("view-project").classList.contains("tp-hidden");
  if (ui.currentProjectId && !projectHidden) {
    renderProjectView();
  }
}, 60000);

// start app
loadData();
renderDashboard();
showView("view-dashboard");
