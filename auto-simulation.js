// ==UserScript==
// @name         Auto simulation practice (hazard videos)
// @match        https://laixebacha.huelms.com/learn/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==
// Ctrl+M: run the current "Ôn luyện ... mô phỏng" quiz; Ctrl+M again stops it.
//  - Known question  -> press stop at (dark-green band start + OFFSET) => full score.
//  - Unknown question -> press stop early (probe), read the band from the page and
//    remember it in localStorage; redo the quiz later to score it.
//  - Video load error ("Tải video thất bại") -> click "Thử lại" automatically,
//    with a patient delay between tries; skip the question if it never loads.
(() => {
  "use strict";

  const OFFSET = 0.35;          // seconds after the start of the dark-green band
  const PROBE_AT = 10.6;        // video starts at 10.00s; stop right away to learn the band
  const LS_KEY = "simBankLearned";
  const RETRY_ROUNDS = 5;       // "Thử lại" attempts per video
  const RETRY_WAIT_MS = 7000;   // pause before each retry click and after it (be gentle with the server)
  const AFTER_ANSWER_MS = 4000; // pause after each answer before the next video loads
  const HUD_ID = "auto-sim-hud";

  // "start-of-dark-green-band ~ question stem" (matched on the first 50 normalised chars)
  const RAW_BANK = `
20.7~Tình huống nguy hiểm khi gặp xe tải lớn đi qua hầm chui dân sinh
19.25~Tài xế xe dừng bên đường đang mở cửa xe
16.9~Xe bồn bê-tông từ đường nhánh lấn làn để rẽ tại ngã ba không có đèn giao thông có nhiều xe đang dừng đỗ
19.9~Gặp xe ô tô từ đường nhánh bên phải tại ngã ba đi ra với tốc độ nhanh
17.18~Người đi bộ sang đường bị khuất sau xe tải
19.88~Xe buýt lấn làn để vượt tại ngã ba
21.9~Xe ô tô đối diện lấn làn vượt xe đang có tín hiệu dừng khẩn cấp
17.2~Xe phía trước phanh gấp tránh người đi bộ vượt đèn đỏ sang đường
25.25~Tài xế xe đang đỗ ven đường đi ra mở cửa xe tại khu vực đường hẹp đường hẹp
17.93~Người đi xe đạp từ vỉa hè bất ngờ đi xuống đường để sang đường
17.3~Xe ô tô khách bất ngờ đi ra từ nơi đỗ tại đường hẹp
19.65~Xe phía trước phanh gấp để tránh xe chuyển làn rẽ trái tại ngã ba
17.8~Xe ô tô từ đường nhánh bên trái bất ngờ đi nhanh ra có nguy cơ va chạm với xe bạn
18.95~Xe máy đang đi thẳng, đột ngột rẽ trái sang đường trước đầu xe bạn
18.7~Trời mưa, ô tô phía trước phanh gấp để tránh xe mô-tô tạt đầu khi gặp chướng ngại vật
24.73~Người đi bộ vượt đèn đỏ sang đường
14.9~Xe ô tô làn đường đối diện lấn làn vượt xe tải đang dừng đỗ tại khu vực đông đúc
20.93~Xe khách bật đèn cảnh báo dừng giữa ngã tư để đón khách
20.59~Xe mô-tô lấn làn vượt ẩu nguy hiểm tại giao lộ
19.45~Tránh xe tại khu vực công trình sửa đường xuất hiện sau khúc cua
17.3~Xe đạp bất ngờ đi ra từ đường nhánh tại ngã ba
20.1~Xe tô tô phía dừng lại và lùi vào nơi đỗ tại khu vực đường hẹp
17.9~Gặp tài xế xe đang dừng đỗ ven đường đột ngột mở cửa xe
19.2~Học sinh đi ra đường tại khu vực gần trường học
19.55~Xe con làn đối diện rẽ nhanh cắt qua đầu xe bạn tại ngã ba
13.2~Xe khách phía trước đột ngột phanh giảm tốc độ tránh xe đối diện tại đoạn đường cong
17.3~Tại ngã tư, đèn xanh, xe bạn bắt đầu di chuyển có xe mô-tô rẽ cắt ngang qua đầu xe bạn
23.55~Đường nông thôn, xuất hiện xe máy đi ra từ ngõ bên phải
17.4~Đường nông thôn, xe đi gặp đàn bò đang đứng trên đường
15.2~Gặp xe khách tại đoạn đường cong vào cua chiếm hết làn đường tại khu vực đường hẹp
24.56~Đường nông thôn, nhóm xe đạp đi ra từ ngõ bên phải
21.72~Xe tải từ đường nhánh nhập làn nguy hiểm
18.2~Người đi bộ băng qua đường lúc chập tối ngay trước xe bạn
16.7~Gần cổng làng, phía sau có xe mô-tô lấn làn để vượt xe ô tô đang dừng đỗ
18~Ban đêm xe ô tô tải ngược chiều bật đèn chiếu xa làm 2 xe máy phía trước giảm tốc
16.3~Đường nông thôn, gặp đàn bò đi từ dưới vệ đường băng qua đường
16.3~Trời mưa, xe con giảm nhanh tốc độ để tránh xe tải chuyển làn đột ngột tránh chướng ngại vật phía trước
17.35~Cao tốc, xe tải đột ngột giảm tốc và chuyển sang làn xe bạn do gặp xe đang gặp sự cố trên đường
24.2~Xe tải phía trước giảm tốc độ, chuyển sang làn giữa do gặp đoạn đường đang sửa chữa phía trước
25.85~Xe con đi ngược chiều nguy hiểm tại làn đường tốc độ cao nhất trên cao tốc
27.03~Xe ô tô con ở làn bên trái vượt lên và chuyển làn phải cắt qua nguy hiểm trước đầu xe bạn để rẽ ra đường gom
19~Xe tải bật đèn cảnh báo đi ngược đường ở làn bên phải cao tốc
17.35~Xe 16 chỗ từ làn đường khẩn cấp đi ra vào làn xe bạn
14.9~Xe bạn có tín hiệu để chuyển làn trái thì có xe phía sau nháy pha liên tục để vượt
30.5~Xe con phía trước giảm tốc độ và chuyển sang làn xe bạn do gặp đoạn đường đang sửa chữa phía trước
24.9~Xe cấp cứu xin đường, xe con bên trái tăng tốc vượt lên và chuyển làn cắt qua đầu xe bạn
14.95~Phía sau làn phải có xe con vượt lên và chuyển làn cắt ngang nguy hiểm trước mặt xe bạn
22.9~Trên đường cao tốc ban đêm, đột nhiên có xe tải đi chiều ngược lại ở làn khẩn cấp
16.9~Ô tô phía trước phanh gấp do có xe tải tạt sang đột ngột vì gặp chướng ngại vật
18.8~Xe tải phía trước làn phải đột ngột tăng tốc và chuyển sang làn giữa làm xe con phía trước phanh gấp
14.5~Đàn gia súc từ bên đường đi ra cắt qua làn đường xe bạn tại khu vực cao tốc bị hỏng hộ lan
26.9~Xe con từ đường nhánh nhập làn nguy hiểm cắt qua đầu xe bạn
22.5~Qua đoạn đường cong đột nhiên có xe tải đi lùi trong làn khẩn cấp
19.75~Xe tải ở làn phải vượt lên và đột ngột chuyển làn sang làn giữa làm xe phía trước phải phanh gấp
19.4~Xe tải từ đường nhánh nhập vào cao tốc với tốc độ cao
17.45~Xe con đang dừng ở làn khẩn cấp xi nhan nhập làn trước xe bạn
26.9~Xe container đang đi từ làn trái chuyển ra đường nhánh cắt qua làn đường xe bạn
19.4~Đi phía sau xe tải chở vật liệu không được chằng buộc cẩn thận
21.9~Đường núi, trời mưa, xe phía trước đột ngột dừng lại vì hỏng máy
25~Xe tải lấn làn đường xe bạn để vượt các xe khác trên đường núi thời tiết sương mù
24.8~Xe con vào cua lấn làn nguy hiểm va chạm với xe ngược chiều trên đường đồi núi
38.1~Xe khách lấn làn vượt xe container ngay tại khúc cua trên đường núi
26.98~Đường đèo dốc ban đêm gần đoạn đường cong, đột ngột tại khúc cua có xe khách lấn làn vượt xe tải lớn
25.2~Xe con lấn làn xe bạn để vượt xe tải trên đường núi ngay tại đoạn đường quanh co
22.69~Xe ô tô phía trước phanh gấp do có động vật hoang dã đứng ven đường
16.6~Xe bán tải phía trước giảm tốc độ và chuyển làn khẩn cấp để tránh xe mô-tô đi ngược chiều
16.2~Xe con từ làn phải (khuất tầm nhìn) cắt ngang qua các xe đang đi thẳng để sang đường
14.43~Xe con đi phía trước giảm tốc và chuyển làn đột ngột để tránh chướng ngại vật
20.3~Phía đường cong xuất hiện xe tải đi đối diện làm xe khách phía trước giảm tốc độ đột ngột
21~Đường núi, sương mù, có đàn bò đứng sát đường ngay sau đoạn đường cong
17.4~Xuất hiện gia súc từ vệ đường đi ra đường quốc lộ ngay trước mặt xe bạn
13.4~Đi qua chỗ giao cắt với đường sắt ban đêm, không có đèn tín hiệu, phía sau xe con, đột nhiên có tàu đi tới
21.4~Đèn vừa chuyển xanh, đột ngột xe mô-tô làn trái phía trước cố vượt đèn đỏ cắt qua trước đầu xe
16.5~Xe mô tô vượt lên đột ngột giảm tốc và chuyển sang làn xe bạn để tránh chướng ngại vật trên đường
16.35~Em bé đột ngột chạy ra đường
19.5~Xe mô-tô đi ra từ đường nhánh nguy hiểm phía sau xe buýt vừa đi qua.
21.13~Xe ô tô phía trước phanh gấp để tránh đoàn xe đạp từ đường nhánh đi ra
16.4~Xe tải lớn ở làn đường ngược chiều lấn làn xe bạn để vượt qua xe buýt
15.1~Trẻ em đột ngột lao ra để nhặt quả bóng bị lăn ra đường
21.3~Xe mô-tô phanh và chuyển làn để tránh xe buýt vào trả khách
26.2~Khúc gỗ trên xe tải phía trước bị rơi xuống do xe phanh gấp
18.5~Xe đạp từ bên kia đường đối diện băng qua đường không quan sát trước mặt xe bạn
19.45~Xe con phía trước giảm tốc đột ngột và chuyển làn để tránh xe buýt đang dừng
25.3~Xe bán tải từ đường bên kia quay đầu đột ngột lấn làn xe bạn
29.16~[Tai nạn] Tại ngã tư Hàng Xanh, lái xe ô tô con trong tình trạng có nồng độ cồn không làm chủ tốc độ đâm vào loạt xe dừng chờ đèn đỏ
23.73~[Tai nạn] Khi đèn tín hiệu chuyển sang xanh, đột ngột có xe con cố vượt từ đường giao bên trái sang làm va chạm với xe con
17.35~[Tai nạn] Xe 16 chỗ rẽ không quan sát, không làm chủ tốc độ đâm vào xe bán tải đang lùi
26.24~[Tai nạn] Phía trước đột nhiên có xe ô tô từ làn đối diện đi ngược chiều va chạm với xe con
17.3~[Tai nạn] Phía trước có đá lở đột ngột và rơi xuống (tai nạn tại Đồng Văn, Hà Giang)
20.35~[Tai nạn] Xe khách 45 chỗ đâm vào xe đầu kéo kéo rơ moóc chở máy ủi đi từ đường tránh ra gây tai nạn thảm khốc
18.93~[Tai nạn] Xe container bất ngờ tông vào hàng loạt phương tiện đang dừng đèn đỏ tại quốc lộ 1, đoạn nút giao Mỹ Phước - Tân Vạn, Bình Dương
19.4~[Tai nạn] Xe con phanh gấp tránh xe máy từ ngõ lao ra, xe khách không làm chủ tốc độ đã đâm trực diện vào xe con
13.95~[Tai nạn] Xe khách 16 chỗ vượt ẩu qua xe đầu kéo va chạm với xe khách đang xuống dốc tốc độ cao, gây tai nạn liên hoàn giữa 3 xe tại km12+400 đoạn qua phường Hương Hồ, TP. Huế
21.93~[Tai nạn] Xe khách va chạm với xe cứu hỏa đi ngược chiều tại nút giao Pháp Vân
18.97~[Tai nạn] Xe 16 chỗ từ đường nhánh, khuất tầm nhìn rẽ vào đường chính không giảm tốc độ, bị xe sơ mi rơ moóc đâm vào (tại Ngã 3 Nà Phặc - Bắc Kạn)
26.05~[Tai nạn] Xe khách 48 chỗ thiếu kỹ năng điều khiển, không thông thuộc địa hình lao xuống vực tại Kon Tum
29.24~[Tai nạn] Xe khách vào cua với tốc độ cao, lấn sang đường ngược chiều va chạm với xe đi chiều ngược lại
21.63~[Tai nạn] Xe ô tô 16 chỗ chở khách rẽ trái qua đường sắt không chú ý va chạm với tàu hỏa
23.65~[Tai nạn] Tai nạn đèo Prenn xe khách mất lái đâm vào người điều tiết giao thông và xe khách đi ngược chiều
18.83~[Tai nạn] Ô tô 7 chỗ đi trên cầu treo hẹp ban đêm, tài xế lái xe va chạm với xe máy, xe đâm xuống sông tại cầu treo qua sông Giăng, Thanh Chương, Nghệ An
21.75~[Tai nạn] Xe khách chạy vượt xe tải, đâm trực diện vào xe khách đi chiều ngược lại gây tai nạn liên hoàn 3 xe
26.35~[Tai nạn] Hầm Hải Vân xe kéo rơ mooc mất lái lấn làn đâm trực diện vào xe tải đi chiều ngược lại gây tai nạn
29.8~[Tai nạn] Trời mưa, đường trơn trượt xe tải khi vào cua không làm chủ tốc độ đã đâm vào xe ben đi ngược chiều
23~[Tai nạn] Xe con từ làn trong cùng bên trái lấn làn vượt ẩu để đi ra đường nhánh, va chạm với xe tải
18.65~[Tai nạn] Xe khách không tuân thủ khoảng cách an toàn, xử lý tình huống không kịp dẫn tới va chạm với xe tải đang dừng đỗ
15.12~[Tai nạn] Xe mô-tô lấn làn vượt ẩu trên đường núi, va chạm với xe khách đi ngược chiều
15.2~[Tai nạn] Tài xế giật mình đánh lái gấp đâm xe vào dải phân cách, xe đổ vào đám đông làm 5 người thiệt mạng
15.69~[Tai nạn] Xe ô tô Innova lùi trên cao tốc Hà Nội - Thái Nguyên
17.86~[Tai nạn] Xe ô tô con chở người đi qua đường sắt tại Nam Định không chú ý va chạm với tàu hỏa
20.38~[Tai nạn] Xe tải không làm chủ được tốc độ mất lái lao vào chợ dân sinh và va chạm với các xe đang đi phía trước
27.05~[Tai nạn] Tai nạn liên hoàn giữa 3 xe khách do đâm vào xe đang dừng đỗ để sửa chữa
18.25~[Tai nạn] Xe khách lấn làn vượt xe tải chỗ đường cong, đâm vào xe khách đi ngược chiều Tai nạn tại km 1791+ 400 trên đường Hồ Chí Minh, đoạn qua thôn 7, xã Hoà Phú, TP.Buôn Ma Thuột (Đắk Lắk)
17.85~[Tai nạn] Xe con phanh gấp tránh xe máy từ ngõ lao ra, xe khách không làm chủ tốc độ đã đâm trực diện vào xe con
`;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const norm = (s) => s.replace(/\s+/g, " ").replace(/Video (đang tải|sẽ bắt đầu).*$/, "").trim();
  const key = (s) => norm(s).slice(0, 50);

  /** key(stem) -> start time of the dark-green band */
  const BANK = new Map();
  for (const line of RAW_BANK.trim().split("\n")) {
    const i = line.indexOf("~");
    BANK.set(key(line.slice(i + 1)), parseFloat(line.slice(0, i)));
  }

  const learned = () => {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); } catch { return {}; }
  };
  const lookup = (q) => learned()[key(q)] ?? BANK.get(key(q)) ?? null;

  const btn = (re) =>
    [...document.querySelectorAll("button")].find((b) => re.test(b.innerText) && b.offsetParent);

  /** Question text shown above the video (without countdown / timer text). */
  const stem = () => {
    const t = document.querySelector("main").innerText.replace(/\s+/g, " ");
    const r = t.slice(t.indexOf("Góp ý") + 5);
    const k = r.search(/\s(Video sẽ|\d+\.\d\d \/ \d)/);
    return (k > 0 ? r.slice(0, k) : r.slice(0, 120)).trim();
  };

  /** Start time of the first (dark-green) score mark; rendered only after answering. */
  const bandStart = (video) => {
    const m = video.parentElement.parentElement.querySelector(
      "button.media-audio-tracking-bar__mark[style*='background-color']"
    );
    return m ? (parseFloat(m.style.left) / 100) * video.duration : null;
  };

  const retryButton = () =>
    [...document.querySelectorAll("button, div, span")].find(
      (x) => x.offsetParent && x.children.length === 0 && /^Thử lại$/.test(x.innerText.trim())
    );

  /** Wait for the <video> to be usable, clicking "Thử lại" when the load failed. */
  async function ensureVideo() {
    for (let i = 0; i < RETRY_ROUNDS; i++) {
      const v = document.querySelector("video");
      if (v && v.readyState >= 1 && v.duration > 0) return v;
      await sleep(RETRY_WAIT_MS);
      retryButton()?.click();
      await sleep(RETRY_WAIT_MS);
    }
    const v = document.querySelector("video");
    return v && v.duration > 0 ? v : null;
  }

  // ---- chapter switching -------------------------------------------------
  const AUTO_KEY = "simAuto";           // sessionStorage: auto mode on/off + per-chapter stall counters
  const SETTLE_MS = 3500;
  const autoState = () => {
    try { return JSON.parse(sessionStorage.getItem(AUTO_KEY) || "null"); } catch { return null; }
  };
  const saveAuto = (st) =>
    st ? sessionStorage.setItem(AUTO_KEY, JSON.stringify(st)) : sessionStorage.removeItem(AUTO_KEY);

  const onList = () => /Luyện theo chủ đề/.test(document.body.innerText) && !document.querySelector("video");

  /** Click a sidebar entry (leftmost column) whose text starts with `text`. */
  function clickSidebar(text) {
    const els = [...document.querySelectorAll("body *")]
      .filter((x) => x.offsetParent && x.getBoundingClientRect().left < 270 &&
        x.innerText && x.innerText.replace(/\s+/g, " ").trim().startsWith(text))
      .sort((a, b) => a.innerText.length - b.innerText.length || (b.tagName === "A") - (a.tagName === "A"));
    els[0]?.click();
    return !!els[0];
  }

  const chapterOf = (b) => {
    for (let e = b, i = 0; e && i < 8; e = e.parentElement, i++) {
      const m = e.innerText && e.innerText.match(/^Chương (\d+)/);
      if (m) return +m[1];
    }
    return 0;
  };

  /** Finish the quiz and go back to the topic list (results page -> Ôn luyện). */
  async function finishAndReopen() {
    btn(/Kết thúc luyện thi/)?.click();
    await sleep(1200);
    btn(/^OK$/)?.click();
    await sleep(SETTLE_MS);                       // "Ôn luyện" stays blank if we navigate too early
    for (let t = 0; t < 3; t++) {
      clickSidebar("Kết quả học tập");
      await sleep(3000);
      if (clickSidebar("Ôn luyện")) {
        await sleep(3000);
        if (onList()) return true;
      }
    }
    return false;
  }

  /**
   * On the topic list: start "Luyện câu sai (n)" for the first chapter that still has
   * open questions. A chapter whose open count did not go down for STALL_LIMIT starts
   * in a row (videos that never load) is parked; stop when nothing else is left.
   */
  async function startNextChapter(st) {
    const STALL_LIMIT = 4;
    const buttons = [...document.querySelectorAll("button")]
      .filter((b) => b.offsetParent && /^Luyện câu sai \((\d+)\)/.test(b.innerText.trim()));
    for (const b of buttons) {
      const ch = chapterOf(b), left = +b.innerText.match(/\((\d+)\)/)[1];
      if (!left) continue;
      const c = (st.ch[ch] ||= { last: null, stall: 0 });
      if (c.last !== null && left >= c.last) c.stall++; else c.stall = 0;
      c.last = left;
      if (c.stall >= STALL_LIMIT) continue;       // parked
      saveAuto(st);
      hud(`[sim] chapter ${ch}: ${left} open`);
      b.click();
      await sleep(5000);
      return true;
    }
    return false;
  }

  let running = false;
  const hud = (text) => {
    let el = document.getElementById(HUD_ID);
    if (!el) {
      el = document.createElement("div");
      el.id = HUD_ID;
      el.style.cssText =
        "position:fixed;left:8px;bottom:8px;z-index:99999;background:#000c;color:#fff;font:12px monospace;padding:6px 8px;border-radius:6px;pointer-events:none";
      document.body.appendChild(el);
    }
    el.textContent = text;
  };

  /** Answer the question on screen once. Returns a short result string. */
  async function answer(video) {
    const q = stem();
    const known = lookup(q);
    if (video.readyState < 2) await sleep(1500);
    // The icon-only play button skips the 9s countdown.
    const play = [...document.querySelectorAll("button")].find(
      (b) => b.offsetParent && !b.innerText.trim() && b.getBoundingClientRect().height > 30
    );
    const target = known != null ? known + OFFSET : PROBE_AT;
    if (video.paused) play?.click();
    // let the clip buffer past the target so playback cannot stall right before the stop
    for (let b0 = Date.now(); running && Date.now() - b0 < 60000; await sleep(500)) {
      const be = video.buffered.length ? video.buffered.end(video.buffered.length - 1) : 0;
      if (be >= target + 1.5 || be >= video.duration - 0.3) break;
    }
    const t0 = Date.now();
    while (running && video.currentTime < target && Date.now() - t0 < 80000) await sleep(10);
    btn(/Space/)?.click();
    await sleep(700);
    const m = document.querySelector("main").innerText.match(/Điểm của bạn: ([\d.]+)\/5/);
    const score = m ? parseFloat(m[1]) : null;
    // Auto-learn: the band is only drawn after answering, so read it now when the question
    // was missing, or when the stored time did not give full marks (wrong / outdated value).
    const start = bandStart(video);
    const relearn = known != null && score != null && score < 5;
    if (start != null && (known == null || relearn)) {
      const l = learned();
      l[key(q)] = +start.toFixed(2);
      localStorage.setItem(LS_KEY, JSON.stringify(l));
    }
    return `${score ?? "?"}/5 ${known == null ? "learned" : relearn ? "re-learned" : "known"}`;
  }

  /** Answer every question of the current quiz, then (auto mode) change chapter. */
  async function run() {
    running = true;
    const st = autoState() || { ch: {} };
    saveAuto(st);                                 // auto mode stays on until stopped / finished
    let done = 0, skipped = 0;
    while (running) {
      try {
        if (onList()) {                           // topic list: pick the next chapter
          if (!(await startNextChapter(st))) { hud("[sim] ALL DONE (or only stuck chapters left)"); break; }
          continue;
        }
        const video = await ensureVideo();
        if (!video) {
          skipped++;
          hud(`[sim] skip (video won't load) | done ${done}, skipped ${skipped}`);
        } else if (!/Bạn đã trả lời|Điểm của bạn/.test(document.querySelector("main").innerText)) {
          const r = await answer(video);
          done++;
          hud(`[sim] ${r} | done ${done}, skipped ${skipped}`);
          await sleep(AFTER_ANSWER_MS);
        }
        const next = btn(/^Tiếp/);
        if (next) { next.click(); await sleep(1500); continue; }
        if (!(await finishAndReopen())) { hud("[sim] could not return to the topic list"); break; }
      } catch (e) {
        console.warn("[sim]", e);
        hud("[sim] error, stopped: " + e.message);
        break;
      }
    }
    running = false;
    if (!autoState()) return;
    // leave auto mode only on a deliberate stop or when finished
    saveAuto(null);
  }

  addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.key.toLowerCase() === "m") {
      e.preventDefault();
      if (running) { running = false; saveAuto(null); hud("[sim] stopping..."); } else run();
    }
  });

  // Console helper: simExport() -> learned entries as "start~stem" lines for RAW_BANK.
  window.simExport = () => {
    const l = learned();
    const out = Object.entries(l).map(([k, v]) => `${v}~${k}`).join("\n");
    console.log(out);
    return out;
  };

  // Resume after an accidental page reload while auto mode was on.
  if (autoState()) setTimeout(() => { if (!running) run(); }, 4000);
})();
