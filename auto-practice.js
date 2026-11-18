// ==UserScript==
// @name         auto-practice
// @namespace    http://tampermonkey.net/
// @version      2026-11-18.2
// @description  Auto-complete "Ôn luyện" practice per topic, repeat N times (Ctrl+Q to start / stop)
// @author       You
// @match        https://laixebacha.huelms.com/learn/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=tampermonkey.net
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";

  // ---------------------------------------------------------------------------
  // Config
  // ---------------------------------------------------------------------------
  const DELAY = { feedback: 1000, next: 500, poll: 250 }; // ms, raise if the site is slow
  const TIMEOUT = 15000; // max wait for a page/element, ms
  const STATE_KEY = "autoPractice"; // sessionStorage: survives full page reloads
  const START_PREFIX = "Luyện tất cả"; // practice-start button text prefix
  const FINISH_LABEL = "Kết thúc luyện thi";
  const SETTLE_MS = 2500; // pause after finishing, before navigating away

  /**
   * One answer bank per topic. The key is the topic title shown on the "Ôn luyện" page.
   * Entry: [substring identifying the question, substring identifying the correct option].
   * Order matters: the first entry that matches the question AND whose answer is present wins.
   * To support another course/topic, add another key here.
   */
  const BANKS = {
    "Văn hóa, đạo đức nghề nghiệp người lái xe": [
      ["đáp ứng các điều kiện", "Hiểu biết và chấp hành"],
      ["đang xảy ra ùn tắc", "Bấm còi liên tục thúc giục"],
      ["ứng xử như thế nào", "dừng, đỗ xe đúng nơi quy định"],
      ["Người có mặt tại nơi xảy ra", "Giúp đỡ, cứu chữa"],
      ["ngọn lửa, khói hoặc nhiệt độ", "Bình tĩnh, đưa xe"],
      ["Khái niệm về văn hóa giao thông", "Cả hai ý trên"],
      ["xét thấy có khả năng dập tắt", "Cả hai ý trên"],
      ["mô tô có văn hóa giao thông khi", "đội mũ bảo hiểm đúng quy chuẩn"],
      ["tuân thủ những quy định nào", "Chấp hành hiệu lệnh"],
      ["bị bỏng", "Cả ba ý trên"],
      ["sử dụng còi xe", "Chỉ bấm còi khi thật sự"],
      [
        "Khi gặp vụ tai nạn giao thông, người lái xe nên",
        "Dừng xe, hỗ trợ nạn nhân",
      ],
      ["bỏ trốn", "Bị nghiêm cấm"],
      ["phóng nhanh, vượt ẩu", "Là thiếu văn hóa giao thông, vi phạm"],
      ["vận chuyển hành khách phải có", "Cả hai ý trên"],
      ["phun thành tia", "cầm máu không trực tiếp"], // passive/indirect: press the artery
      ["không còn hô hấp", "Đặt nạn nhân nằm ngửa"],
      ["người đi bộ đang sang đường", "Giảm tốc độ và nhường đường"],
      ["đường hai chiều", "Kiên nhẫn tuân thủ"],
      ["vũng nước", "chạy chậm qua vũng nước"],
      ["chủ phương tiện giao thông cơ giới", "Cả ba ý trên"],
      ["thường xuyên rèn luyện", "Cả hai ý trên"],
      ["thu được kết quả", "Được khách hàng, xã hội"],
      ["Những hành vi nào sau đây", "Luôn tuân thủ pháp luật"],
      ["gây ra tai nạn giao thông", "Cả ba ý trên"],
    ],

    // 58 questions. Keys are question prefixes; answers are option prefixes (matched by text, so
    // shuffled option order is fine). The 5 "bảng đồng hồ" (dashboard symbol) questions share one
    // text and differ only by their options, so their entries are ordered most-specific first and
    // the generic "Đang sử dụng" one is last.
    "Kỹ thuật lái xe": [
      ["Khi động cơ xe ô tô đã khởi động, bảng đồng h", "Áp suất dầu "],
      ["Khi động cơ xe ô tô đã khởi động, bảng đồng h", "Sắp hết nhiê"],
      ["Khi động cơ xe ô tô đã khởi động, bảng đồng h", "Cửa xe đóng "],
      ["Khi động cơ xe ô tô đã khởi động, bảng đồng h", "Lái xe và ng"],
      ["Khi động cơ xe ô tô đã khởi động, bảng đồng h", "Đang sử dụng"],
      ["Để bảo đảm an toàn khi tham gi", "Tăng ga từ từ, giảm ga th"],
      ["Khi lái xe ô tô điện xuống dốc", "Cả ba ý trên"],
      ["Khi điều khiển xe mô tô quay đ", "Cả ba ý trên"],
      ["Khi điều khiển xe tăng số, ngư", "Không được n"],
      ["Khi nhả phanh đỗ cơ khí điều k", "Dùng lực tay phải b"],
      ["Điều khiển xe ô tô trong khu v", "Cả hai ý trê"],
      ["Những thói quen nào dưới đây k", "Chỉ sử dụng "],
      ["Khi điều khiển xe mô tô tay ga", "Giữ tay ga ở"],
      ["Các biện pháp tiết kiệm nhiên ", "Cả hai ý trê"],
      ["Khi điều khiển ô tô xuống dốc ", "Về số thấp, "],
      [
        "Khi điều khiển xe sử dụng hộp ",
        "Vào số một (1) và từ từ cho hai bánh xe trước xuống rãnh",
      ],
      ["Khi lái xe ô tô qua đường sắt ", "Đúng."],
      [
        "Khi xuống dốc, muốn dừng xe, n",
        "Có tín hiệu rẽ phải, điều khiển xe sát vào lề đường bên p",
      ],
      ["Khi điều khiển xe ô tô tự đổ, ", "Ý 1 và ý 3."],
      ["Người ngồi trên xe ô tô cần th", "Quan sát phí"],
      [
        "Khi điều khiển xe trên đường v",
        "Quan sát cẩn thận các chướng ngại vật và báo hiệu bằng còi, đèn; g",
      ],
      ["Khi điều khiển xe ô tô có hộp số tự động ", "Về số thấp, "],
      ["Khi điều khiển xe ô tô có hộp số tự động,", "Không sử dụng chân t"],
      ["Khi điều khiển ô tô lên dốc ca", "Về số thấp t"],
      ["Khi vào số để khởi hành xe ô t", "Đạp bàn đạp p"],
      ["Khi điều khiển xe ô tô gặp mưa", "Bật đèn chiếu g"],
      ["Khi ngồi lái ô tô tư thế chân,", "Điều chỉnh g"],
      [
        "Khi điều khiển xe ô tô rẽ trái",
        "Cách chỗ rẽ một khoảng cách an toàn có tín hiệu rẽ trái;",
      ],
      ["Khi lái xe ô tô trên mặt đường", "Giảm tốc độ,"],
      ["Để tránh đổ, ngã khi điều khiể", "Cả ba ý trên"],
      ["Khi lùi xe, người lái xe phải ", "Quan sát bên trái,"],
      ["Khi tầm nhìn bị hạn chế bởi sư", "Giảm tốc độ,"],
      ["Trên đường đôi muốn vượt xe ké", "Cả ba ý trên"],
      ["Khi điều khiển xe giảm số, ngư", "Không được n"],
      [
        "Khi điều khiển xe ô tô rẽ phải",
        "Cách chỗ rẽ một khoảng cách an toàn có tín hiệu rẽ phải; g",
      ],
      ["Tay ga trên xe mô tô hai bánh ", "Ý 1 và ý 2."],
      [
        "Khi điều khiển xe ô tô ra khỏi",
        "Quan sát phía trước để tìm biển báo chỉ dẫn “lối ra đường cao tốc”, k",
      ],
      ["Khi điều khiển ô tô qua đường ", "Quan sát, ướ"],
      ["Khi điều khiển xe ô tô xuống đ", "Nhả bàn đạp ga, về số t"],
      [
        "Khi khởi hành ô tô sử dụng hộp",
        "Kiểm tra an toàn xung quanh xe ô tô; đ",
      ],
      ["Khi đi từ đường nhánh ra đường", "Quan sát, gi"],
      [
        "Khi điều khiển xe ô tô tới gần",
        "Chuyển từ đèn chiếu xa sang đèn chiếu gần; k",
      ],
      ["Để đạt được hiệu quả phanh cao", "Giảm hết ga,"],
      [
        "Khi quay đầu xe, người lái xe ",
        "Quan sát biển báo hiệu để biết nơi được phép quay đầu; quan sát kỹ địa hình nơi chọn để quay đầu; lựa chọn quỹ đạo quay đầu xe ",
      ],
      ["Khi điều khiển xe ô tô nhập và", "Quan sát, ph"],
      ["Điều khiển xe ô tô trong trời ", "Giảm tốc độ,"],
      [
        "Khi điều khiển xe ô tô trên đư",
        "Giữ vững tay lái cho xe đi đúng vệt bánh xe đi trước, sử dụng số thấp đi chậm, gà",
      ],
      ["Gương chiếu hậu của xe mô tô h", "Để quan sát an toàn phía s"],
      ["Khi đã đỗ xe ô tô sát lề đường", "Quan sát tìn"],
      ["Người lái xe được dừng xe, đỗ ", "Xe gặp sự cố"],
      ["Để giảm tốc độ khi ô tô đi xuố", "Về số thấp p"],
      ["Khi lái xe ô tô điện qua khu v", "Cả ba ý trên"],
      ["Khi đèn pha của xe đi ngược ch", "Giảm tốc độ,"],
      ["Trong các loại nhiên liệu dưới", "Xăng sinh họ"],
      ["Khi điều khiển xe qua đường sắ", "Cả hai ý trê"],
      ["Khi động cơ ô tô đã khởi động,", "Vị trí N hoặ"],
      ["Khi đang lái xe mô tô hoặc ô t", "Giảm tốc độ để d"],
      ["Khi điều khiển xe ô tô qua đườ", "Cả hai ý trê"],
    ],
  };

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const log = (...a) => console.log("[auto-practice]", ...a);
  const warn = (...a) => console.warn("[auto-practice]", ...a);

  const main = () => document.querySelector("main");
  const mainText = () => main()?.innerText ?? "";
  const buttons = () => [...document.querySelectorAll("button")];
  const findButton = (pred) => buttons().find((b) => pred(b.innerText.trim()));
  const findLink = (pred) =>
    [...document.querySelectorAll("a")].find((a) => pred(a.innerText.trim()));
  const options = () => [...document.querySelectorAll("input[type=radio]")];
  const optionText = (input) =>
    (input.closest("label")?.innerText ?? "").replace(/^\s*\d+-/, "").trim();

  /** Polls until fn() is truthy; returns its value, or null on timeout. */
  const waitFor = async (fn, timeout = TIMEOUT) => {
    for (let t = 0; t < timeout; t += DELAY.poll) {
      const v = fn();
      if (v) return v;
      await sleep(DELAY.poll);
    }
    return null;
  };

  const loadState = () => {
    try {
      return JSON.parse(sessionStorage.getItem(STATE_KEY) ?? "null");
    } catch {
      return null;
    }
  };
  const saveState = (s) =>
    s
      ? sessionStorage.setItem(STATE_KEY, JSON.stringify(s))
      : sessionStorage.removeItem(STATE_KEY);

  /** Question block text (between the "N. Câu hỏi" header and "Ask ai"). */
  const questionText = () => {
    const text = mainText();
    const start = text.search(/\d+\. Câu hỏi/);
    return text
      .slice(Math.max(start, 0))
      .split("Ask ai")[0]
      .replace(/\s+/g, " ");
  };

  /** "Câu hỏi : answered/total" → { answered, total }. */
  const counter = () => {
    const m = mainText().match(/Câu hỏi\s*:\s*(\d+)\s*\/\s*(\d+)/);
    return m ? { answered: +m[1], total: +m[2] } : { answered: 0, total: 25 };
  };

  /** Topic block on the list page: title text must be a key of BANKS and have a start button. */
  const findTopic = () => {
    for (const title of Object.keys(BANKS)) {
      const btn = findButton((t) => t.startsWith(START_PREFIX));
      if (!btn) return null;
      const block = btn.closest(".sand-p-10") ?? btn.parentElement;
      if (block?.innerText.includes(title)) return { title, btn };
    }
    return null;
  };

  /** Which topic's bank applies to the question on screen. */
  const topicOnPractice = (state) =>
    state.topic ?? Object.keys(BANKS).find((t) => mainText().includes(t));

  /** Picks the option index; falls back to a "Cả …" option, then the first. */
  const pickIndex = (bank, question, opts) => {
    for (const [q, a] of bank) {
      if (!question.includes(q)) continue;
      const idx = opts.findIndex((o) => optionText(o).includes(a));
      if (idx >= 0) return idx;
    }
    warn("unknown question, guessing:", question.slice(0, 120));
    const all = opts.findIndex((o) => optionText(o).startsWith("Cả"));
    return all >= 0 ? all : 0;
  };

  // ---------------------------------------------------------------------------
  // Steps
  // ---------------------------------------------------------------------------

  /** Answers every remaining question, then clicks finish. Returns true when finished. */
  const doPractice = async (state) => {
    const topic = topicOnPractice(state);
    const bank = BANKS[topic];
    if (!bank) return (warn("no bank for topic:", topic), false);

    const { total } = counter();
    for (let i = 0; i < total + 5; i++) {
      if (loadState()?.stop) return false;
      const opts = options();
      if (!opts.length) break; // no question on screen

      const question = questionText();
      const idx = pickIndex(bank, question, opts);
      (opts[idx].closest("label") ?? opts[idx]).click();
      await sleep(DELAY.feedback);

      const wrong = mainText().match(/Chưa chính xác[\s\S]*?\n(.*)\n/);
      if (wrong) warn("WRONG →", question.slice(0, 80), wrong[0]);

      const { answered, total: t } = counter();
      if (answered >= t) break; // last question answered

      const next = findButton((x) => x === "Tiếp");
      if (!next) break;
      next.click();
      await waitFor(() => questionText() !== question, 5000);
      await sleep(DELAY.next);
    }

    const finish = findButton((t) => t === FINISH_LABEL);
    if (!finish) return (warn("finish button not found"), false);
    finish.click();
    return true;
  };

  /** After finishing: "Kết quả học tập" link → "Ôn luyện" link (reloads the topic list). */
  const reloadPracticePage = async () => {
    // Navigating right after "Kết thúc luyện thi" races the site's finish handling and leaves
    // "Ôn luyện" blank, so let the finish settle first.
    await waitFor(() => !findButton((t) => t === FINISH_LABEL), 5000);
    await sleep(SETTLE_MS);

    for (let attempt = 1; attempt <= 3; attempt++) {
      const results = await waitFor(() =>
        findLink((t) => t === "Kết quả học tập"),
      );
      if (!results) return (warn("link 'Kết quả học tập' not found"), false);
      results.click();
      await waitFor(() => location.pathname.includes("/last-screen/"), 5000);
      await sleep(DELAY.next * 2);

      const practice = await waitFor(() =>
        findLink((t) => t.includes("Ôn luyện")),
      );
      if (!practice) return (warn("link 'Ôn luyện' not found"), false);
      practice.click();

      // Verify the topic list really rendered; otherwise retry the round trip.
      if (await waitFor(findTopic, 6000)) return true;
      warn(`'Ôn luyện' did not render (attempt ${attempt}/3), retrying`);
    }
    return false;
  };

  /** One state-machine pass: decides what the current screen needs. Returns false to stop. */
  const tick = async (state) => {
    if (state.remaining <= 0) return false;

    // 1) Practice in progress → answer + finish → count the run → reload via results.
    if (options().length) {
      if (!(await doPractice(state))) return false;
      state.remaining -= 1;
      state.topic = null;
      saveState(state);
      log(`run finished, remaining: ${state.remaining}`);
      return reloadPracticePage();
    }

    // 2) Topic list → start practice for the topic that has a bank.
    const topic = await waitFor(findTopic, 4000);
    if (topic) {
      state.topic = topic.title;
      saveState(state);
      topic.btn.click();
      await waitFor(() => options().length);
      return true;
    }

    // 3) Somewhere else (e.g. results page) → go back to the "Ôn luyện" list.
    const practice = findLink((t) => t.includes("Ôn luyện"));
    if (!practice) return (warn("don't know where I am; stopping"), false);
    practice.click();
    await sleep(DELAY.next * 2);
    return true;
  };

  const run = async () => {
    try {
      for (let guard = 0; guard < 500; guard++) {
        const state = loadState();
        if (!state || state.stop) break;
        if (!(await tick(state))) break;
        await sleep(DELAY.next);
      }
    } catch (err) {
      console.error("[auto-practice] failed:", err);
    } finally {
      const s = loadState();
      if (!s || s.stop || s.remaining <= 0) saveState(null);
      log("stopped");
    }
  };

  // ---------------------------------------------------------------------------
  // Entry points
  // ---------------------------------------------------------------------------
  let running = false;
  const guardedRun = async () => {
    if (running) return;
    running = true;
    await run();
    running = false;
  };

  // Ctrl+Q: start (asks how many runs) — or stop if already running.
  window.addEventListener("keydown", (e) => {
    if (!(
      e.ctrlKey &&
      !e.altKey &&
      !e.metaKey &&
      e.code === "KeyQ" &&
      !e.repeat
    ))
      return;
    e.preventDefault();

    if (running) {
      saveState({ ...(loadState() ?? { remaining: 0 }), stop: true });
      return log("stop requested");
    }
    const answer = prompt("Số lần luyện (how many runs)?", "1");
    const n = parseInt(answer ?? "", 10);
    if (!Number.isInteger(n) || n <= 0) return;
    saveState({ remaining: n, topic: null });
    guardedRun();
  });

  // Resume automatically if a full page reload happened mid-run.
  const pending = loadState();
  if (pending && !pending.stop && pending.remaining > 0) guardedRun();
})();
