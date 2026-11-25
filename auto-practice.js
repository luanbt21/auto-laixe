// ==UserScript==
// @name         auto-practice
// @namespace    http://tampermonkey.net/
// @version      2026-11-26
// @description  Auto-complete "Ôn luyện" practice per topic, repeat N times, with an on-screen progress/ETA box and auto-stop at the daily study-time cap (Ctrl+Q to start / stop)
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
  const STATUS_KEY = "autoPracticeStatus"; // sessionStorage: last end message shown by the box
  const HUD_REFRESH_MS = 1000; // how often the on-screen box redraws

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
   * Question hash = fnv1a(stem + '||' + sorted options joined by '||' [+ '||IMG:' + picture paths]); answer hash = fnv1a(correct option text).
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

    "Hệ thống biển báo hiệu đường bộ": [
      // 185 questions (many with sign pictures)
      "506972730e7fd32b 759335947e881037 96330391be0d4f05 975858079c8a7e08 7bb043b69c8a7e08 e7d985b680f8fb1c d5b467dbd7882c05 d755219a7e881037 8deda15980f22f4f d0a2d7209c8a7e08 2350a2ee7e881037 b02bed7b624c8418 01694a26624c8418 ab061b9c9c8a7e08 a1fbbb8e9c8600da 71d282f57e881037 005656099c8a7e08 26f05e1b006db41a 14b896369c8a7e08 b3b043a0d536377e f600dce07e881037 a1ed74537e881037 18c021339c8a7e08 8bb505d16413a184 7a27d390624c8418 c10293397e881037 fca17ed57e881037 1fecbf6b375c8f93 d6ac56397e881037 e3d41f489c8a7e08 ec7c35e20e7fd32b c09cbd39624c8418 4bec27b997d6b41a cc20a31d7e881037 c2004f457e881037 259868b69c8a7e08 a37749467e881037 0abeb78197d6b41a 859fa1a6ba82dcd5 3c7fce779c8a7e08 a7c3f6a89c8600da be8faa17ed1f28b5 5cbd7172603bfd01 1bf4bab9a2bcec68 6e47b8b87e881037 a23528ad9db11680 6a1b14413195dd87 9305ba2f97d6b41a 617ebb107e881037 220e7a537e881037 a251b751ef74e733 c7a422c558ea302c 7806032d9dea5196 fb956c2e844ef835 445bbba9016709b4",
      "10d3f1212c826d8e f44a4ce90e7fd32b 9da9386f624c8418 2156fa2a624c8418 a054bb54b431185a 18af48e9844ef835 3b9f79077e881037 3fa0e3df9c8a7e08 b10833adb6a7393b e17298d4844ef835 9cff8df6624c8418 c74619acb5140c91 691f62f27e881037 c3dc806e70ae633b af28ff027e881037 ce7a16db7e881037 c77aec999c8600da f6e8c91dfbdcd03c 0c6d6fc97e881037 6d10ca8597d6b41a 6c2b3c587e881037 65e361e47e881037 d9598a2d0e7fd32b 9d3cf2019c8600da 8335396a7e881037 ebe93c5797d6b41a b9680ce69c8600da c76819f47e881037 04918830c22920d1 7bbf84319c8600da b5fb19419c8a7e08 76415dbd7e881037 fc69566c9c8a7e08 6d8ea6e83195dd87 c92e40dd624c8418 ed1419c3624c8418 23f4b46d7e881037 c9c8eef19c8a7e08 656aa43f844ef835 19e2b00d9c8600da bb74c3912c80d332 c0dbc6287e881037 39cf4f949c8a7e08 c99e5fd3e2f107f6 d5d319b89c8600da 7a09a402603bfd01 830ec42d844ef835 8f6cd9427e881037 95d7cfc7624c8418 35c0c60c5eb1e066 f4b61e6c603bfd01 183a18afca5204cc dd525cff9c8a7e08 dfebc2fdff4e2a60 875bcf6997d6b41a",
      "69c5f2aa603bfd01 c35b4f46991a73a0 4129725f9c8600da d7fe553c844ef835 2ede3ef055dade44 f29e9e897e881037 3500867c9d067a68 5e724cedb48e4469 81a8a9db988068b8 b28f3b4f7e881037 3fa44a632407a41b 8fae0e389c8a7e08 3946b30d9c8600da ee3ea53a9c8a7e08 04812f99603bfd01 1aa5ef729c8a7e08 a9823213de76665a a870971e3fa48510 0b486a6600044612 b36660717e881037 7b28863e9c8600da 29045bc67e881037 e1bbd1f49c8a7e08 d4853b0ce0271174 3627a65c8ab80245 61d1cd067e881037 027e2ed50e81e642 4b4e738b3289e8d6 a0d2d6d47e881037 f80f04709c8a7e08 d7ea60429c8600da 651589e9624c8418 0a2c4fca0e7fd32b 8a2ff2995840cce9 d8bcf6729c8a7e08 6d6acb6a603bfd01 bdf426487e881037 60b6af7d7e881037 6ec540f99c8a7e08 b896ab510e7fd32b 50ccc0ac7e881037 32eb9cb49c8600da fa9045e29c8600da f28e2440624c8418 efe899877e881037 817a42fc5fa52fb4 6a7032057e881037 a3e7bdf799e7135d e88bd7299c8a7e08 422e50ca7e881037 7651ad0b9c8600da 6111465fc22920d1 91a43a471dba2e1f 7b44fd6b4e8e71f1 4843abbb624c8418",
      "b503b330b98fd7bd e05ea1ea0e7fd32b 8f27c9fd514c89c8 11cdc95a97d6b41a a707f5290e7fd32b a52337037e881037 0ad653d29c8a7e08 b8fc158c97d6b41a 3068bdd49c8a7e08 1e8d57c57e881037 1c63e5c5844ef835 70a0ff9338511993 d5705ed69c0b1696 d604d3899c8a7e08 ef0f5a7e9c8600da 6a9bf1397e881037 8fd78f4f9c8a7e08 6c3159aa59b5eb81 8e1e445f7e881037 309ee5b39c8a7e08",
    ].join(" "),

    "Giải các thế sa hình": [
      // 115 questions (all picture questions)
      "23361570e5c82c8b 35435817c09a8929 48390165ec51595c 65403645c369e79f 78051950c639d74a 813453216c36a086 999517793e2d6de2 ba22a8adf3ce1aea c3d094af74ad1e42 9500267c71c23b5f c60d7b100a88c520 159cf32d3d90cb54 d507c2e461b973ef 6b477e88243ed9e8 255d067b99f432d0 98d620a1900bf9dc 9ef76900340029c3 a402bfeb2b50054e 9147037f2fb0cfad 92a03aae6c55483f e9715d4e2e7d51ba f8d9372c084d54f5 1f4c4a81f6e21542 4f1806c4ca5e82b2 505eb2d91d0e237d 14837ba833947df3 7629d94199f432d0 4672558af81b859b 6a1cb1f53cae2436 0fb8a6cdee1b8910 d26f7bb3ca5e82b2 ec6ed4c5c89217a2 b613def0bf87d893 6425c2bcea89c968 ba79720ffcf80ba6 51c7b13aea89c968 ed37692437807574 bba5775937807574 89be955d26e35ba7 173fe7caee1b8910 f829e134ca5e82b2 1174bbe19db3ce6f e24247d52913e402 ad9ab38f28616e3e 5a72cd0e5a1272a7 8c93c5e56c55483f a34ee644062f2c3a 97531fe542542fa3 fb60b9810f36c35f e6a6a7aef4aaa388 814a068ec20e83a0 26acd784f6e21542 adc641991d0e237d deca2135ea89c968 825a86499fe0b93b",
      "2bbbd4917e41d693 0bccb00fca97a429 ae3a0f517105d360 deac48a20922bc2c 1357c3c22c1f73f4 dd9f97e38da73fa6 7f0fb4983cae2436 cd3e41ce33947df3 ed07daf4f1ca6c03 200c5c37c1db0a5d a92b120a5b71f0ff 8c3bd20199f432d0 fe39a5f32ed23d70 58d94c801bbfcdbc 178ed6a2c20e83a0 f5764edaf3d29818 7510a3715db07dc1 ab3adb7e3d90cb54 a3d433477dc2a699 1b31304864631ae5 91298cd240df38d8 5110f2b3a407ae40 6a339be935255353 11589ee9c32a4bad a623154ed69953fb 8c71c0028da73fa6 381d3b0bc527f16a 0dc5a3fb99f432d0 53eb2badee1b8910 6ecdcf6b039d26cb fec45772ca97a429 d76a6106885e38cb cdc56e13ee1b8910 5b912153d0a51f3e 679a42b22f634d4d 1e34b6222dc88fdf 8a98667d8f8f9f1a 0e229885039e6855 e7013145c2cd182c fce0ce08ee1b8910 0d0cc2b2dcf01a33 177866f25f3f0ae3 f3ffc77ea43cc0f9 f5001fa661b973ef 1642f9dd4b296121 6befe970ee1b8910 94abe66199f432d0 78a9e4ce4868ca7a af8feb4ec79cf770 2b77af5799f432d0 f6df6d51cb1cb498 6330450fc0c32dc1 ca11686337807574 e4274f66ea89c968 00634eec99f432d0",
      "bb3293151fe87e88 8d88614c9f626115 dcd6b1cec3982fbd 613aa550bf87d893 bd507e3cc32a4bad",
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
  let lastWarning = null;
  const warn = (...a) => {
    lastWarning = a.filter((x) => typeof x === "string").join(" ");
    console.warn("[auto-practice]", ...a);
  };

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

  /** "Thời gian đã học hôm nay 12/12 giờ" → { used, limit } (null if not on screen). */
  const studyTime = () => {
    const m = document.body.innerText.match(
      /Thời gian đã học hôm nay\s*([\d.,]+)\s*\/\s*([\d.,]+)/,
    );
    if (!m) return null;
    const num = (x) => parseFloat(x.replace(",", "."));
    return { used: num(m[1]), limit: num(m[2]) };
  };

  /** Returns "used/limit" text when the daily study-time cap is reached, else null. */
  const capReached = () => {
    const t = studyTime();
    if (t && t.limit > 0 && t.used >= t.limit)
      return `${t.used}/${t.limit} giờ`;
    // The site also pops a dialog once the cap is hit.
    return /Bạn đã học đủ thời gian tối đa/.test(document.body.innerText)
      ? "đủ giờ tối đa"
      : null;
  };

  /** Fraction (0..1) of the question screen answered, or 0 when no question is shown. */
  const runProgress = () => {
    const m = mainText().match(/Câu hỏi\s*:\s*(\d+)\s*\/\s*(\d+)/);
    return m && +m[2] > 0 ? +m[1] / +m[2] : 0;
  };

  const fmtDuration = (ms) => {
    const s = Math.max(0, Math.round(ms / 1000));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h
      ? `${h}h${String(m).padStart(2, "0")}m`
      : m
        ? `${m}m${String(s % 60).padStart(2, "0")}s`
        : `${s}s`;
  };
  const fmtClock = (ts) =>
    new Date(ts).toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });

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

  /** Paths of the question's pictures (sign images), so same-text picture questions differ. */
  const questionImages = () =>
    [...document.querySelectorAll("main img")]
      .filter((img) => img.naturalWidth > 60)
      .map((img) => {
        try {
          return new URL(img.src).pathname;
        } catch {
          return img.src;
        }
      })
      .sort();

  /** Hash of the question on screen: its stem plus its (order-independent) options. */
  const questionHash = (opts) => {
    const text = mainText();
    const block = text
      .slice(Math.max(text.search(/\d+\. Câu hỏi/), 0))
      .split("Ask ai")[0];
    const stem = norm((block.split("Góp ý\n")[1] ?? "").split(/\n1-/)[0]);
    const texts = opts.map((o) => norm(optionText(o)));
    const base = `${stem}||${[...texts].sort().join("||")}`;
    const imgs = questionImages();
    return fnv(imgs.length ? `${base}||IMG:${imgs.join(",")}` : base);
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
      if (loadState()?.stop || capReached()) return false;
      const opts = options();
      if (!opts.length) break; // no question on screen

      // Picture questions are hashed with their images, so wait until they have loaded.
      await waitFor(
        () =>
          [...document.querySelectorAll("main img")].every((i) => i.complete),
        3000,
      );
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
      const now = Date.now();
      state.remaining -= 1;
      state.topic = null;
      (state.durations ??= []).push(now - (state.runStartedAt ?? now));
      state.runStartedAt = now;
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

  const setStatus = (msg) =>
    msg
      ? sessionStorage.setItem(STATUS_KEY, msg)
      : sessionStorage.removeItem(STATUS_KEY);

  /** Why the loop should end right now (null = keep going). Checked before every step. */
  const stopReason = (state) => {
    if (!state) return "Đã kết thúc";
    if (state.stop) return "Đã dừng thủ công";
    const cap = capReached();
    if (cap) return `Tự dừng: đã học đủ ${cap} hôm nay`;
    if (state.remaining <= 0)
      return `Hoàn tất ${state.total ?? ""} lần luyện`.replace("  ", " ");
    return null;
  };

  const run = async () => {
    let endMsg = "Đã dừng";
    try {
      setStatus(null);
      for (let guard = 0; guard < 500; guard++) {
        const state = loadState();
        const reason = stopReason(state);
        if (reason) {
          endMsg = reason;
          break;
        }
        lastWarning = null;
        if (!(await tick(state))) {
          endMsg =
            stopReason(loadState()) ??
            `Dừng: ${lastWarning ?? "không rõ vị trí / lỗi"}`;
          break;
        }
        await sleep(DELAY.next);
      }
    } catch (err) {
      endMsg = "Lỗi: " + (err?.message ?? err);
      console.error("[auto-practice] failed:", err);
    } finally {
      saveState(null);
      setStatus(endMsg);
      log("stopped —", endMsg);
    }
  };

  // ---------------------------------------------------------------------------
  // On-screen box: runs left, ETA, today's study time
  // ---------------------------------------------------------------------------
  const hud = (() => {
    const el = document.createElement("div");
    el.id = "auto-practice-hud";
    el.style.cssText = [
      "position:fixed",
      "right:12px",
      "bottom:12px",
      "z-index:2147483647",
      "min-width:210px",
      "max-width:280px",
      "padding:10px 12px",
      "border-radius:8px",
      "background:rgba(20,22,26,.92)",
      "color:#e8eaed",
      "border:1px solid #3c4043",
      "font:12px/1.5 ui-monospace,Menlo,Consolas,monospace",
      "box-shadow:0 4px 14px rgba(0,0,0,.4)",
      "pointer-events:none",
      "white-space:pre-line",
    ].join(";");
    document.documentElement.appendChild(el);
    return el;
  })();

  /** Estimated ms until all runs are done, or null while there is no data yet. */
  const estimateMs = (state) => {
    const done = state.durations ?? [];
    const frac = runProgress();
    let perRun = done.length
      ? done.reduce((a, b) => a + b, 0) / done.length
      : null;
    // Before the first run completes, extrapolate from the current run's progress.
    if (perRun === null && frac >= 0.1 && state.runStartedAt) {
      perRun = (Date.now() - state.runStartedAt) / frac;
    }
    return perRun === null
      ? null
      : perRun * Math.max(state.remaining - frac, 0);
  };

  const renderHud = () => {
    const state = loadState();
    const t = studyTime();
    const study = t ? `Hôm nay: ${t.used}/${t.limit} giờ` : "";
    let text;
    if (!state) {
      const msg = sessionStorage.getItem(STATUS_KEY);
      text = [`auto-practice · ${msg ?? "sẵn sàng (Ctrl+Q để bắt đầu)"}`, study]
        .filter(Boolean)
        .join("\n");
    } else {
      const total = state.total ?? state.remaining;
      const eta = estimateMs(state);
      text = [
        `auto-practice · đang chạy (Ctrl+Q: dừng)`,
        `Còn lại: ${state.remaining}/${total} lần  (đã xong ${total - state.remaining})`,
        eta === null
          ? "Ước tính xong: đang tính…"
          : `Ước tính xong: ${fmtClock(Date.now() + eta)}  (~${fmtDuration(eta)})`,
        study,
      ]
        .filter(Boolean)
        .join("\n");
    }
    if (hud.textContent !== text) hud.textContent = text;
  };
  setInterval(renderHud, HUD_REFRESH_MS);
  renderHud();

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
    const now = Date.now();
    saveState({
      total: n,
      remaining: n,
      topic: null,
      durations: [],
      runStartedAt: now,
    });
    guardedRun();
  });

  // Resume automatically if a full page reload happened mid-run.
  const pending = loadState();
  if (pending && !pending.stop && pending.remaining > 0) guardedRun();
})();
