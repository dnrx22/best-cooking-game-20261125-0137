// Dapur Kilat — Rush Hour Kitchen
// A timed cooking game. Orders appear on the board; pick ingredients from
// the counter, stack them on the plate, and serve before the order expires.
// Plain DOM, no network, no external assets.
(function () {
  "use strict";

  var INGREDIENTS = [
    { id: "bun",     name: "Bun",     emoji: "\u{1F35E}", key: "1" },
    { id: "patty",   name: "Patty",   emoji: "\u{1F969}", key: "2" },
    { id: "lettuce", name: "Lettuce", emoji: "\u{1F96C}", key: "3" },
    { id: "tomato",  name: "Tomato",  emoji: "\u{1F345}", key: "4" },
    { id: "cheese",  name: "Cheese",  emoji: "\u{1F9C0}", key: "5" },
    { id: "egg",     name: "Egg",     emoji: "\u{1F373}", key: "6" }
  ];

  var MENU = [
    { name: "Classic Burger", emoji: "\u{1F354}", recipe: ["bun", "patty", "lettuce"] },
    { name: "Cheese Burger",  emoji: "\u{1F9C0}", recipe: ["bun", "patty", "cheese"] },
    { name: "Garden Salad",   emoji: "\u{1F957}", recipe: ["lettuce", "tomato", "egg"] },
    { name: "Egg Sandwich",   emoji: "\u{1F96A}", recipe: ["bun", "egg", "cheese"] },
    { name: "Veggie Plate",   emoji: "\u{1F345}", recipe: ["lettuce", "tomato", "cheese"] }
  ];

  var SHIFT_SECONDS = 120;
  var ORDER_SECONDS = 30;
  var MAX_ORDERS = 3;
  var WRONG_PENALTY = 10;
  var EXPIRED_PENALTY = 15;
  var STREAK_BONUS = 25;

  var state = {
    running: false,
    timeLeft: SHIFT_SECONDS,
    score: 0,
    served: 0,
    mistakes: 0,
    expired: 0,
    streak: 0,
    bestStreak: 0,
    plate: [],
    orders: [],       // { dish, left }
    nextOrderId: 1,
    tickHandle: null,
    spawnHandle: null
  };

  var $ = function (id) { return document.getElementById(id); };

  function ingredientById(id) {
    for (var i = 0; i < INGREDIENTS.length; i++) {
      if (INGREDIENTS[i].id === id) return INGREDIENTS[i];
    }
    return null;
  }

  function fmtTime(sec) {
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  function sameSet(a, b) {
    if (a.length !== b.length) return false;
    var sa = a.slice().sort().join(",");
    var sb = b.slice().sort().join(",");
    return sa === sb;
  }

  function toast(msg, good) {
    var t = $("toast");
    t.textContent = msg;
    t.className = good ? "good" : "bad";
  }

  // ---------- rendering ----------
  function renderIngredients() {
    var box = $("ingredients");
    box.innerHTML = "";
    INGREDIENTS.forEach(function (ing) {
      var b = document.createElement("button");
      b.className = "ing";
      b.type = "button";
      b.innerHTML = '<span class="emoji">' + ing.emoji + '</span>' + ing.name +
        '<br><span class="key">key ' + ing.key + '</span>';
      b.addEventListener("click", function () { addIngredient(ing.id); });
      box.appendChild(b);
    });
  }

  function renderPlate() {
    var plate = $("plate");
    if (state.plate.length === 0) {
      plate.innerHTML = '<div class="hint">Plate is empty.<br>Pick ingredients to start a dish.</div>';
      return;
    }
    var stack = state.plate.map(function (id) {
      var ing = ingredientById(id);
      return ing ? ing.emoji : "?";
    }).join(" ");
    var names = state.plate.map(function (id) {
      var ing = ingredientById(id);
      return ing ? ing.name : id;
    }).join(" + ");
    plate.innerHTML = '<div class="stack">' + stack + '</div><div>' + names + '</div>' +
      '<div class="hint">Press Enter to serve</div>';
  }

  function renderOrders() {
    var board = $("orders");
    board.innerHTML = "";
    for (var i = 0; i < MAX_ORDERS; i++) {
      var order = state.orders[i];
      var div = document.createElement("div");
      if (!order) {
        div.className = "order empty";
        div.textContent = "— waiting for next order —";
      } else {
        div.className = "order";
        var pct = Math.max(0, Math.round((order.left / ORDER_SECONDS) * 100));
        var need = order.dish.recipe.map(function (id) {
          var ing = ingredientById(id);
          return ing.emoji + " " + ing.name;
        }).join(" · ");
        div.innerHTML = "<h3>" + order.dish.emoji + " " + order.dish.name +
          " <span style='float:right'>#" + order.id + "</span></h3>" +
          '<div class="need">' + need + '</div>' +
          '<div class="bar"><i class="' + (order.left <= 8 ? "urgent" : "") +
          '" style="width:' + pct + '%"></i></div>' +
          "<div style='margin-top:4px;font-size:13px'>expires in " + order.left + "s</div>";
      }
      board.appendChild(div);
    }
  }

  function renderHud() {
    $("score").textContent = state.score;
    $("served").textContent = state.served;
    $("streak").textContent = "x" + state.streak;
    var t = $("timer");
    t.textContent = fmtTime(Math.max(0, state.timeLeft));
    t.className = state.timeLeft <= 15 ? "low" : "";
  }

  function renderAll() {
    renderPlate();
    renderOrders();
    renderHud();
  }

  // ---------- gameplay ----------
  function spawnOrder() {
    if (!state.running) return;
    if (state.orders.length >= MAX_ORDERS) return;
    var dish = MENU[Math.floor(Math.random() * MENU.length)];
    state.orders.push({ id: state.nextOrderId++, dish: dish, left: ORDER_SECONDS });
    renderOrders();
  }

  function addIngredient(id) {
    if (!state.running) return;
    if (state.plate.length >= 4) {
      toast("Plate is full — serve or clear it first.", false);
      return;
    }
    state.plate.push(id);
    renderPlate();
  }

  function clearPlate() {
    if (!state.running) return;
    state.plate = [];
    renderPlate();
  }

  function serve() {
    if (!state.running) return;
    if (state.plate.length === 0) {
      toast("Plate is empty — add ingredients first.", false);
      return;
    }
    for (var i = 0; i < state.orders.length; i++) {
      if (sameSet(state.plate, state.orders[i].dish.recipe)) {
        var order = state.orders[i];
        var bonus = Math.round((order.left / ORDER_SECONDS) * 50);
        state.streak += 1;
        if (state.streak > state.bestStreak) state.bestStreak = state.streak;
        var streakBonus = (state.streak - 1) * STREAK_BONUS;
        var points = 100 + bonus + streakBonus;
        state.score += points;
        state.served += 1;
        state.orders.splice(i, 1);
        state.plate = [];
        var streakText = state.streak > 1 ? " (streak x" + state.streak + "!)" : "";
        toast("Served " + order.dish.name + "! +" + points + " points" + streakText, true);
        renderAll();
        return;
      }
    }
    state.score = Math.max(0, state.score - WRONG_PENALTY);
    state.mistakes += 1;
    state.streak = 0;
    state.plate = [];
    toast("Wrong dish! That matches no order. −" + WRONG_PENALTY + " (streak lost)", false);
    renderAll();
  }

  function tick() {
    if (!state.running) return;
    state.timeLeft -= 1;
    for (var i = state.orders.length - 1; i >= 0; i--) {
      state.orders[i].left -= 1;
      if (state.orders[i].left <= 0) {
        var lost = state.orders[i];
        state.orders.splice(i, 1);
        state.score = Math.max(0, state.score - EXPIRED_PENALTY);
        state.expired += 1;
        state.streak = 0;
        toast("Order #" + lost.id + " (" + lost.dish.name + ") expired! −" + EXPIRED_PENALTY + " (streak lost)", false);
      }
    }
    renderAll();
    if (state.timeLeft <= 0) endShift();
  }

  function startShift() {
    state.running = true;
    state.timeLeft = SHIFT_SECONDS;
    state.score = 0;
    state.served = 0;
    state.mistakes = 0;
    state.expired = 0;
    state.streak = 0;
    state.bestStreak = 0;
    state.plate = [];
    state.orders = [];
    state.nextOrderId = 1;
    $("startScreen").classList.add("hidden");
    $("endScreen").classList.add("hidden");
    toast("", true);
    spawnOrder();
    spawnOrder();
    renderAll();
    clearInterval(state.tickHandle);
    clearInterval(state.spawnHandle);
    state.tickHandle = setInterval(tick, 1000);
    state.spawnHandle = setInterval(spawnOrder, 9000);
  }

  function endShift() {
    state.running = false;
    clearInterval(state.tickHandle);
    clearInterval(state.spawnHandle);
    state.timeLeft = 0;
    renderAll();
    $("finalScore").textContent = state.score;
    $("finalStats").textContent = "Served: " + state.served + " dishes · " +
      "Mistakes: " + state.mistakes + " · Expired orders: " + state.expired +
      " · Best streak: x" + state.bestStreak;
    var verdict;
    if (state.served >= 8) verdict = "🏆 Head chef! The kitchen runs on your watch.";
    else if (state.served >= 5) verdict = "👨‍🍳 Solid shift — the lunch rush survived.";
    else if (state.served >= 2) verdict = "🍳 A decent start — practice the recipes.";
    else verdict = "🥄 Tough shift — try again, the recipes are on the start screen.";
    $("finalVerdict").textContent = verdict;
    $("endScreen").classList.remove("hidden");
  }

  // ---------- input ----------
  document.addEventListener("keydown", function (e) {
    if (!state.running) {
      if (e.key === "Enter" && !$("startScreen").classList.contains("hidden")) startShift();
      else if (e.key === "Enter" && !$("endScreen").classList.contains("hidden")) startShift();
      return;
    }
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); serve(); return; }
    if (e.key === "Backspace") { e.preventDefault(); clearPlate(); return; }
    for (var i = 0; i < INGREDIENTS.length; i++) {
      if (e.key === INGREDIENTS[i].key) { addIngredient(INGREDIENTS[i].id); return; }
    }
  });

  $("serveBtn").addEventListener("click", serve);
  $("clearBtn").addEventListener("click", clearPlate);
  $("startBtn").addEventListener("click", startShift);
  $("againBtn").addEventListener("click", startShift);

  // ---------- boot ----------
  renderIngredients();
  renderAll();

  // Test/debug hook (used only by the local screenshot script).
  window.__dapurKilat = {
    state: state,
    start: startShift,
    serve: serve,
    add: addIngredient,
    clear: clearPlate,
    setTimeLeft: function (s) { state.timeLeft = s; renderHud(); },
    setOrderTime: function (s) {
      state.orders.forEach(function (o) { o.left = s; });
      renderOrders();
    }
  };
})();
