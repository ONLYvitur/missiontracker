// ---- Firebase Config ----
const firebaseConfig = {
  apiKey: "AIzaSyA7B7rovUIpikVGepAqQI2s3Y_xePEwkSA",
  authDomain: "missiontracker-52bb7.firebaseapp.com",
  projectId: "missiontracker-52bb7",
  storageBucket: "missiontracker-52bb7.appspot.com",
  messagingSenderId: "1029768338042",
  appId: "1:1029768338042:web:23b2a0539e0aab53daf9c3",
  measurementId: "G-TNVPW8RETF"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// ---- Category Permissions ----
const allCategories = ["תקשוב", "לוגיסטיקה", "רכב", "מטבח", "מחנה"];
const userCategoryPermissions = {
  "matanel@mission.com": ["מחנה"],
  "anan@mission.com": ["תקשוב"],
  "hagai@mission.com": ["מטבח"],
  "walla@mission.com": ["רכב"],
  "yosef@mission.com": ["לוגיסטיקה"],
  "kfir@mission.com": allCategories
};

// ---- Dark Mode ----
(function(){
  const darkToggle = document.getElementById('darkToggle');
  darkToggle.onclick = function() {
    document.body.classList.toggle('dark');
    localStorage.setItem('task_dark', document.body.classList.contains('dark') ? '1' : '0');
    document.getElementById('darkIcon').textContent = document.body.classList.contains('dark') ? "☀️" : "🌙";
  };
  if(localStorage.getItem('task_dark') === '1') {
    document.body.classList.add('dark');
    document.getElementById('darkIcon').textContent = "☀️";
  }
})();

// ---- Auth ----
let currentUser = null;
function updateAuthUI(user) {
  currentUser = user;
  document.getElementById('authBox').style.display = user ? 'none' : '';
  document.getElementById('logoutBtn').classList.toggle('hidden', !user);
  document.getElementById('logoutBtnHeader').classList.toggle('hidden', !user);
  document.getElementById('personalGreeting').textContent = user ? `שלום, ${user.email || user.displayName || "משתמש"}!` : '';
  if(user && user.photoURL) document.getElementById('avatar').src = user.photoURL;
  if(user) loadMissions();
}
auth.onAuthStateChanged(updateAuthUI);

document.getElementById('loginBtn').onclick = async ()=>{
  let email = document.getElementById('authEmail').value;
  let pass = document.getElementById('authPass').value;
  try {
    await auth.signInWithEmailAndPassword(email, pass);
  } catch(e) {
    document.getElementById('authStatus').textContent = "שגיאה: "+e.message;
  }
};
document.getElementById('registerBtn').onclick = async ()=>{
  let email = document.getElementById('authEmail').value;
  let pass = document.getElementById('authPass').value;
  try {
    await auth.createUserWithEmailAndPassword(email, pass);
  } catch(e) {
    document.getElementById('authStatus').textContent = "שגיאה: "+e.message;
  }
};
document.getElementById('logoutBtn').onclick = ()=>auth.signOut();
document.getElementById('logoutBtnHeader').onclick = ()=>auth.signOut();

document.getElementById('avatar').onclick = ()=>document.getElementById('avatarUpload').click();
document.getElementById('avatarUpload').onchange = async function(e) {
  if(!currentUser) return;
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = async function(evt) {
    await currentUser.updateProfile({ photoURL: evt.target.result });
    document.getElementById('avatar').src = evt.target.result;
  };
  reader.readAsDataURL(file);
};

// ---- Missions Data & UI ----
let missions = [];
let filteredMissions = [];
let selectedMissions = [];
let editMissionId = null;
let currentCategory = "all";

// --- DEADLINE COLOR HELPERS ---
function getDeadlineColorClass(dueDateStr) {
  if (!dueDateStr) return '';
  const today = new Date();
  const todayStr = today.toISOString().slice(0,10);
  const due = new Date(dueDateStr + 'T23:59:59');
  const now = new Date();
  const diff = due - now;
  const msInDay = 24*60*60*1000;
  if (dueDateStr < todayStr) return 'deadline-past';
  if (diff < msInDay) return 'deadline-today';
  if (diff < 3*msInDay) return 'deadline-soon';
  return 'deadline-future';
}

function renderMissions() {
  const missionsEl = document.getElementById('missions');
  missionsEl.innerHTML = "";
  if(filteredMissions.length === 0) {
    missionsEl.innerHTML = `<div class="text-center text-gray-400 mt-10">אין משימות לתצוגה</div>`;
    return;
  }
  filteredMissions.forEach(m => {
    let allowedCategories = allCategories;
    let canEditDelete = false;
    if (currentUser && userCategoryPermissions[currentUser.email]) {
      allowedCategories = userCategoryPermissions[currentUser.email];
    }
    if (allowedCategories.includes(m.category)) canEditDelete = true;

    const deadlineClass = getDeadlineColorClass(m.due);

    missionsEl.innerHTML += `
    <div class="mission-card bg-white p-4 rounded-xl shadow flex flex-col gap-2 border border-gray-100 relative">
      <div class="flex items-center justify-between flex-row-reverse">
        <span class="text-lg font-bold">${m.title}</span>
        <span class="text-xs px-2 py-1 rounded status-badge ${m.status==='done'?'bg-green-200':'bg-gray-200'}">${m.status==='done'?'בוצע': (m.status==='archived'?'בארכיון':'פעיל')}</span>
      </div>
      <div class="text-sm text-gray-600">${m.desc||''}</div>
      <div class="flex items-center gap-2 flex-row-reverse">
        <span class="priority-${m.priority} text-xs px-2 py-1 rounded">${m.priority==='high'?'גבוהה':m.priority==='medium'?'בינונית':'נמוכה'}</span>
        <span class="text-gray-500 text-xs">${m.category||''}</span>
        <span class="text-xs ${deadlineClass}">${m.due||''}</span>
      </div>
      ${m.fileURL ? (
        m.fileType && m.fileType.startsWith('image/') ?
          `<div class="mt-2"><img src="${m.fileURL}" alt="${m.fileName||''}" style="max-width:100px;max-height:100px;border-radius:8px;border:1px solid #ccc"></div>`
          :
          `<div class="mt-2"><a href="${m.fileURL}" target="_blank" class="text-blue-600 underline">צפה/הורד קובץ: ${m.fileName||'קובץ'}</a></div>`
      ) : ''}
      <div class="flex items-center gap-2 flex-row-reverse mt-2">
        ${canEditDelete ? `<button onclick="editMission('${m.id}')" class="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs">ערוך</button>
        <button onclick="archiveMission('${m.id}')" class="bg-red-100 text-red-700 px-2 py-1 rounded text-xs">${m.status==='archived'?'מחק סופית':'העבר לארכיון'}</button>` : ''}
        <button onclick="openMissionChat('${m.id}')" class="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">צ'אט</button>
      </div>
    </div>
    `;
  });
}

function filterMissions() {
  const search = document.getElementById('searchInput').value.trim();
  const priority = document.getElementById('priorityFilter').value;
  filteredMissions = missions.filter(m=>{
    let matches = true;
    if(currentCategory !== "all" && currentCategory !== "archive")
      matches = matches && m.category === currentCategory && m.status !== 'archived';
    if(currentCategory === "archive")
      matches = matches && m.status === "archived";
    if(currentCategory === "all")
      matches = matches && m.status !== 'archived';
    if(search)
      matches = matches && (m.title.includes(search)||m.desc.includes(search));
    if(priority)
      matches = matches && m.priority === priority;
    return matches;
  });
  renderMissions();
}

async function loadMissions() {
  const snapshot = await db.collection('missions').get();
  missions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  filterMissions();
  document.getElementById('loader').style.display = "none";
}

async function saveMissions() {
  if (!currentUser) return;
  for (const m of missions) {
    await db.collection('missions').doc(m.id).set({ ...m, uid: m.uid || currentUser.uid });
  }
  filterMissions();
}

function openMissionModal(editId=null, openChat=false) {
  editMissionId = editId;
  document.getElementById('missionModal').classList.remove('hidden');
  let allowedCategories = allCategories;
  if (currentUser && userCategoryPermissions[currentUser.email]) {
    allowedCategories = userCategoryPermissions[currentUser.email];
  }
  const catSelect = document.getElementById('mCategory');
  catSelect.innerHTML = '<option value="">קטגוריה</option>' + allowedCategories.map(c =>
    `<option value="${c}">${c}</option>`
  ).join('');
  const filePreview = document.getElementById('filePreview');
  filePreview.innerHTML = '';
  if(editId) {
    const m = missions.find(x=>x.id===editId);
    if (!allowedCategories.includes(m.category)) {
      alert("אין לך הרשאה לערוך משימות בקטגוריה זו");
      document.getElementById('missionModal').classList.add('hidden');
      return;
    }
    document.getElementById('modalTitle').textContent = "עריכת משימה";
    document.getElementById('mTitle').value = m.title;
    document.getElementById('mDesc').value = m.desc||'';
    document.getElementById('mDue').value = m.due||'';
    catSelect.value = m.category||'';
    document.getElementById('mPriority').value = m.priority||'';
    document.getElementById('mAssignee').value = m.assignee||'';
    document.getElementById('mChecklist').value = (m.checklist||[]).join('\n');
    document.getElementById('mFile').value = '';
    if (m && m.fileURL) {
      if (m.fileType && m.fileType.startsWith('image/')) {
        filePreview.innerHTML = `<img src="${m.fileURL}" alt="${m.fileName||''}" style="max-width:120px;max-height:120px;border-radius:8px;border:1px solid #ccc;display:block;margin-top:8px">`;
      } else {
        filePreview.innerHTML = `<a href="${m.fileURL}" target="_blank" class="text-blue-600 underline" style="display:inline-block;margin-top:8px">הצג קובץ: ${m.fileName||'קובץ'}</a>`;
      }
    }
    loadChatMessages(editId);
  } else {
    document.getElementById('modalTitle').textContent = "משימה חדשה";
    document.getElementById('missionForm').reset();
    filePreview.innerHTML = '';
    document.getElementById('chatMessages').innerHTML = "";
  }
  if (openChat && editId) {
    setTimeout(()=>{ document.getElementById('chatInput').focus(); }, 300);
  }
}

document.getElementById('addBtn').onclick = ()=>openMissionModal();
document.getElementById('missionForm').onsubmit = async function(e) {
  e.preventDefault();
  let allowedCategories = allCategories;
  if (currentUser && userCategoryPermissions[currentUser.email]) {
    allowedCategories = userCategoryPermissions[currentUser.email];
  }
  const chosenCat = document.getElementById('mCategory').value;
  if (!allowedCategories.includes(chosenCat)) {
    alert("אין לך הרשאה לקטגוריה זו");
    return false;
  }

  const fileInput = document.getElementById('mFile');
  const file = fileInput.files[0];

  let m = {
    title: document.getElementById('mTitle').value,
    desc: document.getElementById('mDesc').value,
    due: document.getElementById('mDue').value,
    category: chosenCat,
    priority: document.getElementById('mPriority').value,
    assignee: document.getElementById('mAssignee').value,
    checklist: document.getElementById('mChecklist').value.split('\n').filter(Boolean),
    id: editMissionId||Date.now().toString(),
    status: editMissionId ? (missions.find(x=>x.id===editMissionId)?.status || "active") : "active",
    uid: editMissionId ? (missions.find(x=>x.id===editMissionId)?.uid || currentUser?.uid) : currentUser?.uid
  };

  if (file) {
    const storageRef = storage.ref().child(`missions/${m.id}/${file.name}`);
    await storageRef.put(file);
    const fileURL = await storageRef.getDownloadURL();
    m.fileURL = fileURL;
    m.fileName = file.name;
    m.fileType = file.type;
  } else if (editMissionId) {
    const existing = missions.find(x=>x.id === editMissionId);
    if (existing && existing.fileURL) {
      m.fileURL = existing.fileURL;
      m.fileName = existing.fileName;
      m.fileType = existing.fileType;
    }
  }

  if(editMissionId) {
    let idx = missions.findIndex(x=>x.id===editMissionId);
    missions[idx] = m;
  } else {
    missions.push(m);
  }
  await saveMissions();
  document.getElementById('missionModal').classList.add('hidden');
  editMissionId = null;
  return false;
};
window.editMission = function(id){ openMissionModal(id, false); };

window.archiveMission = function(id) {
  let idx = missions.findIndex(x=>x.id===id);
  if(idx === -1) return;
  let allowedCategories = allCategories;
  if (currentUser && userCategoryPermissions[currentUser.email]) {
    allowedCategories = userCategoryPermissions[currentUser.email];
  }
  const missionCat = missions[idx].category;
  if (!allowedCategories.includes(missionCat)) {
    alert("אין לך הרשאה למחוק או לארכב משימות בקטגוריה זו");
    return;
  }
  if(missions[idx].status === "archived") {
    if(confirm("למחוק סופית את המשימה?")) {
      db.collection('missions').doc(id).delete();
      missions = missions.filter(x=>x.id!==id);
    }
  } else {
    if(confirm("להעביר משימה לארכיון?")) {
      missions[idx].status = "archived";
      saveMissions();
    }
  }
  filterMissions();
};

let currentChatMissionId = null;
function openMissionChat(id) {
  openMissionModal(id, true);
}
window.openMissionChat = openMissionChat;

function renderChatMessages(chatArr=[]) {
  const chatMessages = document.getElementById('chatMessages');
  if (!chatMessages) return;
  chatMessages.innerHTML = chatArr.map(msg =>
    `<div class="mb-1 text-right">
      <span class="font-bold">${msg.user||'אנונימי'}:</span>
      <span>${msg.text}</span>
      <span class="text-xs text-gray-400 ltr ml-1">${msg.time}</span>
    </div>`
  ).join('');
  chatMessages.scrollTop = chatMessages.scrollHeight;
}
function loadChatMessages(missionId) {
  currentChatMissionId = missionId;
  db.collection('missions').doc(missionId).collection('chat').orderBy('timestamp')
    .onSnapshot(snapshot => {
      const chatArr = snapshot.docs.map(doc => doc.data());
      renderChatMessages(chatArr);
    });
}
document.getElementById('chatForm').onsubmit = async function(e) {
  e.preventDefault();
  const text = document.getElementById('chatInput').value.trim();
  if(!text || !currentChatMissionId) return false;
  await db.collection('missions').doc(currentChatMissionId).collection('chat').add({
    text,
    user: currentUser ? (currentUser.email || "אנונימי") : "אנונימי",
    time: new Date().toLocaleTimeString('he-IL', {hour: '2-digit', minute: '2-digit'}),
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  });
  document.getElementById('chatInput').value = '';
  return false;
};

document.getElementById('exportExcelBtn').onclick = function() {
  const data = missions.map(m => ({
    כותרת: m.title,
    תיאור: m.desc,
    קטגוריה: m.category,
    עדיפות: m.priority,
    משויך: m.assignee,
    סטטוס: m.status === 'archived' ? 'בארכיון' : (m.status === 'done' ? 'בוצע' : 'פעיל'),
    תאריך: m.due
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "משימות");
  XLSX.writeFile(wb, "משימות.xlsx");
};

// --- Highlight selected category tab ---
document.querySelectorAll('.cat-tab').forEach(btn=>{
  btn.onclick = ()=>{
    currentCategory = btn.dataset.cat;
    // Remove highlight from all tabs
    document.querySelectorAll('.cat-tab').forEach(b => b.classList.remove('active-cat'));
    // Highlight the clicked tab
    btn.classList.add('active-cat');
    filterMissions();
  };
});
// highlight "all" tab on load
document.addEventListener('DOMContentLoaded', function() {
  const defaultTab = document.querySelector('.cat-tab[data-cat="all"]');
  if(defaultTab) defaultTab.classList.add('active-cat');
});

document.getElementById('searchInput').oninput = filterMissions;
document.getElementById('priorityFilter').onchange = filterMissions;
