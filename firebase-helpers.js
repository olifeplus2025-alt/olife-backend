(function () {
  const firebaseConfig = {
    apiKey: "AIzaSyD6D-SpipI6gIRo_FWZkRxBG1oOyAY6J7E",
    authDomain: "olifeplusweb.firebaseapp.com",
    databaseURL: "https://olifeplusweb-default-rtdb.firebaseio.com",
    projectId: "olifeplusweb",
    storageBucket: "olifeplusweb.firebasestorage.app",
    messagingSenderId: "178557755300",
    appId: "1:178557755300:web:216d189f5a2cf8ed3fab31",
    measurementId: "G-Y7LFSMZYGJ"
  };

  function ensureFirebase() {
    if (!window.firebase || !firebase.database) return null;
    if (!firebase.apps || !firebase.apps.length) firebase.initializeApp(firebaseConfig);
    return firebase.database();
  }

  function normalize(value) {
    return String(value || '').trim().toLowerCase();
  }

  function safeKey(value) {
    return normalize(value).replace(/[.#$\[\]/]/g, '_') || String(Date.now());
  }

  function matchesLogin(user, login) {
    const input = normalize(login);
    return normalize(user.userInput) === input || normalize(user.email) === input || normalize(user.phone) === input;
  }

  async function allUsers() {
    const db = ensureFirebase();
    if (!db) return [];
    const snap = await db.ref('users').once('value');
    const data = snap.val() || {};
    return Object.keys(data).map(key => ({ firebaseKey: key, ...data[key] }));
  }

  async function saveUser(user) {
    const db = ensureFirebase();
    if (!db) throw new Error('Firebase not available');
    const key = safeKey(user.userInput || user.email || user.phone);
    await db.ref('users/' + key).set({ ...user, firebaseKey: key });
    return key;
  }

  async function findUserByLogin(login) {
    const users = await allUsers();
    return users.find(user => matchesLogin(user, login)) || null;
  }

  async function updateUser(oldUser, updatedUser) {
    const db = ensureFirebase();
    if (!db) throw new Error('Firebase not available');
    const users = await allUsers();
    const oldLogin = oldUser.userInput || oldUser.email || oldUser.phone;
    const found = users.filter(user => matchesLogin(user, oldLogin) || matchesLogin(user, updatedUser.email) || matchesLogin(user, updatedUser.phone));
    const newKey = safeKey(updatedUser.userInput || updatedUser.email || updatedUser.phone);
    const finalUser = { ...updatedUser, firebaseKey: newKey };
    if (!found.length) {
      await db.ref('users/' + newKey).set(finalUser);
      return newKey;
    }
    const updates = {};
    found.forEach(user => { updates['users/' + user.firebaseKey] = null; });
    updates['users/' + newKey] = finalUser;
    await db.ref().update(updates);
    return newKey;
  }

  async function getOrdersForUser(user) {
    const db = ensureFirebase();
    if (!db) return [];
    const userKey = normalize(user.userInput || user.email || user.phone);
    const snap = await db.ref('orders').once('value');
    const data = snap.val() || {};
    return Object.keys(data).map(key => ({ orderId: key, ...data[key] })).filter(order => {
      const orderKey = normalize(order.userKey || order.userEmail || order.userPhone);
      return !orderKey || orderKey === userKey;
    });
  }


  async function saveOrder(order) {
    const db = ensureFirebase();
    if (!db) return null;
    const orderId = order.orderId || ('OLIFE-' + Date.now());
    await db.ref('orders/' + orderId).set({ ...order, orderId });
    return orderId;
  }

  async function getOrderById(orderId) {
    const db = ensureFirebase();
    if (!db || !orderId) return null;
    const snap = await db.ref('orders/' + orderId).once('value');
    return snap.val() ? { orderId, ...snap.val() } : null;
  }

  async function updateOrderStatus(orderId, status, currentStep) {
    const db = ensureFirebase();
    if (!db || !orderId) throw new Error('Firebase not available');
    const updates = {
      status,
      currentStep: Number(currentStep),
      updatedAt: new Date().toISOString()
    };
    await db.ref('orders/' + orderId).update(updates);
    return updates;
  }

  window.OlifeFirebase = { saveUser, findUserByLogin, updateUser, getOrdersForUser, saveOrder, getOrderById, updateOrderStatus };
})();
