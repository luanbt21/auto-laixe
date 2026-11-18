// ==UserScript==
// @name         auto-practice
// @namespace    http://tampermonkey.net/
// @version      2026-11-18
// @description  try to take over the world!
// @author       You
// @match        https://laixebacha.huelms.com/learn/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=tampermonkey.net
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";

  let running = false; // guards against overlapping runs

  // Hotkey: Ctrl+Q (uses e.code so it works regardless of layout / macOS Option remapping)
  window.addEventListener("keydown", async (e) => {
    if (e.ctrlKey && !e.altKey && !e.metaKey && e.code === "KeyQ" && !e.repeat) {
      e.preventDefault();
      if (running) return;
      running = true;
      try {
      const DELAY = { feedback: 1000, next: 500 }; // ms, raise if the site is slow
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

      // [substring identifying the question, substring identifying the correct option]
      // Order matters: the first entry that matches the question AND whose answer is present wins.
      const BANK = [
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
      ];

      const main = () => document.querySelector("main");
      const buttons = () => [...document.querySelectorAll("button")];
      const findButton = (label) =>
        buttons().find((b) => b.innerText.trim() === label);
      const options = () => [...document.querySelectorAll("input[type=radio]")];
      const optionText = (input) =>
        (input.closest("label")?.innerText ?? "")
          .replace(/^\s*\d+-/, "")
          .trim();

      /** Returns the question block text (between the "N. Câu hỏi" header and "Ask ai"). */
      const questionText = () => {
        const text = main()?.innerText ?? "";
        const start = text.search(/\d+\. Câu hỏi/);
        return text.slice(Math.max(start, 0)).split("Ask ai")[0];
      };

      /** Waits (up to timeoutMs) until the question block differs from `prev`. */
      const waitForNewQuestion = async (prev, timeoutMs = 5000) => {
        for (let t = 0; t < timeoutMs; t += 200) {
          await sleep(200);
          if (questionText() !== prev) return;
        }
      };

      /** Reads "Câu hỏi : answered/total" → { answered, total }. */
      const counter = () => {
        const m = (main()?.innerText ?? "").match(
          /Câu hỏi\s*:\s*(\d+)\s*\/\s*(\d+)/,
        );
        return m
          ? { answered: +m[1], total: +m[2] }
          : { answered: 0, total: 25 };
      };

      /** Picks the index of the option to click; falls back to a "Cả …" option, then the first. */
      const pickIndex = (question, opts) => {
        for (const [q, a] of BANK) {
          if (!question.includes(q)) continue;
          const idx = opts.findIndex((o) => optionText(o).includes(a));
          if (idx >= 0) return idx;
        }
        console.warn(
          "[auto-practice] unknown question, guessing:",
          question.slice(0, 120),
        );
        const all = opts.findIndex((o) => optionText(o).startsWith("Cả"));
        return all >= 0 ? all : 0;
      };

      const { total } = counter();
      for (let i = 0; i < total + 5; i++) {
        try {
          const opts = options();
          if (!opts.length) break; // no question on screen → done

          const question = questionText();
          const idx = pickIndex(question, opts);
          (opts[idx].closest("label") ?? opts[idx]).click();
          await sleep(DELAY.feedback);

          // Log the site's own verdict so wrong guesses can be added to BANK.
          const verdict = main().innerText.match(
            /Chưa chính xác[\s\S]*?\n(.*)\n/,
          );
          if (verdict)
            console.warn(
              "[auto-practice] WRONG →",
              question.slice(0, 80),
              verdict[0],
            );

          const { answered, total: t } = counter();
          if (answered >= t) break; // last question answered

          const next = findButton("Tiếp");
          if (!next) break;
          const before = questionText();
          next.click();
          await waitForNewQuestion(before);
          await sleep(DELAY.next);
        } catch (err) {
          console.error("[auto-practice] step failed:", err);
          return;
        }
      }

      const finish = findButton("Kết thúc luyện thi");
      if (!finish)
        return console.warn("[auto-practice] finish button not found");
      finish.click();
      console.log("[auto-practice] done");
      } finally {
        running = false;
      }
    }
  });
})();
