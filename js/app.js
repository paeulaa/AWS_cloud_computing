let state = JSON.parse(localStorage.getItem('awsQuizState') || '{}');
let notes = JSON.parse(localStorage.getItem('awsQuizNotes') || '{}');
const totalQ = 719;
const QUESTIONS_BY_NUM = Object.fromEntries(QUESTIONS.map(q => [q.num, q]));

function isMulti(q) {
    return q.multi === true || String(q.answer).includes(',');
}

function parseAnswerLetters(answer) {
    return String(answer).split(',').map(s => s.trim()).filter(Boolean).sort();
}

function getChooseLabel(q) {
    if (!isMulti(q)) return '';
    const n = parseAnswerLetters(q.answer).length;
    return ` · Choose ${n}`;
}

function getSelected(qNum) {
    const q = QUESTIONS_BY_NUM[qNum];
    const raw = state[qNum]?.selected;
    if (!raw) return isMulti(q) ? [] : null;
    if (isMulti(q)) {
        if (Array.isArray(raw)) return [...raw].sort();
        return String(raw).split(',').map(s => s.trim()).filter(Boolean).sort();
    }
    return raw;
}

function setSelected(qNum, value) {
    if (!state[qNum]) state[qNum] = {};
    state[qNum].selected = value;
    localStorage.setItem('awsQuizState', JSON.stringify(state));
}

function syncOptionUI(qNum) {
    const q = QUESTIONS_BY_NUM[qNum];
    const selected = getSelected(qNum);
    document.querySelectorAll('#q' + qNum + ' .option').forEach(opt => {
        const input = opt.querySelector('input');
        const letter = input.value;
        const on = isMulti(q)
            ? selected.includes(letter)
            : selected === letter;
        input.checked = on;
        opt.classList.toggle('selected', on);
    });
}

function renderQuestions() {
    const container = document.getElementById('questions');
    const frag = document.createDocumentFragment();
    for (const q of QUESTIONS) {
        const n = q.num;
        const multi = isMulti(q);
        const chooseHint = getChooseLabel(q);

        let optionsHTML = '';
        for (const [letter, text] of Object.entries(q.options)) {
            if (multi) {
                optionsHTML += `<label class="option option-multi" id="q${n}_${letter}">
    <input type="checkbox" name="q${n}" value="${letter}" onchange="selectOption(${n},'${letter}')">
    <span class="option-box" aria-hidden="true"></span>
    <span class="option-label">${letter}. ${text}</span>
  </label>`;
            } else {
                optionsHTML += `<label class="option option-single" id="q${n}_${letter}">
    <input type="radio" name="q${n}" value="${letter}" onchange="selectOption(${n},'${letter}')">
    <span class="option-box" aria-hidden="true"></span>
    <span class="option-label">${letter}. ${text}</span>
  </label>`;
            }
        }

        const div = document.createElement('div');
        div.className = 'question' + (multi ? ' question-multi' : '');
        div.id = 'q' + n;
        div.dataset.answer = q.answer;
        if (multi) div.dataset.multi = 'true';

        div.innerHTML = `
  <div class="q-header">
    <span>Question #${n}<span class="choose-hint">${chooseHint}</span></span>
    <div>
      <button class="btn btn-check" id="checkBtn${n}" onclick="checkQuestion(${n})">Show Answer</button>
      <button class="btn btn-reset-one" onclick="resetQuestion(${n})">Reset</button>
    </div>
  </div>
  <div class="q-text">${q.text}</div>
  ${optionsHTML}
  <div class="result" id="result${n}"></div>
  <div class="notes-section">
    <div class="notes-toggle" id="notesToggle${n}" onclick="toggleNotes(${n})">Notes</div>
    <textarea class="notes-area" id="notes${n}" placeholder="Write your notes here..." oninput="saveNote(${n})"></textarea>
  </div>`;
        frag.appendChild(div);
    }
    container.appendChild(frag);
}

function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateBackToTop() {
    const btn = document.getElementById('backToTop');
    if (!btn) return;
    btn.classList.toggle('visible', window.scrollY > 400);
}

window.addEventListener('load', function() {
    renderQuestions();
    updateBackToTop();
    window.addEventListener('scroll', updateBackToTop, { passive: true });

    for (let qNum in state) {
        const num = parseInt(qNum, 10);
        if (!QUESTIONS_BY_NUM[num]) continue;
        syncOptionUI(num);
        if (state[qNum].checked) checkQuestion(num, true);
    }
    for (let qNum in notes) {
        let textarea = document.getElementById('notes' + qNum);
        if (textarea && notes[qNum]) {
            textarea.value = notes[qNum];
            textarea.classList.add('show');
            let toggle = document.getElementById('notesToggle' + qNum);
            if (toggle) toggle.classList.add('has-notes');
        }
    }
    updateStats();
});

function selectOption(qNum, letter) {
    const q = QUESTIONS_BY_NUM[qNum];
    if (isMulti(q)) {
        let sel = getSelected(qNum);
        const idx = sel.indexOf(letter);
        if (idx >= 0) sel.splice(idx, 1);
        else sel.push(letter);
        sel.sort();
        setSelected(qNum, sel);
    } else {
        setSelected(qNum, letter);
    }
    syncOptionUI(qNum);
}

function answersMatch(q, selected) {
    const correct = parseAnswerLetters(q.answer);
    if (isMulti(q)) {
        const picked = Array.isArray(selected) ? [...selected].sort() : [];
        if (picked.length !== correct.length) return false;
        return picked.every((l, i) => l === correct[i]);
    }
    return selected === q.answer;
}

