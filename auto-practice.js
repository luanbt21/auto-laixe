// ==UserScript==
// @name         auto-practice
// @namespace    http://tampermonkey.net/
// @version      2026-11-18.2
// @description  Auto-complete "Ôn luyện" practice per topic, repeat N times (Ctrl+Q to start / stop)
// @author       luanbt21
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

    // 37 questions, ordered longest key first. Several questions (dashboard symbols, device
    // pictures) share the same text and differ only by their options, so an entry may carry a
    // 3rd element: a snippet that must also appear on screen (an option unique to that question).
    "Cấu tạo và sửa chữa xe": [
      [
        "Khi động cơ ô tô đã khởi động, bảng đồng hồ xuất hiện ký hiệu như hình vẽ dưới đây ",
        "Hệ thống lái",
      ],
      [
        "Trên xe ô tô có trang bị thiết bị như hình vẽ dưới đây ",
        "Dùng để kích",
      ],
      [
        "Khi động cơ ô tô đã khởi động, bảng đồng hồ x",
        "Áp suất lốp ",
        "Báo hiệu thiếu dầu phanh.",
      ],
      ["Khi động cơ ô tô đã khởi động, bảng đồng hồ x", "Nhiệt độ nướ"],
      [
        "Trên xe ô tô có trang bị thiết bị như hình vẽ",
        "Phá cửa kính",
        "Chữa cháy.",
      ],
      ["Khi động cơ ô tô đã khởi động, bảng đồng hồ x", "Cần kiểm tra"],
      [
        "Trên xe ô tô có trang bị thiết bị như hình vẽ",
        "Chữa cháy tr",
        "Chữa cháy trong các trường h",
      ],
      ["Khi động cơ ô tô đã khởi động, bảng đồng hồ x", "Báo hiệu hệ "],
      ["Niên hạn sử dụng của xe ô tô t", "25 năm."],
      ["Xe ô tô tham gia giao thông đư", "Cả hai ý trê"],
      ["Đèn phanh trên xe mô tô có tác", "Cả hai ý trê"],
      ["Niên hạn sử dụng của xe ô tô c", "20 năm."],
      ["Bánh xe, lốp lắp cho xe ô tô p", "Cả hai ý trê"],
      ["Túi khí được trang bị trên xe ", "Ý 2 và ý 3."],
      ["Mục đích của bảo dưỡng thường ", "Cả hai ý trê"],
      ["Ắc quy được trang bị trên xe ô", "Để tích trữ "],
      ["Dây đai an toàn được trang bị ", "Giữ chặt ngư"],
      [
        "Trong các nguyên nhân nêu dưới",
        "Hết nhiên liệu, lõi lọc nhiên liệu bị tắc, lọc khí bị tắc, nhiên liệu lẫn không khí, t",
      ],
      ["Kính chắn gió của xe ô tô phải", "Là loại kính a"],
      ["Công dụng của hệ thống bôi trơ", "Cung cấp một lượng d"],
      ["Khi khởi động xe ô tô số tự độ", "Phải đạp hết"],
      ["Hãy nêu công dụng ly hợp (côn)", "Dùng để truyền h"],
      ["Hãy nêu công dụng hệ thống tru", "Dùng để truy"],
      ["Nút bấm biểu tượng như hình vẽ", "Báo hiệu xe "],
      ["Hãy nêu công dụng của động cơ ", "Khi làm việc, n"],
      ["Xe mô tô và xe ô tô tham gia g", "Bắt buộc."],
      ["Khi động cơ đã hoạt động, bảng", "Báo hiệu chế"],
      ["Hãy nêu công dụng hộp số của x", "Truyền và thay đổi mô men t"],
      ["Hãy nêu công dụng hệ thống lái", "Dùng để thay đổi h"],
      ["Máy phát điện được trang bị tr", "Để phát điện"],
      ["Hãy nêu công dụng hệ thống pha", "Dùng để giảm"],
      ["Phương pháp kiểm tra mức dầu b", "Rút que thăm dầu trên các-te,"],
      ["Xe ô tô tham gia giao thông tr", "Ý 1 và ý 2."],
      ["Hệ thống lái trên xe ô tô phải", "Cả hai ý trê"],
      [
        "Dây đai an toàn lắp trên xe ô ",
        "Đủ số lượng, lắp đặt chắc chắn không bị rách, đứt, khóa cài đóng, mở nhẹ nhàng, không tự mở, không bị kẹt; kéo ra thu vào dễ dàng, cơ cấu hãm g",
      ],
      ["Ống xả lắp trên xe ô tô phải b", "Cả hai ý trê"],
      [
        "Thế nào là động cơ 4 kỳ?",
        "Là loại động cơ: để hoàn thành một chu trình công tác của động cơ, pít tông thực hiện 4",
      ],
    ],
  };

  /**
   * Compact banks for big topics: "<question hash><answer hash>" pairs (8+8 hex chars).
   * Question hash = fnv1a(stem + '||' + sorted options joined by '||'); answer hash = fnv1a(correct option text).
   * Hashing the options too makes same-text (picture) questions unambiguous and shuffle-proof.
   */
  const HASH_BANKS = {
    "Khái niệm và quy tắc giao thông đường bố": [
      // 180 questions (title typo is the site's)
      "42498577de1de026 5505753894ac000e 5897148225892443 69622099e39d6ff5 68e4512b2dd4d84f 3e7071bfb9f56caf 792cb92672fba50f 4fcf8a3bee476b83 5b15b7dbcb1cb498 f1517c5d25892443 6ac59f3789b4db6a 34177a6f860e0cba cc1b057f25892443 81c11a54fe4ae402 002ffec876d85bd4 7bafff3ebb8fad6b d24e9b63a864c099 8fde8139c7782f2c 9c8ee489603bfd01 2fd815af25233092 72373d5f763e140f bfcc79f2da1cfae3 fecafee682605a6f 64b6a5bae30e1839 7d3559de7db75362 dc8f423f1383c034 716330d6db4a3e1b 78f0ba2da676cd75 e48284316990dcd0 8254983d0fb5223e 6fc5c309da827bd9 fd5fdc8b8704bc42 8f28ef41f1d76846 219fc8a825892443 8d9962ac91394ba2 332aea30cef4f6e0 7ea99dea25233092 b3a316b707094933 46d827c2bca84d3c 4eb7a081256e5bb6 17b706abf5050798 b5b7247d64081e81 ada0e36725892443 0f53f24d25233092 308e385982605a6f 8a0067de39f5fa4f 281d97bc60a04318 0646cb7925233092 416ac80184132b5d ed8fd0c20b3fd9e2 a4111f5e662963e4 bd48ba2ffebd134d 590ed66b2ed3f2f2 697e6d471bef44cc 3d9513f38b898c60",
      "5748f945f39d3aa5 ba23797025233092 35827f0f24b03a8f dd43bd25ed9e3b94 88a8c8d0e10179e0 04e3c3ca0386a5cc 3f088007ee968efc 1ecbf53b1ea15aef cf378df625233092 b1c285571663c1ac 902106df19b38beb d0a1a2d26606539a bb31120a1c30c70c 70f57999517ed018 13a2f507b2f5c0d5 b00d7013fc249a31 7c4aadc3e7c2348a 236bb82b25233092 06b36aa025892443 2abbb71b25233092 c43dde2025892443 99189ceac243ead8 de53296825233092 661367b675d40f78 656341b24d584adf e1927f249004da67 5bc2cf9483e2fc1f ce53e59ed11f145b 1d9b59d225892443 52fad4bfd17d2dd8 15b8f0f3e05ad249 edb1982725892443 f5d12afe5f7b88a8 60e0fb22603bfd01 717757f625233092 a669925f6a417e8e 28f059f6731e9910 f1a02f94153e8836 4b1297a933d20dbf a01d051cfa4769bc 66f31a61efbd7793 5de3d29197661e5a 84a1a9c7fe852d15 c7afdc6f6a8a5136 1047d7d2453887e1 232653d34080a751 7003b89fbf826d0e 6567e21cb0e7fbab 18fd5c7a0751d3ca 05bc8b5f1e805fda e56e7bfd0af88fb7 12eab8440c29ba59 473b54df25233092 3abdc49ada1cfae3 6a9c88b17dd095c0",
      "6ba101e125892443 f05bebcad32e2507 95536e13231402b5 a397126324c1f78e 96056ee75c7eff9d 28b307a28b3f40c9 da7f50dc4c95aa8f 67d1c651cb1cb498 f5be8e95b6322dad 91fc09766a8a5136 d7f98e96fe49ddad caad88115c69b55c 00f081ae25233092 c3e518b225233092 a488cb4f25892443 22a8cda725233092 ab3c825bcaa5642d 793e5f1f25233092 3bdd18e125233092 173c1ac82aafbc4c edfc2fcd603bfd01 f9659e8314a4af8c 9472eafc5854990c 36954c6925233092 bdb2bb2225233092 ef2a62fe4da36031 98bf4914e962250a 01039da7810346ba 688e0fe167e35c8f 7dfae38028ec7160 b86d33b9b48e4469 118ab6fa92b209a7 9ae023ed43485329 62c5e02025892443 79cbec4225892443 17955ef5675f8eff 71cbb32eecf26970 7bf3744126da5a1c 35f2ac7c64081e81 6f8c4b727e43cb5a 58344d48ccf98c9a 8472f0cb9f16125e 85b2b63970833712 eabbace54698033b 4c2e554b727d54c3 d5e60ca96df9edb7 e0b62179ca97a429 63c27c23ccf98c9a 99caf9cea97d4e3d 06cb7b229b3add13 30917faafe4ae402 2e3bce2dfcaedb34 4da945e398ff6dbe 362da59d5fe798b0 b0e47b8c25892443",
      "94126b5825233092 0d736ab899b12c3f 64b4c2908d363f1b d52cc4ec25892443 a0f71934cb1cb498 04cf8e061663c1ac dd5852ea25233092 ff1c956225892443 9dd320a9bbbce620 495d282da30efbd6 99e268b7e704409a 61d9ebc717bb8b05 621d849d25892443 cc87178ee05ad249 8913f7382de16d2f",
    ].join(" "),
  };

  /** Every topic that has a bank of either kind. */
  const TOPIC_TITLES = [
    ...new Set([...Object.keys(BANKS), ...Object.keys(HASH_BANKS)]),
  ];

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
    for (const title of TOPIC_TITLES) {
      const btn = findButton((t) => t.startsWith(START_PREFIX));
      if (!btn) return null;
      const block = btn.closest(".sand-p-10") ?? btn.parentElement;
      if (block?.innerText.includes(title)) return { title, btn };
    }
    return null;
  };

  /** Which topic's bank applies to the question on screen. */
  const topicOnPractice = (state) =>
    state.topic ?? TOPIC_TITLES.find((t) => mainText().includes(t));

  /** 32-bit FNV-1a as 8 hex chars (must match the function used to build HASH_BANKS). */
  const fnv = (s) => {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, "0");
  };
  const norm = (s) => s.replace(/\s+/g, " ").trim();

  /** Parses a HASH_BANKS string into Map(questionHash → answerHash). */
  const parseHashBank = (str) =>
    new Map(str ? str.split(" ").map((p) => [p.slice(0, 8), p.slice(8)]) : []);

  /** Hash of the question on screen: its stem plus its (order-independent) options. */
  const questionHash = (opts) => {
    const text = mainText();
    const block = text
      .slice(Math.max(text.search(/\d+\. Câu hỏi/), 0))
      .split("Ask ai")[0];
    const stem = norm((block.split("Góp ý\n")[1] ?? "").split(/\n1-/)[0]);
    const texts = opts.map((o) => norm(optionText(o)));
    return fnv(`${stem}||${[...texts].sort().join("||")}`);
  };

  /** Picks the option index; falls back to a "Cả …" option, then the first. */
  const pickIndex = (bank, hashBank, question, opts) => {
    const answerHash = hashBank.get(questionHash(opts));
    if (answerHash) {
      const idx = opts.findIndex(
        (o) => fnv(norm(optionText(o))) === answerHash,
      );
      if (idx >= 0) return idx;
    }
    for (const [q, a, ctx] of bank) {
      if (!question.includes(q)) continue;
      if (ctx && !question.includes(ctx)) continue; // disambiguates same-text questions
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
    const bank = BANKS[topic] ?? [];
    const hashBank = parseHashBank(HASH_BANKS[topic]);
    if (!bank.length && !hashBank.size)
      return (warn("no bank for topic:", topic), false);

    const { total } = counter();
    for (let i = 0; i < total + 5; i++) {
      if (loadState()?.stop) return false;
      const opts = options();
      if (!opts.length) break; // no question on screen

      const question = questionText();
      const idx = pickIndex(bank, hashBank, question, opts);
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
