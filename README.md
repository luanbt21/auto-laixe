# auto-laixe

A [Tampermonkey](https://www.tampermonkey.net/) userscript that automatically completes the
**"Ôn luyện"** (practice) quizzes on <https://laixebacha.huelms.com>, repeating the run as many
times as you ask.

> It only drives the practice mode. Use it at your own risk and in line with the site's terms.

## Install

1. Install the Tampermonkey extension in your browser.
2. Create a new userscript and paste in the contents of [`auto-practice.js`](auto-practice.js)
   (or import the file).
3. Save. The script runs on `https://laixebacha.huelms.com/learn/*`.

## Usage

1. Open the site and go to the **Ôn luyện** topic list (or a practice already in progress).
2. Press **Ctrl+Q**. A prompt asks how many runs to do.
3. The script answers every question, clicks **Kết thúc luyện thi**, opens **Kết quả học tập**,
   returns to **Ôn luyện**, starts the next run, and repeats until the count is reached.
4. Press **Ctrl+Q** again at any time to stop after the current step.

Progress (runs remaining) is kept in `sessionStorage`, so the script resumes by itself after the
full page reloads it triggers between runs. Closing the tab clears it.

Logs and warnings are prefixed with `[auto-practice]` in the browser console. Look there for
`unknown question, guessing` (a question not in the banks) and `WRONG →` (the site rejected an
answer), then add or fix the entry.

## Supported topics

| Topic (as titled on the site)                | Bank type |
| -------------------------------------------- | --------- |
| Văn hóa, đạo đức nghề nghiệp người lái xe    | text      |
| Kỹ thuật lái xe                              | text      |
| Cấu tạo và sửa chữa xe                       | text      |
| Khái niệm và quy tắc giao thông đường bố     | hashed    |

Topics without a bank are skipped. Unknown questions inside a supported topic fall back to a
"Cả …" ("all of the above") option, then to the first option.

## How answers are matched

- **`BANKS`** (small topics): `[question substring, correct option substring]` pairs. Entries are
  tried in order; the first whose question matches **and** whose answer is among the options wins.
  Options are matched by text, so shuffled option order is fine.
- **`HASH_BANKS`** (large topics): compact `<question hash><answer hash>` pairs (FNV-1a, 8 hex
  chars each). The question hash covers the stem plus the sorted options, so identical-looking
  picture questions stay distinct and shuffling doesn't matter.

To support a new topic, add a key (the exact title shown on the "Ôn luyện" page) to `BANKS` or
`HASH_BANKS`.

## Configuration

Edit the constants at the top of the script:

| Constant           | Default | Purpose                                              |
| ------------------ | ------- | ---------------------------------------------------- |
| `DELAY.feedback`   | 1000 ms | Wait after picking an answer, for the site's verdict |
| `DELAY.next`       | 500 ms  | Pause between steps                                  |
| `DELAY.poll`       | 250 ms  | Polling interval while waiting for elements          |
| `TIMEOUT`          | 15000 ms| Max wait for a page or element                       |
| `SETTLE_MS`        | 2500 ms | Pause after finishing, before navigating away        |

If pages don't finish loading between runs, raise `SETTLE_MS` and `TIMEOUT` first.

## Limitations

- It depends on the site's current DOM and Vietnamese UI labels; a site redesign will break it.
- The hotkey is Ctrl+Q; change it in the `keydown` listener at the bottom of the script.

## License

[MIT](LICENSE)