function formatAnswerDisplay(answer) {
    return parseAnswerLetters(answer).join(', ');
}

function checkQuestion(qNum, silent) {
    const q = QUESTIONS_BY_NUM[qNum];
    const qDiv = document.getElementById('q' + qNum);
    const correctLetters = parseAnswerLetters(q.answer);
    const selected = getSelected(qNum);
    const resultDiv = document.getElementById('result' + qNum);
    const multi = isMulti(q);
    const hasSelection = multi
        ? selected.length > 0
        : selected != null && selected !== '';

    if (!hasSelection && !silent) {
        resultDiv.className = 'result show wrong';
        const need = multi ? `Select ${correctLetters.length} answers` : 'Select an answer';
        resultDiv.textContent = need + ' — Correct: ' + formatAnswerDisplay(q.answer);
        return;
    }
    if (!hasSelection) return;

    if (multi && selected.length !== correctLetters.length && !silent) {
        resultDiv.className = 'result show wrong';
        resultDiv.textContent = `Select ${correctLetters.length} answers — Correct: ${formatAnswerDisplay(q.answer)}`;
        return;
    }

    const isCorrect = answersMatch(q, selected);

    qDiv.querySelectorAll('.option').forEach(o => o.classList.remove('show-correct', 'show-wrong'));

    correctLetters.forEach(letter => {
        const el = document.getElementById('q' + qNum + '_' + letter);
        if (el) el.classList.add('show-correct');
    });

    if (!isCorrect) {
        const picked = multi ? selected : [selected];
        picked.forEach(letter => {
            if (!correctLetters.includes(letter)) {
                const el = document.getElementById('q' + qNum + '_' + letter);
                if (el) el.classList.add('show-wrong');
            }
        });
    }

    qDiv.classList.remove('answered-correct', 'answered-wrong');
    qDiv.classList.add(isCorrect ? 'answered-correct' : 'answered-wrong');

    resultDiv.className = 'result show ' + (isCorrect ? 'correct' : 'wrong');
    resultDiv.textContent = isCorrect
        ? 'Correct.'
        : 'Wrong — Correct: ' + formatAnswerDisplay(q.answer);

    const btn = document.getElementById('checkBtn' + qNum);
    btn.disabled = true;
    btn.textContent = isCorrect ? 'OK' : 'X';

    if (!state[qNum]) state[qNum] = {};
    state[qNum].checked = true;
    localStorage.setItem('awsQuizState', JSON.stringify(state));
    updateStats();
}

function resetQuestion(qNum) {
    const qDiv = document.getElementById('q' + qNum);
    qDiv.classList.remove('answered-correct', 'answered-wrong');
    qDiv.querySelectorAll('.option').forEach(o => o.classList.remove('show-correct', 'show-wrong', 'selected'));
    qDiv.querySelectorAll('input[type=radio], input[type=checkbox]').forEach(r => { r.checked = false; });
    const resultDiv = document.getElementById('result' + qNum);
    resultDiv.className = 'result';
    resultDiv.textContent = '';
    const btn = document.getElementById('checkBtn' + qNum);
    btn.disabled = false;
    btn.textContent = 'Show Answer';
    delete state[qNum];
    localStorage.setItem('awsQuizState', JSON.stringify(state));
    updateStats();
}

function resetAll() {
    if (!confirm('確定要重置所有題目嗎？筆記會保留。')) return;
    state = {};
    localStorage.setItem('awsQuizState', '{}');
    document.querySelectorAll('.question').forEach(qDiv => {
        const qNum = parseInt(qDiv.id.replace('q', ''), 10);
        qDiv.classList.remove('answered-correct', 'answered-wrong');
        qDiv.querySelectorAll('.option').forEach(o => o.classList.remove('show-correct', 'show-wrong', 'selected'));
        qDiv.querySelectorAll('input[type=radio], input[type=checkbox]').forEach(r => { r.checked = false; });
        const resultDiv = document.getElementById('result' + qNum);
        resultDiv.className = 'result';
        resultDiv.textContent = '';
        const btn = document.getElementById('checkBtn' + qNum);
        btn.disabled = false;
        btn.textContent = 'Show Answer';
    });
    updateStats();
}

function toggleNotes(qNum) {
    const textarea = document.getElementById('notes' + qNum);
    textarea.classList.toggle('show');
    if (textarea.classList.contains('show')) textarea.focus();
}

function saveNote(qNum) {
    const textarea = document.getElementById('notes' + qNum);
    const toggle = document.getElementById('notesToggle' + qNum);
    notes[qNum] = textarea.value;
    localStorage.setItem('awsQuizNotes', JSON.stringify(notes));
    toggle.classList.toggle('has-notes', textarea.value.length > 0);
}

function jumpToQ() {
    const num = document.getElementById('jumpTo').value;
    const el = document.getElementById('q' + num);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function updateStats() {
    let correct = 0, wrong = 0, answered = 0;
    document.querySelectorAll('.question').forEach(qDiv => {
        if (qDiv.classList.contains('answered-correct')) { correct++; answered++; }
        else if (qDiv.classList.contains('answered-wrong')) { wrong++; answered++; }
    });
    document.getElementById('correct').textContent = correct;
    document.getElementById('wrong').textContent = wrong;
    document.getElementById('unanswered').textContent = totalQ - answered;
    document.getElementById('progressFill').style.width = (answered / totalQ * 100) + '%';
}
